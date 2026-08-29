/**
 * Give a stutter back the word it repeats, after the honorific pass took the
 * title it used to name.
 *
 *   node scripts/fix_honorific_stutters.js            # what it would do
 *   node scripts/fix_honorific_stutters.js --write    # do it
 *
 * modules/HonorificStutter.js is the question and why it is narrow. This is
 * the writer, and it stands behind the same three gates scripts/fix_honorifics.js
 * does, for the same reasons: the row has to verify, the file has to round-trip
 * before anything is written, and the row is spliced rather than laid out
 * again. A stutter fix swaps one letter for another and cannot change a row's
 * width, so the layout the game shipped is left where it is.
 */
import * as fs from "fs/promises";
import * as path from "path";
import {hasFlag} from "../modules/Argv.js";
import {run} from "../modules/AliceTools.js";
import {holds, rewriteRow, stutterFixes} from "../modules/HonorificStutter.js";
import {parseSceneFile, renderSceneFile} from "../modules/SceneFile.js";
import {translatedScenesDir} from "../modules/SceneTranslations.js";
import {textLangName} from "../modules/TextLanguages.js";

await run(async () => {
    const write = hasFlag("write");
    const lang = textLangName();
    const dir = translatedScenesDir(lang);
    const files = (await fs.readdir(dir)).filter(name => name.endsWith(".tsv"));

    let rowsWritten = 0;
    let occurrences = 0;
    let filesWritten = 0;
    const rowsLeft = [];
    const filesLeft = [];

    for (const file of files) {
        const on = path.join(dir, file);
        const text = await fs.readFile(on, "utf-8");
        const scene = parseSceneFile(text);
        if (renderSceneFile(scene) !== text) {
            filesLeft.push(file);
            continue;
        }
        const english = new Map();
        for (const row of scene.rows) {
            const fixes = stutterFixes(row.english);
            if (!fixes.length) {
                continue;
            }
            const after = rewriteRow(row.english, fixes);
            if (!holds(row.english, after, fixes)) {
                rowsLeft.push(`${file} m[${row.lineNumber}]`);
                continue;
            }
            console.log(`  ${file} m[${row.lineNumber}]`);
            console.log(`    - ${row.english.trim()}`);
            console.log(`    + ${after.trim()}`);
            english.set(row.lineNumber, after);
            rowsWritten++;
            occurrences += fixes.length;
        }
        if (!english.size) {
            continue;
        }
        filesWritten++;
        if (write) {
            await fs.writeFile(on, renderSceneFile(scene, english), "utf-8");
        }
    }

    console.log(`\n${occurrences} stutters${write ? " written" : " ready"}`
        + `, on ${rowsWritten} rows in ${filesWritten} scenes`);
    if (rowsLeft.length) {
        console.log(`\n${rowsLeft.length} rows left alone -- the fix did not verify:`);
        for (const row of rowsLeft) {
            console.log(`  ${row}`);
        }
    }
    if (filesLeft.length) {
        console.log(`\n${filesLeft.length} scenes left alone -- the file does not reproduce itself:`);
        for (const file of filesLeft) {
            console.log(`  ${file}`);
        }
    }
    if (!write) {
        console.log(`\nNothing written. Add --write.`);
    }
    return 0;
});
