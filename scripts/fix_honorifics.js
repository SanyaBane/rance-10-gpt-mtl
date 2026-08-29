/**
 * Give a speech back the honorific its Japanese wrote, one bucket at a time.
 *
 *   node scripts/fix_honorifics.js --bucket=sama            # what it would do
 *   node scripts/fix_honorifics.js --bucket=sama --write    # do it
 *
 * scripts/find_honorific_drift.js is the report and modules/HonorificDrift.js
 * is the question; this writes what the report already showed, and only from
 * the buckets the Japanese decides on its own. One bucket per run, because one
 * class of edit per commit is what makes the count of changed m[] numbers
 * something a person can hold against the count of edits.
 *
 * Three gates stand in front of every write, and none of them trusts the rule
 * that made the edit:
 *
 * **The row has to verify.** `holds()` asks the row the fix produced -- its
 * length is the arithmetic of the substitutions, its brackets are in the same
 * order, its leading indent is the same bytes, no title survives and no
 * honorific is doubled. A row that fails is left exactly as it was and counted
 * at the end.
 *
 * **The file has to round-trip.** Before anything is written, the scene is
 * parsed and rendered back with no edits and compared with the bytes on disk.
 * A scene tree is not uniform in its line endings and trailing tabs by
 * assumption, it is uniform by measurement, and a writer that assumes
 * reformats five thousand files to change one cell.
 *
 * **The row is spliced, not laid out again.** The words of a speech may be
 * moved between its rows freely and the number of rows may not, but neither is
 * a licence to redraw a bubble nobody complained about: "Lord " is 155 units
 * of the message window's 1194 and "-sama" is 166.75, so a row that fitted
 * before still fits, and the layout the game shipped is left where it is.
 */
import * as fs from "fs/promises";
import * as path from "path";
import {flagValue, hasFlag} from "../modules/Argv.js";
import {run} from "../modules/AliceTools.js";
import {BUCKETS, FIXABLE, findHonorificDrift, holds, rewriteRow} from "../modules/HonorificDrift.js";
import {parseSceneFile, renderSceneFile} from "../modules/SceneFile.js";
import {translatedScenesDir} from "../modules/SceneTranslations.js";
import {textLangName} from "../modules/TextLanguages.js";

await run(async () => {
    const bucket = flagValue("bucket");
    if (!FIXABLE.includes(bucket)) {
        console.error(`--bucket takes one of ${FIXABLE.join(", ")}.`);
        console.error(`The other buckets are for reading, not writing: ${
            BUCKETS.filter(name => !FIXABLE.includes(name)).join(", ")}.`);
        return 1;
    }
    const write = hasFlag("write");
    const lang = textLangName();
    const dir = translatedScenesDir(lang);
    const {findings} = await findHonorificDrift(lang);
    const group = findings.filter(finding => finding.bucket === bucket);
    if (!group.length) {
        console.log(`Nothing in ${bucket}.`);
        return 0;
    }

    const byFile = new Map();
    for (const finding of group) {
        byFile.set(finding.file, [...byFile.get(finding.file) ?? [], finding]);
    }

    let rowsWritten = 0;
    let occurrences = 0;
    const rowsLeft = [];
    const filesLeft = [];
    let filesWritten = 0;

    for (const [file, fixes] of [...byFile].sort()) {
        const on = path.join(dir, file);
        const text = await fs.readFile(on, "utf-8");
        const scene = parseSceneFile(text);
        if (renderSceneFile(scene) !== text) {
            filesLeft.push(file);
            continue;
        }
        const rows = new Map(scene.rows.map(row => [row.lineNumber, row]));
        const byRow = new Map();
        for (const fix of fixes) {
            byRow.set(fix.lineNumber, [...byRow.get(fix.lineNumber) ?? [], fix]);
        }

        const english = new Map();
        for (const [number, onRow] of byRow) {
            const before = rows.get(number).english;
            const after = rewriteRow(before, onRow);
            if (!holds(before, after, onRow)) {
                rowsLeft.push(`${file} m[${number}]`);
                continue;
            }
            english.set(number, after);
            rowsWritten++;
            occurrences += onRow.length;
        }
        if (!english.size) {
            continue;
        }
        filesWritten++;
        if (write) {
            await fs.writeFile(on, renderSceneFile(scene, english), "utf-8");
        }
    }

    console.log(`${bucket}: ${occurrences} of ${group.length} occurrences${write ? " written" : " ready"}`
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
