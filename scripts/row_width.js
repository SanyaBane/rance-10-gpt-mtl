/**
 * How wide one row of the dialogue window is, in ems of the game's own font.
 *
 *   node scripts/row_width.js "「Mother-dono and my aunts will be glad to see you two!"
 *
 * scripts/fit_speech.js answers the question for a whole speech and is what to
 * reach for first. This is for the case it cannot answer: a correction with the
 * same word count keeps the division already on disk, so the layout is never
 * consulted and the only thing to measure is the row itself. Pass the row as it
 * will sit in the file, **leading `　` and all** if it is a continuation.
 *
 *   ems 33.69 drawn 1 |「Mother-dono and my aunts will be glad to see you two!
 *
 * The window draws about **36.0 em** to a row and the backlog's edge is
 * **35.39**, which is the stricter of the two, so aim at 35.3 or less. But
 * **`drawn` counts by words rather than by width**: a row at 35.5 em can draw in
 * one line and one at 34.9 in two, because a word did not fit. Measure, do not
 * estimate.
 *
 * The tracking is the dialogue window's own -- modules/GameFont.js's
 * `trackingFor` takes a layout's 字間隔, and docs/text-width.md says why passing
 * the default instead is the mistake that made 597 synopsis lines look fine.
 */
import {em, gameTextWidth, trackingFor} from "../modules/GameFont.js";
import {drawnLines, WINDOW_ROW} from "../modules/SpeechRows.js";

/** The message window's part and its 字間隔, out of archives/Rance10Pact_v1_04/. */
const TRACKING = trackingFor(2, 40);

const rows = process.argv.slice(2);
if (!rows.length) {
    console.error("usage: node scripts/row_width.js <row> [row ...]");
    process.exit(2);
}

console.log(`window row ems: ${(gameTextWidth(WINDOW_ROW, TRACKING) / em()).toFixed(2)}`);
for (const row of rows) {
    console.log(`ems ${(gameTextWidth(row, TRACKING) / em()).toFixed(2)}`
        + ` drawn ${drawnLines([row])} |${row}`);
}
