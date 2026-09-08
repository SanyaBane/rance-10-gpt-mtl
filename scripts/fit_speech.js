/**
 * Whether a correction would fit the window it is going into.
 *
 *   node scripts/fit_speech.js 033009 192985 "「Mother-dono and my aunts will be glad to see you two! Gwah hahahahahahaha!」"
 *
 * The acceptance refuses a correction that draws in more lines than the game
 * gave the speech, or that the backlog would clip. This asks the same question
 * before the answer file is written, which is the difference between mending a
 * refusal by shortening the line and finding out about it afterwards.
 *
 *   033009/192985: rows 2, drawn 2, fits true, clipped 0
 *
 * **`drawn` is the number to read, and the target is the row count the game
 * gave.** `clipped` above zero means the backlog cuts it. The rows are printed
 * as the layout would divide them, so a row that is obviously the culprit shows
 * itself -- and scripts/row_width.js measures one of them on its own.
 *
 * The trap this cannot see is `keepDivision`: a correction with **exactly as
 * many words** as the speech it replaces keeps the division already on disk
 * rather than being laid out again, so a row that gained a `-sama` can still
 * overflow while this prints `fits true`. When that happens, measure the row.
 * The same rule is worth having on purpose -- an equal word count is how a
 * correction to one row of a hand-formatted block leaves the other rows alone.
 */
import {readFileSync} from "fs";
import * as path from "path";
import {ROOT} from "../modules/Env.js";
import {clipsInBacklog, drawnLines, layOutSpeech} from "../modules/SpeechRows.js";
import {textLangName} from "../modules/TextLanguages.js";

const [scene, number, ...rest] = process.argv.slice(2);
if (!scene || !number || !rest.length) {
    console.error("usage: node scripts/fit_speech.js <scene> <m[] number> <the whole corrected speech>");
    process.exit(2);
}

const file = path.join(ROOT, "text_languages", textLangName(), "scenes", `${scene}.tsv`);
const lines = readFileSync(file, "utf-8").split(/\r?\n/);
const first = lines.findIndex(line => line.startsWith(`${number}\t`));
if (first < 0) {
    console.error(`${scene}.tsv has no m[${number}]`);
    process.exit(1);
}

/* The speech is its rows up to the blank line, which is the speech boundary. */
let rows = 0;
for (let at = first; at < lines.length && lines[at].trim() !== ""; at += 1) {
    rows += 1;
}

const {rows: laid, fits} = layOutSpeech(rest.join(" "), rows);
console.log(`${scene}/${number}: rows ${rows}, drawn ${drawnLines(laid)}, fits ${fits},`
    + ` clipped ${laid.filter(clipsInBacklog).length}`);
for (const row of laid) {
    console.log(`  |${row}`);
}
