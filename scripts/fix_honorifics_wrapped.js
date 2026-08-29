/**
 * The address a row boundary cut in half.
 *
 *   node scripts/fix_honorifics_wrapped.js            # what it would do
 *   node scripts/fix_honorifics_wrapped.js --write    # do it
 *
 * scripts/fix_honorifics.js writes a row at a time and so cannot see an
 * occurrence no row holds: "Lord" ends one row and the name opens the next,
 * which is the `wrapped` bucket and 16 of them. The English wraps where the
 * Japanese does not, so the split is a fact about the layout rather than about
 * the sentence -- and it is what hides a name from every substitution pass this
 * repository has written.
 *
 * The edit is the same edit spread over two rows: the title comes off the end of
 * the first and the honorific goes onto the name at the start of the second.
 * The rows are **not** laid out again where the splice will do, because four of
 * these speeches are the long scenario blobs, one of them 14 rows, and
 * re-flowing a whole bubble to move five characters buries the change it was
 * asked to make.
 *
 * Which leaves the width to answer for, because this is the one honorific edit
 * that does not keep it: the first row gives up `Lord ` and the second takes
 * `-sama`, so the growth lands entirely on the second. The question asked is
 * the report's own -- `drawnLines` against `rowBudget`, over the whole speech --
 * and not whether some row is wide, because ten of these sit in blobs whose
 * rows run to twice the window before anything is edited. **A speech already
 * over the window is not made worse by eleven units; a speech that fitted and
 * then does not is a fault this pass created.** Only the second gets the
 * fallback, which is `layOutSpeech` over the same rows -- the same balancing
 * scripts/bake_speech_rows.js does, and justified here because the text of the
 * speech genuinely changed.
 *
 * **A rank is not a name.** 魔物将軍様 wraps the same way and reads "Lord /
 * Monster General"; the corpus renders that rank plain elsewhere and there is no
 * settled honorific for it, so it is a decision rather than a substitution.
 * This leaves it and says so.
 */
import * as fs from "fs/promises";
import * as path from "path";
import {hasFlag} from "../modules/Argv.js";
import {run} from "../modules/AliceTools.js";
import {readNameIndex} from "../modules/HonorificDrift.js";
import {mentions} from "../modules/NameNormalizer.js";
import {parseSceneFile, renderSceneFile, speechesOf} from "../modules/SceneFile.js";
import {translatedScenesDir} from "../modules/SceneTranslations.js";
import {drawnLines, layOutSpeech, rowBudget} from "../modules/SpeechRows.js";
import {textLangName} from "../modules/TextLanguages.js";

/** "…and so we asked Lady" -- a title with nothing after it but the row's end. */
const TRAILING_TITLE = /(\s*)\b(Lord|Lady)\s*$/;

/** "Anise to become…" -- the name the row after it opens with. */
const LEADING_NAME = /^([\s　]*)([A-Z][A-Za-z]*)(['’]s|['’])?/;

/** A row the game speaks on, as opposed to its own spacing. */
const carriesText = (row) => row.japanese.replace(/[\s　]/g, "") !== "";

const bracketsOf = (text) =>
    [...text].filter(character => "「」『』（）〈〉《》()".includes(character)).join("");

/** Nothing about a rewritten row moved except the substitution. */
const rowHolds = (before, after) =>
    bracketsOf(before) === bracketsOf(after)
    && !after.includes("\t")
    && after.startsWith(before.match(/^[\s　]*/)[0])
    && Boolean(after.trim());

await run(async () => {
    const write = hasFlag("write");
    const lang = textLangName();
    const dir = translatedScenesDir(lang);
    const {byEnglish} = await readNameIndex(lang);
    const files = (await fs.readdir(dir)).filter(name => name.endsWith(".tsv"));

    let spliced = 0;
    let relaid = 0;
    let filesWritten = 0;
    const leftAlone = [];

    for (const file of files) {
        const on = path.join(dir, file);
        const text = await fs.readFile(on, "utf-8");
        const scene = parseSceneFile(text);
        if (renderSceneFile(scene) !== text) {
            leftAlone.push(`${file} -- the file does not reproduce itself`);
            continue;
        }
        const rows = new Map(scene.rows.map(row => [row.lineNumber, row]));
        const english = new Map();
        const readingOf = (number) => english.get(number) ?? rows.get(number).english;

        for (const speech of speechesOf(scene)) {
            if (!/\b(?:Lord|Lady)\b/.test(speech.english)) {
                continue;
            }
            for (let index = 0; index + 1 < speech.rows.length; index++) {
                const first = speech.rows[index];
                const second = speech.rows[index + 1];
                const title = TRAILING_TITLE.exec(readingOf(first));
                const name = LEADING_NAME.exec(readingOf(second));
                if (!title || !name) {
                    continue;
                }
                const at = `${file} m[${first}]/${second}`;
                const [, indent, spelling, possessive = ""] = name;
                const japanese = byEnglish.get(spelling);
                if (!japanese) {
                    leftAlone.push(`${at} -- "${title[2]} ${spelling}" names nothing a table holds`);
                    continue;
                }
                const says = (suffix) => japanese.some(one => mentions(speech.japanese, one + suffix));
                const suffix = says("様") || says("さま") ? "-sama" : says("殿") ? "-dono" : null;
                if (!suffix) {
                    leftAlone.push(`${at} -- the speech carries no honorific for ${spelling}`);
                    continue;
                }

                const was = speech.rows.map(readingOf);
                const edited = new Map([
                    [first, readingOf(first).replace(TRAILING_TITLE, "")],
                    [second, readingOf(second).replace(LEADING_NAME,
                        `${indent}${spelling}${suffix}${possessive}`)],
                ]);
                if (![first, second].every(number => rowHolds(readingOf(number), edited.get(number)))) {
                    leftAlone.push(`${at} -- the rewritten rows do not verify`);
                    continue;
                }

                const now = speech.rows.map(number => edited.get(number) ?? readingOf(number));
                const budget = rowBudget(speech.rows.length);
                const fitted = drawnLines(was) <= budget;
                let how = "spliced";
                let written = now;

                if (fitted && drawnLines(now) > budget) {
                    // The splice pushed a speech that fitted over the window.
                    // Balance the same words across the same rows instead.
                    const spoken = speech.rows.filter(number => carriesText(rows.get(number)));
                    if (spoken.length !== speech.rows.length) {
                        leftAlone.push(`${at} -- would overflow, and the speech has rows the game leaves blank`);
                        continue;
                    }
                    const joined = now.reduce((all, row) =>
                        all + (all && row ? " " : "") + row.replace(/^　/, ""), "");
                    const laid = layOutSpeech(joined, spoken.length);
                    if (!laid.fits) {
                        leftAlone.push(`${at} -- would overflow, and laying it out again does not fit either`);
                        continue;
                    }
                    written = laid.rows;
                    how = "laid out again";
                }

                speech.rows.forEach((number, atRow) => english.set(number, written[atRow]));
                how === "spliced" ? spliced++ : relaid++;
                console.log(`${at}  ${title[2]} ${spelling}${possessive} -> ${spelling}${suffix}${possessive}  (${how})`);
                for (let row = 0; row < was.length; row++) {
                    if (was[row] !== written[row]) {
                        console.log(`    ${JSON.stringify(was[row])}`);
                        console.log(` -> ${JSON.stringify(written[row])}`);
                    }
                }
            }
        }

        if (english.size) {
            filesWritten++;
            if (write) {
                await fs.writeFile(on, renderSceneFile(scene, english), "utf-8");
            }
        }
    }

    console.log(`\n${spliced + relaid} wrapped addresses${write ? " mended" : " ready"}`
        + ` in ${filesWritten} scenes -- ${spliced} spliced, ${relaid} laid out again`);
    if (leftAlone.length) {
        console.log(`\n${leftAlone.length} left alone:`);
        for (const one of leftAlone) {
            console.log(`  ${one}`);
        }
    }
    if (!write) {
        console.log(`\nNothing written. Add --write.`);
    }
    return 0;
});
