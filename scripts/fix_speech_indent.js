/**
 * Give every row of a bubble the indent the game's own row carries.
 *
 *   node scripts/fix_speech_indent.js                      # the report, nothing written
 *   node scripts/fix_speech_indent.js --write              # write it
 *   node scripts/fix_speech_indent.js --scene=031581.tsv   # one scene, all of it
 *   node scripts/fix_speech_indent.js --bucket=ascii-space
 *   node scripts/fix_speech_indent.js --limit=20
 *
 * 　いずれはこんな日が…… came back as `wonder if such a reunion` and the middle
 * line of the bubble hangs a character to the left of the two around it.
 * modules/SpeechIndent.js is the question -- which rows, which two buckets, and
 * the three things the pass deliberately leaves alone.
 *
 * A dry run by default, and the dry run is the report: it prints every row it
 * would change with the Japanese beside it, so the listing is what gets read
 * before anything is written rather than the diff afterwards.
 *
 * Two gates stand in front of every write, the same two
 * scripts/fix_speech_brackets.js stands behind, and neither trusts the rule that
 * made the edit:
 *
 * **The row has to verify.** `verifyIndent` asks the text the fix produced --
 * it starts with exactly the Japanese's own run of full-width spaces, nothing
 * but leading spaces moved, and the row still says something. A row that fails
 * is left alone and named at the end.
 *
 * **The file has to round-trip.** Before anything is written the scene is
 * parsed and rendered back with no edits and compared with the bytes on disk.
 * The line endings and the trailing tabs are uniform across the tree by
 * measurement rather than by assumption, and a writer that assumes reformats
 * five thousand files to change one cell.
 */
import * as fs from "fs/promises";
import * as path from "path";
import {flagValue, hasFlag} from "../modules/Argv.js";
import {run} from "../modules/AliceTools.js";
import {parseSceneFile, renderSceneFile} from "../modules/SceneFile.js";
import {translatedScenesDir} from "../modules/SceneTranslations.js";
import {BUCKETS, countByBucket, countOppositeIndents, findSpeechIndent, holds} from "../modules/SpeechIndent.js";
import {textLangName} from "../modules/TextLanguages.js";

const cell = (text, width) => JSON.stringify(text).slice(0, width).padEnd(width);

const showFinding = (finding) => {
    const checked = holds(finding.verified) ? "" : "  !! the fix does not verify"
        + `${finding.verified.mirrors ? "" : ": it would not start where the Japanese does"}`
        + `${finding.verified.kept ? "" : ": the text on the row changed"}`
        + `${finding.verified.filled ? "" : ": it would leave the row empty"}`;
    console.log(`${finding.file} m[${finding.lineNumber}] ${finding.speaker}`
        + ` -- ${finding.bucket}${checked}`);
    console.log(`   ${cell(finding.japanese, 46)} ${cell(finding.english, 54)}`
        + ` -> ${JSON.stringify(finding.fixed)}`);
};

await run(async () => {
    const scene = flagValue("scene");
    const only = flagValue("bucket");
    if (only && !BUCKETS.includes(only)) {
        console.error(`--bucket takes one of ${BUCKETS.join(", ")}.`);
        return 1;
    }
    const limit = flagValue("limit") === undefined ? 8 : Number(flagValue("limit"));
    const write = hasFlag("write");
    const textLang = textLangName();

    const {scenes, rows, findings, pushed, heldTabs} = await findSpeechIndent(textLang, scene);
    if (!scenes) {
        console.log(scene
            ? `text_languages/${textLang}/scenes/ holds no ${scene}.`
            : `text_languages/${textLang}/scenes/ holds no scene files, so there is nothing to read.`);
        return 0;
    }

    const wanted = findings.filter(finding => !only || finding.bucket === only);
    const where = scene ? scene : `the "${textLang}" text language`;
    console.log(`${wanted.length} rows of ${rows} in ${where} do not start where the game's own row does`);
    const counts = countByBucket(wanted);
    for (const name of BUCKETS) {
        if (counts[name]) {
            console.log(`  ${String(counts[name]).padStart(5)}  ${name}`);
        }
    }

    const failed = wanted.filter(finding => !holds(finding.verified));
    if (failed.length) {
        console.log(`${failed.length} of them have a fix that does not verify and are left alone,`
            + " marked !! below.");
    }

    for (const name of BUCKETS) {
        const group = wanted.filter(finding => finding.bucket === name);
        if (!group.length) {
            continue;
        }
        console.log(`\n--- ${group.length} ${name} ---`);
        const shown = scene || only ? group : group.slice(0, limit);
        for (const finding of shown) {
            showFinding(finding);
        }
        if (shown.length < group.length) {
            console.log(`  ... ${group.length - shown.length} more, --bucket=${name} for all of them`);
        }
    }

    // What the pass has no opinion about, counted rather than left unsaid: a
    // report that only names what it changes reads as though the rest of the
    // whitespace had been looked at and found right.
    if (!scene && !only) {
        const {englishOnly, strayAsciiSpace} = await countOppositeIndents(textLang);
        console.log(`\n${englishOnly} rows carry an indent the Japanese does not, and are left:`
            + " layOutSpeech indents every continuation of a quoted speech whatever the row underneath"
            + " says, so most of those are this repository's own layout rather than a fault.");
        console.log(`${strayAsciiSpace} rows open with an ASCII space where the Japanese has no indent.`
            + " That is a stray character rather than an indent written wrong, and nothing in the"
            + " Japanese says what should be there instead.");
    }
    if (heldTabs.length) {
        console.log(`${heldTabs.length} rows open with a tab and were not touched at all:`
            + ` ${heldTabs.slice(0, 8).map(row => `m[${row.lineNumber}]`).join(", ")}.`);
    }

    const doing = wanted.filter(finding => holds(finding.verified));
    if (!doing.length) {
        console.log("\nNothing to write.");
        return 0;
    }

    const byFile = new Map();
    for (const finding of doing) {
        if (!byFile.has(finding.file)) {
            byFile.set(finding.file, new Map());
        }
        byFile.get(finding.file).set(finding.lineNumber, finding.fixed);
    }

    const dir = translatedScenesDir(textLang);
    let written = 0;
    let rowsWritten = 0;
    const refused = [];
    for (const [fileName, edits] of byFile) {
        const file = path.join(dir, fileName);
        const before = await fs.readFile(file, "utf-8");
        const parsed = parseSceneFile(before);
        // The one check that fails when the reader and the writer have drifted
        // apart rather than when the data has.
        if (renderSceneFile(parsed) !== before) {
            refused.push(fileName);
            continue;
        }
        rowsWritten += edits.size;
        ++written;
        if (write) {
            await fs.writeFile(file, renderSceneFile(parsed, edits), "utf-8");
        }
    }

    console.log(`\n${rowsWritten} rows in ${written} scene files`
        + `${write ? " written" : " -- a dry run, nothing written; add --write"}`);
    if (refused.length) {
        console.log(`${refused.length} files did not reproduce themselves and were skipped:`
            + ` ${refused.slice(0, 8).join(", ")}`);
        return 1;
    }

    /*
     * An indent is a character wide, so a speech that fits its window today can
     * stop fitting once it is back. Named rather than quietly accepted, and
     * named last so the number is the thing left on the screen: the overflow
     * was always the game's -- it draws these rows a character further right
     * than the English did -- and what takes it out is a layout,
     * scripts/bake_speech_rows.js, not an edit to this pass.
     */
    if (pushed.length) {
        const drawn = pushed.filter(speech => !speech.draft);
        console.log(`\n--- ${pushed.length} speeches the indent pushes past their window ---`);
        for (const speech of drawn) {
            console.log(`${speech.file} m[${speech.lineNumber}] ${speech.speaker}`
                + ` -- drawn in ${speech.drawn} lines of ${speech.budget},`
                + ` ${speech.after} once the indent is back`);
        }
        if (pushed.length > drawn.length) {
            console.log(`  ... and ${pushed.length - drawn.length} in scenario documents the game`
                + " never draws, which is nobody's overflow.");
        }
        console.log("scripts/find_speech_gaps.js reports these as `overflow` from now on, and"
            + " scripts/bake_speech_rows.js lays the words back into the same rows.");
    }
    return 0;
});
