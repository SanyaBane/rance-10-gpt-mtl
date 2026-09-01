/**
 * Put the ■歴史枠 chronology back into the shape its Japanese states.
 *
 *   node scripts/relayout_chronology.js            # what it would do
 *   node scripts/relayout_chronology.js --write    # do it
 *   node scripts/relayout_chronology.js --samples=8
 *
 * The chronology is not prose. Its 311 rows are a table the Japanese draws with
 * full-width spaces: a year with no indent, an event's name under it at two, the
 * event itself at four, and a blank row between entries. 18 speeches, one per
 * year, 15 to 18 rows each.
 *
 * `scripts/bake_speech_rows.js` flattened it on 2026-08-29. The rows were in the
 * report's `overflow` class at the time -- a 24-wide question asked about a
 * 40-wide box, which `f48086c4d` held off two days later -- so the bake did what
 * it does to a speech that does not fit: joined every word of all 18 rows and
 * divided them evenly. That is right for a bubble and wrong for a table. 261 of
 * the 311 rows moved and 243 lost the indent that says what they are, so a year
 * heading ended up carrying the tail of the previous entry's sentence.
 *
 * Reverting is not the fix either, and the numbers say so plainly: before the
 * bake 105 of the 311 rows ran past the frame's 40 characters and the widest was
 * 84.1, more than two rows' worth on one row. **Neither state in the history is
 * right** -- one has the structure and the wrong widths, the other the widths
 * and no structure. So this takes the structure from the first and the width
 * from the second.
 *
 * The unit of layout is not the speech. It is a **run of consecutive rows at the
 * same indent**: one row for a year, one for an event's name, two to four for
 * its body. Each unit's English is balanced across that unit's own rows and
 * every row keeps the indent of the Japanese it sits on, so a heading stays a
 * heading. modules/SpeechRows.js's `balanceAcross` does the dividing -- the same
 * minimax the speeches use, in the frame's own tracking rather than the
 * window's, which is the only part these two layouts share.
 *
 * The English comes from the commit before the bake, because that is the only
 * place the words are still grouped by unit: the bake preserved word order
 * across a whole speech but not which words belonged to which row, and nothing
 * has touched the chronology since -- all 311 rows are still exactly what the
 * bake wrote, checked before this was written. So no later work is thrown away.
 *
 * What it cannot do is make the English fit. 47 of the 140 units hold more than
 * their own rows can draw at 40 characters, one of them 180 characters where it
 * has 107, and no division of those words helps: that is a translation nearly
 * twice the length of its Japanese and wants shortening by meaning. Those are
 * named at the end of a run rather than cut, the same way the synopsis panel and
 * the `overflow` class name theirs.
 *
 * Two gates, the ones every writer here stands on. The words come back in the
 * same order, per unit, which is asserted rather than assumed even though
 * `balanceAcross` can only cut a word list into runs. And the file has to
 * reproduce itself through the parser before anything is written.
 */
import * as fs from "fs/promises";
import * as path from "path";
import {execFile} from "child_process";
import {promisify} from "util";
import {run} from "../modules/AliceTools.js";
import {flagValue, hasFlag} from "../modules/Argv.js";
import {ROOT} from "../modules/Env.js";
import {gameTextWidth, em} from "../modules/GameFont.js";
import {parseSceneFile, renderSceneFile} from "../modules/SceneFile.js";
import {translatedScenesDir} from "../modules/SceneTranslations.js";
import {
    balanceAcross, HISTORY_FRAME, historyFrameTracking, inHistoryFrame,
} from "../modules/SpeechRows.js";
import {textLangName} from "../modules/TextLanguages.js";

/**
 * The commit before `d4dfe0661` flattened the chronology, which is where the
 * English is still one row per Japanese row.
 *
 * A revision rather than a file because there is nowhere else it survives, and
 * a constant rather than a flag because there is exactly one right answer: the
 * chronology exists once in the game and this repairs it once. Re-running reads
 * the same revision and writes the same rows, so it is safe to run twice.
 */
const BEFORE_THE_BAKE = "d8a6d613d";

/** Leading full-width spaces: what the Japanese says a row is. */
const indentOf = (text) => (/^　*/.exec(text) ?? [""])[0];

const wordsOf = (text) => text.trim().split(/\s+/).filter(Boolean);

await run(async () => {
    const write = hasFlag("write");
    const samples = Number(flagValue("samples") ?? 4);
    const lang = textLangName();

    const file = path.join(translatedScenesDir(lang), HISTORY_FRAME.file);
    const text = await fs.readFile(file, "utf-8");
    const scene = parseSceneFile(text);
    if (renderSceneFile(scene) !== text) {
        console.error(`${HISTORY_FRAME.file} does not reproduce itself; nothing written.`);
        return 1;
    }

    const {stdout} = await promisify(execFile)("git", [
        "-C", ROOT, "show",
        `${BEFORE_THE_BAKE}:${path.relative(ROOT, file).replaceAll("\\", "/")}`,
    ], {encoding: "utf-8", maxBuffer: 1 << 28});
    const structured = new Map(parseSceneFile(stdout).rows.map(row => [row.lineNumber, row.english]));

    /*
     * The units, read off the Japanese. A row the game left blank closes the
     * open unit and is left exactly as it is -- those are the spacers between
     * entries, and a layout that filled them would run the table together.
     */
    const units = [];
    let open = null;
    for (const row of scene.rows) {
        if (!inHistoryFrame(row.lineNumber)) {
            continue;
        }
        if (!row.japanese.trim()) {
            open = null;
            continue;
        }
        const indent = indentOf(row.japanese);
        if (!open || open.indent !== indent) {
            open = {indent, rows: []};
            units.push(open);
        }
        open.rows.push(row);
    }

    const tracking = historyFrameTracking();
    const EM = em();
    const wide = (row) => gameTextWidth(row, tracking) / EM;

    const edits = new Map();
    const tooLong = [];
    const shown = [];
    let laidOut = 0;
    let unchanged = 0;
    let tooFewWords = 0;

    for (const unit of units) {
        const words = wordsOf(unit.rows.map(row => structured.get(row.lineNumber) ?? "").join(" "));
        if (!words.length) {
            continue;
        }
        if (words.length < unit.rows.length) {
            // One word per row and the rest empty is not a layout, it is a
            // shorter translation, which is somebody's decision and not this
            // pass's -- the same rule bake_speech_rows keeps.
            ++tooFewWords;
            continue;
        }

        const divided = balanceAcross(words, unit.rows.length, tracking);
        const rows = divided.map((row, at) => indentOf(unit.rows[at].japanese) + row);

        // The gate the layout does not get to vote on.
        if (wordsOf(rows.join(" ")).join(" ") !== words.join(" ")) {
            console.error(`  m[${unit.rows[0].lineNumber}]: the layout did not give the words back`);
            return 1;
        }

        const widest = Math.max(...rows.map(wide));
        if (widest > HISTORY_FRAME.width) {
            tooLong.push({at: unit.rows[0].lineNumber, rows: rows.length, widest, text: words.join(" ")});
        }

        const moved = unit.rows.filter((row, at) => row.english !== rows[at]);
        if (!moved.length) {
            ++unchanged;
            continue;
        }
        ++laidOut;
        unit.rows.forEach((row, at) => {
            if (row.english !== rows[at]) {
                edits.set(row.lineNumber, rows[at]);
            }
        });
        if (shown.length < samples) {
            shown.push(`  m[${unit.rows[0].lineNumber}], ${rows.length} rows at indent`
                + ` ${unit.indent.length}`
                + unit.rows.map((row, at) => `\n    ${JSON.stringify(row.english)}`
                    + `\n      -> ${JSON.stringify(rows[at])}`).join(""));
        }
    }

    const inFrame = scene.rows.filter(row => inHistoryFrame(row.lineNumber));
    console.log(`${units.length} units over ${inFrame.length} rows of ${HISTORY_FRAME.file}`);
    console.log(`  ${laidOut} units laid out, ${edits.size} rows, ${unchanged} already lie that way`);
    if (tooFewWords) {
        console.log(`  ${tooFewWords} units have fewer words than rows and were left alone`);
    }
    shown.forEach(line => console.log(line));

    if (tooLong.length) {
        console.warn(`\n  ${tooLong.length} units still run past the frame's`
            + ` ${HISTORY_FRAME.width} characters afterwards -- more English than their rows`
            + " can draw whatever the layout, and the only fix is shortening by meaning");
        tooLong.sort((a, b) => b.widest - a.widest);
        for (const unit of tooLong.slice(0, samples)) {
            console.warn(`    m[${unit.at}] ${unit.rows} rows, widest ${unit.widest.toFixed(1)}`
                + ` -- ${unit.text.slice(0, 64)}`);
        }
    }

    if (write && edits.size) {
        const rewritten = renderSceneFile(scene, edits);
        // Parse what is about to be written, not what was read: a row count that
        // moved would shift every line after it rather than lose one.
        const back = parseSceneFile(rewritten);
        if (back.rows.length !== scene.rows.length) {
            console.error("  the row count moved; nothing written");
            return 1;
        }
        await fs.writeFile(file, rewritten, "utf-8");
    }
    console.log(write ? `\n  written into ${path.relative(ROOT, file)}`
        : "\n  a dry run, nothing written; add --write");
    return 0;
});
