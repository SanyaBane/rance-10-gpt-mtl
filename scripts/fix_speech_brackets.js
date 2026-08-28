/**
 * Put back the brackets a speech's English lost, one bucket at a time.
 *
 *   node scripts/fix_speech_brackets.js --bucket=closing-lost           # what it would do
 *   node scripts/fix_speech_brackets.js --bucket=closing-lost --write   # do it
 *
 * scripts/find_speech_brackets.js is the report and modules/SpeechBrackets.js
 * is the question; this writes what the report already showed. One bucket per
 * run, because one class of edit per commit is what makes the count of changed
 * m[] numbers something a person can check against the count of edits.
 *
 * Two gates stand in front of every write, and neither of them trusts the rule
 * that made the edit:
 *
 * **The speech has to verify.** `holds()` asks the rows the fix produced -- the
 * brackets in the same order as the Japanese, nothing else on the rows moved,
 * no row left empty. A speech that fails is left exactly as it was and named at
 * the end. A speech inside a shifted run never gets a fix offered at all.
 *
 * **The file has to round-trip.** Before anything is written, the scene is
 * parsed and rendered back with no edits and compared with the bytes on disk.
 * The line endings and the trailing tabs are not uniform across a scene tree by
 * assumption, they are uniform by measurement, and a writer that assumes it
 * reformats five thousand files to change one cell. If a file does not
 * reproduce itself, it is skipped and said so.
 */
import * as fs from "fs/promises";
import * as path from "path";
import {flagValue, hasFlag} from "../modules/Argv.js";
import {run} from "../modules/AliceTools.js";
import {parseSceneFile, renderSceneFile} from "../modules/SceneFile.js";
import {translatedScenesDir} from "../modules/SceneTranslations.js";
import {BUCKETS, findSpeechBrackets, holds} from "../modules/SpeechBrackets.js";
import {textLangName} from "../modules/TextLanguages.js";

await run(async () => {
    const bucket = flagValue("bucket");
    if (!BUCKETS.includes(bucket)) {
        console.error(`--bucket takes one of ${BUCKETS.join(", ")}.`);
        return 1;
    }
    const write = hasFlag("write");
    const textLang = textLangName();
    const {findings} = await findSpeechBrackets(textLang);

    const group = findings.filter(finding => finding.bucket === bucket);
    const doing = group.filter(finding => holds(finding.verified));
    const leftAlone = group.filter(finding => !holds(finding.verified));
    if (!doing.length) {
        console.log(`Nothing in ${bucket} has a fix that verifies.`);
        return 0;
    }

    const byFile = new Map();
    for (const finding of doing) {
        if (!byFile.has(finding.file)) {
            byFile.set(finding.file, new Map());
        }
        const edits = byFile.get(finding.file);
        for (const [lineNumber, text] of finding.edits) {
            edits.set(lineNumber, text);
        }
    }

    const dir = translatedScenesDir(textLang);
    let rows = 0;
    let written = 0;
    const refused = [];
    for (const [fileName, edits] of byFile) {
        const file = path.join(dir, fileName);
        const before = await fs.readFile(file, "utf-8");
        const scene = parseSceneFile(before);
        // The one check that fails when the reader and the writer have drifted
        // apart rather than when the data has, which is the failure that would
        // otherwise reformat the file around the cell being changed.
        if (renderSceneFile(scene) !== before) {
            refused.push(fileName);
            continue;
        }
        rows += edits.size;
        ++written;
        if (write) {
            await fs.writeFile(file, renderSceneFile(scene, edits), "utf-8");
        }
    }

    console.log(`${bucket}: ${doing.length} speeches, ${rows} rows, ${written} scene files`
        + `${write ? " written" : " -- a dry run, nothing written; add --write"}`);
    if (leftAlone.length) {
        console.log(`${leftAlone.length} more in this bucket have no fix that verifies and were left`
            + " alone. scripts/find_speech_brackets.js marks them !!.");
    }
    if (refused.length) {
        console.log(`${refused.length} files did not reproduce themselves and were skipped:`
            + ` ${refused.slice(0, 8).join(", ")}`);
        return 1;
    }
    return 0;
});
