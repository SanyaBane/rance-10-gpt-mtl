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
 * year, 140 structural units.
 *
 * `scripts/bake_speech_rows.js` flattened it on 2026-08-29. The rows were in the
 * report's `overflow` class at the time -- a 24-wide question asked about a
 * 40-wide box, which `f48086c4d` held off two days later -- so the bake did what
 * it does to a speech that does not fit: joined every word of all 18 rows and
 * divided them evenly. That is right for a bubble and wrong for a table. 261 of
 * the 311 rows moved and 243 lost the indent that says what they are, so a year
 * heading ended up carrying the tail of the previous entry's sentence.
 *
 * Reverting is not the fix either: before the bake 105 of the 311 rows ran past
 * the box and the widest was 84.1, more than two rows' worth on one row.
 * **Neither state in the history is right** -- one has the structure and the
 * wrong widths, the other the widths and no structure. So this takes the
 * structure from the first and the width from the second.
 *
 * The unit of layout is not the speech. It is a **run of consecutive rows at the
 * same indent**: one row for a year, one for an event's name, two to four for
 * its body. Each unit's English goes into that unit's own rows and every row
 * keeps the indent of the Japanese it sits on, so a heading stays a heading.
 *
 * ## Filled to the box, with the remainder on the last row
 *
 * Every row but the last takes as many words as the box holds; the last takes
 * whatever is left, however much that is.
 *
 * Which is not what the speeches do. `layOutSpeech` minimises the widest row, so
 * a unit with too much English spreads the excess evenly and **every** row of it
 * ends up over the edge and cut. Filling instead puts all of the excess in one
 * place: the rows above it are exact, the last one is long and folds, and the
 * entry stays readable down to the point where it runs out of room. A screenshot
 * of the first shape -- six consecutive rows each cut mid-word -- against the
 * second is what settled it.
 *
 * ## The box is the backlog's, not the frame's
 *
 * The frame is 40 characters wide and that is not the number here. Every row the
 * game speaks is replayed in the backlog, which clips at 35.39 ems, so a row
 * built for the frame draws whole in the prologue and is cut in the backlog.
 * Where two boxes draw the same row the narrower one decides, and for dialogue
 * that is always the backlog. `BACKLOG_EDGE` in modules/SpeechRows.js is the
 * measurement and docs/message-window.md is how it was taken.
 *
 * Measured with `gameTextWidth` in the backlog's own tracking, which is also
 * what the build folds these rows with -- `wrapToEms`. One instrument for the
 * fill and the fold, because a layout that fits by one measure and a clip that
 * lands by another is how a row ends up over the line by three tenths of a
 * character, which is where the hand-made version of this landed.
 *
 * ## Where the English comes from
 *
 * The commit before the bake, because that is the only place the words are still
 * grouped by unit: the bake preserved word order across a whole speech but not
 * which words belonged to which row. Nothing has touched the chronology since --
 * all 311 rows were still exactly what the bake wrote when this was written --
 * so no later work is thrown away.
 *
 * What it cannot do is make the English fit. 49 of the 140 units hold more than
 * their rows can draw, one of them by a factor of nearly two, and no division of
 * those words helps: that is a translation longer than its Japanese and wants
 * shortening by meaning. A run names them rather than cutting them, the same way
 * the synopsis panel and the `overflow` class name theirs.
 *
 * Two gates, the ones every writer here stands on. The words come back in the
 * same order, per unit, asserted rather than assumed. And the file has to
 * reproduce itself through the parser before anything is written.
 */
import * as fs from "fs/promises";
import * as path from "path";
import {execFile} from "child_process";
import {promisify} from "util";
import {run} from "../modules/AliceTools.js";
import {flagValue, hasFlag} from "../modules/Argv.js";
import {ROOT} from "../modules/Env.js";
import {em, gameTextWidth, wrapToEms} from "../modules/GameFont.js";
import {parseSceneFile, renderSceneFile} from "../modules/SceneFile.js";
import {translatedScenesDir} from "../modules/SceneTranslations.js";
import {
    BACKLOG_EDGE, backlogTracking, HISTORY_FRAME, inHistoryFrame,
} from "../modules/SpeechRows.js";
import {textLangName} from "../modules/TextLanguages.js";

/**
 * The commit before `d4dfe0661` flattened the chronology, which is where the
 * English is still one row per Japanese row.
 *
 * A revision rather than a file because there is nowhere else it survives, and a
 * constant rather than a flag because there is exactly one right answer: the
 * chronology exists once in the game and this repairs it once. Re-running reads
 * the same revision and writes the same rows, so it is safe to run twice.
 */
const BEFORE_THE_BAKE = "d8a6d613d";

/** Leading full-width spaces: what the Japanese says a row is. */
const indentOf = (text) => (/^　*/.exec(text) ?? [""])[0];

const wordsOf = (text) => text.trim().split(/\s+/).filter(Boolean);

/**
 * `count` rows: each filled to `limit` except the last, which takes the rest.
 *
 * No row is ever left empty, whatever the widths say. An empty cell is read by
 * `assemblePatch` as "not translated yet" and falls through to the language
 * underneath, so a row that draws nothing would play in Japanese -- which is why
 * a row never takes a word the rows after it still need.
 *
 * @param {string[]} words
 * @param {number} count
 * @param {string} indent charged against the box on every row, because it is
 * @param {number} limit in the units gameTextWidth returns
 * @param {number} tracking the box's own
 * @return {string[]} exactly `count` strings, none of them empty
 */
const fillRows = (words, count, indent, limit, tracking) => {
    const rows = [];
    let at = 0;
    for (let row = 0; row < count - 1; ++row) {
        const line = [];
        const keepBack = count - row - 1;
        while (at < words.length - keepBack) {
            const grown = [...line, words[at]].join(" ");
            // A single word wider than the box still goes on the row: there is
            // nowhere else for it, and the alternative is an empty row.
            if (line.length && gameTextWidth(indent + grown, tracking) > limit) {
                break;
            }
            line.push(words[at]);
            ++at;
        }
        rows.push(line.join(" "));
    }
    rows.push(words.slice(at).join(" "));
    return rows;
};

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

    const tracking = backlogTracking();
    const EM = em();
    const limit = BACKLOG_EDGE * EM;
    const wide = (row) => gameTextWidth(row, tracking) / EM;

    const edits = new Map();
    const overflowing = [];
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

        const filled = fillRows(words, unit.rows.length, unit.indent, limit, tracking);
        const rows = filled.map((row, at) => indentOf(unit.rows[at].japanese) + row);

        // The gate the layout does not get to vote on.
        if (wordsOf(rows.join(" ")).join(" ") !== words.join(" ")) {
            console.error(`  m[${unit.rows[0].lineNumber}]: the layout did not give the words back`);
            return 1;
        }

        const last = rows[rows.length - 1];
        if (wide(last) > BACKLOG_EDGE) {
            overflowing.push({
                at: unit.rows[0].lineNumber,
                rows: rows.length,
                width: wide(last),
                drawn: wrapToEms(last, BACKLOG_EDGE, tracking).split("\n").length,
                text: last.trim(),
            });
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
                + rows.map((row, at) => `\n    ${wide(row).toFixed(1).padStart(5)}`
                    + ` ${JSON.stringify(row)}`).join(""));
        }
    }

    const inFrame = scene.rows.filter(row => inHistoryFrame(row.lineNumber));
    console.log(`${units.length} units over ${inFrame.length} rows of ${HISTORY_FRAME.file},`
        + ` filled to the backlog's ${BACKLOG_EDGE}`);
    console.log(`  ${laidOut} units laid out, ${edits.size} rows, ${unchanged} already lie that way`);
    if (tooFewWords) {
        console.log(`  ${tooFewWords} units have fewer words than rows and were left alone`);
    }
    shown.forEach(line => console.log(line));

    if (overflowing.length) {
        const lines = overflowing.reduce((sum, unit) => sum + unit.drawn - 1, 0);
        console.warn(`\n  ${overflowing.length} units hold more English than their rows draw, so`
            + ` their last row runs long and the build folds it into ${lines} more lines than`
            + " the bytecode gave them. The rows above it are exact; only the tail is over."
            + " Shortening those by meaning is the only thing that takes the fold out.");
        overflowing.sort((a, b) => b.width - a.width);
        for (const unit of overflowing.slice(0, samples)) {
            console.warn(`    m[${unit.at}] ${unit.rows} rows, last row ${unit.width.toFixed(1)}`
                + ` over ${BACKLOG_EDGE}, drawn in ${unit.drawn} -- ${unit.text.slice(0, 58)}`);
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
