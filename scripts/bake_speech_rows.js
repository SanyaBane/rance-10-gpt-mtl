/**
 * Lay every speech's English into the rows the bytecode gave it, in the file.
 *
 *   node scripts/bake_speech_rows.js                     # what it would do
 *   node scripts/bake_speech_rows.js --write             # do it
 *   node scripts/bake_speech_rows.js --scene=030335      # one scene
 *   node scripts/bake_speech_rows.js --samples=8         # more of each list
 *
 * The draft answered a whole utterance on its speech's first row, left the rest
 * of the rows blank, and wrote rows wider than the window draws. Nothing lays
 * those out on the way to the game: `assemblePatch` does it for a language
 * assembled out of a retranslation, and the path a build of `en_grok` takes --
 * `readSceneDialogue`, then `wrapAt` per row -- does not. A row too wide is
 * folded into two drawn lines there, so a speech of three rows is drawn in five
 * and the window has three. The player sees that as text running over the
 * buttons and off the screen, which is where it was found; no report showed it.
 *
 * modules/SpeechRows.js is the layout. This writes what it produces into
 * text_languages/<lang>/scenes/ rather than applying it at build time, for the
 * reason CLAUDE.md gives about the name repairs: a file reads the way a build of
 * it reads. Laying out in the reader would leave the `.tsv` that every report
 * and every translator sees saying something the player never gets, which is
 * the state 14 380 lines were in for years.
 *
 * The row count is never touched. It is the `MSG` operands, and a speech that
 * comes back with the wrong number of rows does not lose its tail, it shifts it
 * -- 158 lines across six scenes once played a line out of step that way.
 *
 * **What it lays out is what the report calls broken, and nothing else.** The
 * layout minimises the widest row, so it disagrees with almost every hand-made
 * division that is perfectly fine: asked of all 166 177 speeches, the first dry
 * run of this offered to rewrite 62 261 of them across 141 941 rows and 4965 of
 * the 5433 files, most of it turning a good split into a differently good one.
 * A pass that rewrites what is not broken cannot be reviewed and buries the
 * edits that matter, so the work list is `find_speech_gaps`'s own `overflow`
 * and `blank` findings -- the speeches drawn in more lines than their window
 * has, and the ones with an empty row where the game speaks.
 *
 * Three things it will not touch.
 *
 * **A row the game itself left blank.** 954 speeches hold one: a beat inside a
 * bubble, or text positioned across the screen with runs of full-width spaces.
 * The layout goes into the rows the game speaks on, in their order, which is
 * `carriesText` -- imported from modules/SpeechBrackets.js rather than restated,
 * because a second definition of that question would be a second opinion about
 * whose row it is.
 *
 * **A speech nobody has translated.** Its rows are empty on purpose: the build
 * leaves such a speech out whole so the game plays its Japanese, where an empty
 * English row would play as an empty bubble.
 *
 * **A speech whose English is on the wrong row to begin with.** Re-laying out a
 * shifted speech redistributes somebody else's sentence, and it destroys the
 * per-row signals `find_speech_gaps` recognises the shift by -- the 19 speeches
 * it reports, and the 23-row run in 033355.tsv that no report sees. A pass that
 * normalises away the thing being looked for is not a fix, it is a cover-up.
 *
 * And a speech whose game-blank row carries English of its own is refused. The
 * utterance handed to the layout is joined from every row, blank ones included,
 * but the layout goes back into the spoken rows only -- so that English would be
 * written into the spoken rows and stay where it was as well, which is the one
 * way this pass could duplicate a sentence rather than move it. Two speeches in
 * 5433 scenes are that shape and neither is in the work list today, which is a
 * measurement rather than a guarantee: the work list changes with every pass.
 *
 * A speech with fewer words than rows is left alone too, and named. The layout
 * would put one word on each row and still leave the rest empty, so the blank
 * row it was reported for stays either way: the fix is a longer translation,
 * which is somebody's decision rather than this pass's.
 *
 * Two gates stand in front of every write, and neither trusts the layout:
 *
 * **The words have to survive, in order.** What goes into the rows, read back
 * as one utterance, has to be the same sequence of words that came out of them.
 * The layout only ever cuts a word list into runs, so this holds by
 * construction -- which is exactly why it is asserted rather than assumed.
 *
 * **The file has to round-trip.** Before anything is written, the scene is
 * parsed and rendered back with no edits and compared with the bytes on disk. A
 * file that does not reproduce itself is skipped and said so, because a writer
 * that assumes the format reformats five thousand files to change one cell.
 * scripts/fix_speech_brackets.js stands on the same two gates.
 */
import * as fs from "fs/promises";
import * as path from "path";
import {run} from "../modules/AliceTools.js";
import {flagValue, hasFlag} from "../modules/Argv.js";
import {ROOT} from "../modules/Env.js";
import {parseSceneFile, renderSceneFile, speechesOf} from "../modules/SceneFile.js";
import {translatedScenesDir} from "../modules/SceneTranslations.js";
import {carriesText, isShifted} from "../modules/SpeechBrackets.js";
import {findSpeechGaps} from "../modules/SpeechGaps.js";
import {layOutSpeech} from "../modules/SpeechRows.js";
import {textLangName} from "../modules/TextLanguages.js";

/** One utterance as the layout reads it: the words, and nothing about the rows. */
const wordsOf = (text) => text.trim().split(/\s+/).filter(Boolean);

/** A speech, named the way the reports name one, so a finding can be looked up. */
const nameOf = (fileName, speech) => `${fileName} m[${speech.lineNumber}]`;

await run(async () => {
    const write = hasFlag("write");
    const samples = Number(flagValue("samples") ?? 3);
    const only = flagValue("scene");
    const textLang = textLangName();

    /*
     * The report decides both what to lay out and what to keep away from, and
     * both are asked rather than re-derived: it knows three signals for a shift
     * and a copy here would know whichever one this file remembered.
     *
     * A speech is reported once, under the worst class it answers, so overflow
     * and blank are the whole of the work list -- a speech that also overflows
     * is filed under overflow, and one filed under bracket or shifted has
     * something wrong with it that a layout must not paper over.
     */
    const {findings} = await findSpeechGaps(textLang);
    const wantsLayout = new Set(findings
        .filter(finding => finding.class === "overflow" || finding.class === "blank")
        .map(finding => `${finding.file}#${finding.lineNumber}`));
    const shifted = new Set(findings
        .filter(finding => finding.class === "shifted")
        .map(finding => `${finding.file}#${finding.lineNumber}`));

    const dir = translatedScenesDir(textLang);
    const wanted = only && (only.endsWith(".tsv") ? only : `${only}.tsv`);
    const fileNames = (await fs.readdir(dir))
        .filter(name => name.endsWith(".tsv") && (!wanted || name === wanted))
        .sort();
    if (!fileNames.length) {
        console.error(`No scene files in ${path.relative(ROOT, dir)}${wanted ? ` called ${wanted}` : ""}.`);
        return 1;
    }

    let speeches = 0;
    let laidOut = 0;
    let unchanged = 0;
    let rowsChanged = 0;
    let filesChanged = 0;
    const left = {fine: 0, shifted: 0, silent: 0, untranslated: 0, tooFewWords: 0};
    const stillOverflowing = [];
    const refused = [];
    const notRoundTripped = [];
    const changes = [];

    for (const fileName of fileNames) {
        const file = path.join(dir, fileName);
        const text = await fs.readFile(file, "utf-8");
        const scene = parseSceneFile(text);
        if (renderSceneFile(scene) !== text) {
            notRoundTripped.push(fileName);
            continue;
        }

        const byNumber = new Map(scene.rows.map(row => [row.lineNumber, row]));
        const edits = new Map();

        for (const speech of speechesOf(scene)) {
            ++speeches;
            if (!wantsLayout.has(`${fileName}#${speech.lineNumber}`)) {
                ++left.fine;
                continue;
            }
            const rows = speech.rows.map(number => byNumber.get(number));
            const spoken = rows.filter(carriesText);
            if (!spoken.length) {
                ++left.silent;
                continue;
            }
            if (!speech.english.trim()) {
                ++left.untranslated;
                continue;
            }
            if (shifted.has(`${fileName}#${speech.lineNumber}`)
                || rows.some(row => isShifted(fileName, row.lineNumber))) {
                ++left.shifted;
                continue;
            }

            const written = rows.filter(row => !carriesText(row) && row.english.trim());
            if (written.length) {
                refused.push(`${nameOf(fileName, speech)}: the game says nothing on`
                    + ` ${written.length} of its rows and the English does`);
                continue;
            }

            const laid = layOutSpeech(speech.english, spoken.length);
            if (laid.tooFewWords) {
                ++left.tooFewWords;
                continue;
            }

            // The gate the rule does not get to vote on: the same words, in the
            // same order, whatever the layout decided about the rows.
            const before = wordsOf(speech.english);
            const after = wordsOf(laid.rows.join(" "));
            if (before.join(" ") !== after.join(" ")) {
                refused.push(`${nameOf(fileName, speech)}: the layout did not give the words back`);
                continue;
            }

            if (!laid.fits) {
                stillOverflowing.push(`${nameOf(fileName, speech)}: ${spoken.length} rows,`
                    + ` ${before.length} words`);
            }

            const moved = spoken.filter((row, at) => row.english !== laid.rows[at]);
            if (!moved.length) {
                ++unchanged;
                continue;
            }
            ++laidOut;
            rowsChanged += moved.length;
            spoken.forEach((row, at) => {
                if (row.english !== laid.rows[at]) {
                    edits.set(row.lineNumber, laid.rows[at]);
                }
            });
            if (changes.length < samples) {
                changes.push(`  ${nameOf(fileName, speech)}`
                    + spoken.map((row, at) => `\n    ${row.english}\n      -> ${laid.rows[at]}`).join(""));
            }
        }

        if (edits.size) {
            ++filesChanged;
            if (write) {
                await fs.writeFile(file, renderSceneFile(scene, edits), "utf-8");
            }
        }
    }

    console.log(`${fileNames.length} scenes, ${speeches} speeches`);
    console.log(`  ${laidOut} speeches to lay out, ${rowsChanged} rows in ${filesChanged} files`);
    console.log(`  ${unchanged} of the report's own speeches already lie that way`);
    console.log(`  left alone: ${left.fine} the report does not complain about,`
        + ` ${left.shifted} shifted, ${left.silent} the game says nothing on,`
        + ` ${left.untranslated} untranslated, ${left.tooFewWords} with fewer words than rows`);
    if (stillOverflowing.length) {
        console.log(`  ${stillOverflowing.length} still too long for the window afterwards --`
            + " shorten those by meaning, the layout cannot");
        stillOverflowing.slice(0, samples).forEach(line => console.log(`    ${line}`));
    }
    for (const line of changes) {
        console.log(line);
    }
    if (refused.length) {
        console.warn(`  ${refused.length} speeches refused by the post-condition and left as they were`);
        refused.slice(0, samples).forEach(line => console.warn(`    ${line}`));
    }
    if (notRoundTripped.length) {
        console.warn(`  ${notRoundTripped.length} files do not reproduce themselves and were skipped:`
            + ` ${notRoundTripped.slice(0, samples).join(", ")}`);
    }
    console.log(write
        ? `  written into ${path.relative(ROOT, dir)}`
        : "  a dry run, nothing written; add --write");
    return 0;
});
