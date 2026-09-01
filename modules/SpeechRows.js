/**
 * Dividing one translated speech across the rows the bytecode gave it.
 *
 * A speech is a run of `m[]` rows joined by `message::detail::R`, ended by
 * `message::detail::A`, which is where the click is. So the rows of one speech
 * are all on screen together and nothing reads one on its own -- the backlog
 * replays the same rows and the game has no voice to fall out of step with.
 * `docs/message-window.md` is where that was established.
 *
 * Which is what makes this module possible at all: the division is ours to
 * choose. The Japanese division is where Japanese typesetting fell at
 * twenty-four full-width characters, not a statement about pacing, and English
 * built to mirror it would have to distort its own word order to do so. So the
 * translator is handed a speech and writes English; this puts the English back
 * into the rows, by width, and never moves a word past another.
 *
 * The count is not negotiable. `MSG` operands cannot be added or removed, and a
 * speech that comes back with the wrong number of rows does not lose its tail,
 * it shifts it -- 158 lines across six scenes once played a line out of step
 * that way (`docs/corpus-alignment.md`). So this always returns exactly the
 * rows it was asked for, and says separately whether they fit.
 */
import {em, gameTextWidth, trackingFor} from "./GameFont.js";
import {LONGEST_DIALOGUE_LINE, wrapAt} from "./TextNormalization.js";

/**
 * The window draws three rows at a time, so a speech of fewer than three rows
 * still has three to be drawn in: a single `m[]` wider than one row is folded
 * by the build rather than clipped, and three folded lines still fit the box.
 * The budget is the greater of the two because the Japanese count is by
 * definition acceptable -- the game shipped it, and 1241 of its own speeches
 * run past three rows.
 */
const WINDOW_ROWS = 3;

/**
 * How many lines the build will actually draw this speech in.
 *
 * Asked of `wrapAt` rather than of `gameTextWidth`, because the question is not
 * how wide the row is but what the build will do with it, and the build folds
 * dialogue on `getTextWidth` -- Meiryo, whose proportions are not the game's.
 * Two opinions about the width would let this pass a speech the build then
 * splits. modules/SceneAcceptance.js counts the same way for the same reason.
 */
export const drawnLines = (rows) => rows.reduce((sum, row) =>
    sum + (row.trim() ? wrapAt(row, LONGEST_DIALOGUE_LINE).split("\n").length : 1), 0);

/**
 * The lines a speech of this many rows is allowed to draw in.
 *
 * Exported beside drawnLines because modules/SpeechGaps.js asks the same
 * question of rows this module did not lay out -- whether what the draft
 * already has fits -- and a second copy of either half is a second opinion
 * about the window.
 */
export const rowBudget = (count) => Math.max(count, WINDOW_ROWS);

/**
 * Whether the build will fold any of these rows into a second drawn line.
 *
 * A fold is not an overflow: three rows folded into four still fit a window
 * that draws four, so nothing is lost and `rowBudget` has no complaint. What
 * the player gets is the tail of a row alone on a line of its own -- `world,`
 * under a full row, in the backlog most of all, where every speech is on the
 * screen at once and the ragged one is the one the eye lands on.
 */
export const folds = (rows) => drawnLines(rows) > rows.length;

/**
 * The backlog's own tracking and the edge it stops drawing at, in ems.
 *
 * `字間隔 2` at `フォントサイズ 40`, from `SYS_通常テキスト` in
 * `archives/Rance10Pact_v1_04/Asra/バックログ.pactex.x`, and an edge measured
 * with rulers rather than read off the layout: `[35.39, 35.54)`, the lower end
 * of which is what a budget is held to. docs/message-window.md has both.
 *
 * This is the binding box and the ordinary window is not: at any width the
 * backlog allows, the widest row the build emits is about 33.5 against that
 * window's own edge of 38.4. So a row that clears the backlog clears both.
 */
const BACKLOG_EDGE = 35.39;

/**
 * Whether the backlog would cut this row's tail off.
 *
 * Asked of `gameTextWidth` where `drawnLines` asks `wrapAt`, and the two
 * instruments disagree on purpose: the build decides a fold in Meiryo and the
 * game decides a clip in its own font, so a layout that only satisfied the
 * first can hand back a row nothing folds and the backlog then cuts. That is
 * the whole reason this exists -- m[193935] balances to 35.9 ems, which draws
 * whole in the window and loses its last letter in the backlog. Trading a
 * ragged line for a lost one is not a fix.
 *
 * Read lazily, like everything else that touches the font table: `em()` opens
 * a file, and a module that measured at import would break a fresh clone whose
 * table has not been generated yet.
 */
export const clipsInBacklog = (row) =>
    gameTextWidth(row, trackingFor(2, 40)) > BACKLOG_EDGE * em();

/**
 * The window's own row, as a string rather than a number, the way
 * modules/SceneAcceptance.js and modules/SummaryLines.js both state a width:
 * twenty-four full-width characters is what `MessageWindow02`'s placeholder
 * carries and what docs/message-window.md settled.
 */
export const WINDOW_ROW = "あ".repeat(24);

/**
 * The third box, and the one a switch on viewType cannot find.
 *
 * `CALLFUNC ■歴史枠` puts `MessageWindowHistory` up once in the whole 60 MB of
 * bytecode -- in 033026.tsv, ６０１／プロローグ, for the chronology of everything
 * since Rance became Demon King. Its placeholder states 40 characters by 18
 * rows, and the game's own Japanese runs to 41 there. docs/message-window.md
 * has the reading.
 *
 * **The range ends where the scene does.** It was written as m[193987]..m[194532]
 * from where `■枠消し` was read in the bytecode, and 033026.tsv's own rows stop at
 * m[194297]: the 235 numbers past that belong to 033027.tsv, ６０１／少年の旅立ち,
 * which is Crook waking a boy up in an ordinary window. That cost nothing while
 * the only caller also checked the file name, and became live the moment the
 * build started asking by number alone -- 235 rows of ordinary dialogue wrapped
 * against a 40-wide box they are not in. A range that is only right because
 * something else is narrowing it is not a range.
 *
 * Here rather than in modules/SpeechGaps.js, which is where the range used to
 * live, because three callers now need it and each had a reason to disagree
 * about a digit: the report holds these rows out of the width classes, the
 * build has to wrap them against this box rather than the dialogue window's,
 * and scripts/relayout_chronology.js lays them out inside it.
 */
export const HISTORY_FRAME = {
    file: "033026.tsv",
    from: 193987,
    to: 194297,
    rows: 18,
    width: 40,
    /** `フォントサイズ` and `字間隔`, from the part's own layout. */
    fontSize: 50,
    spacing: -2,
};

export const inHistoryFrame = (lineNumber) =>
    lineNumber >= HISTORY_FRAME.from && lineNumber <= HISTORY_FRAME.to;

/** The frame's own tracking, read lazily for the reason clipsInBacklog is. */
export const historyFrameTracking = () =>
    trackingFor(HISTORY_FRAME.spacing, HISTORY_FRAME.fontSize);

/**
 * The frame's row as a string, the way WINDOW_ROW is the window's -- which is
 * how a width reaches `wrapAt`, since that measures a reference rather than
 * taking a number.
 */
export const HISTORY_FRAME_ROW = "あ".repeat(HISTORY_FRAME.width);

/** Whether a row is wider than the frame the chronology is drawn in. */
export const runsPastHistoryFrame = (row) =>
    gameTextWidth(row, historyFrameTracking()) > HISTORY_FRAME.width * em();

/**
 * The indent a continuation row carries inside a quote. The game writes a
 * full-width space at the start of every row of a speech after the first when
 * that speech opened with a bracket, so the text sits under the 「 rather than
 * flush against the window edge.
 */
const INDENT = "　";

/** The brackets whose continuation rows are indented. 「 for speech, （ for a thought. */
const OPENS_QUOTED = /^[「（]/;

/**
 * Every way to cut `words` into exactly `count` non-empty runs, scored by the
 * widest run, and the best one.
 *
 * Minimising the widest row rather than filling greedily from the top is the
 * whole point. Greedy packing puts everything it can in row one and leaves the
 * last row holding whatever is left, which is the shape the existing draft has
 * and the shape that overflows: `m[43]` is three Japanese rows poured into one
 * English row plus an empty one. Balanced rows are also what the window was
 * drawn for -- three rows of similar length read as a paragraph, one long row
 * over two short ones reads as a mistake.
 *
 * O(words^2 * count) comparisons, but each is arithmetic rather than another
 * measurement: `gameTextWidth` is a plain per-character sum of an advance plus
 * the tracking, so the width of a run is the sum of its words plus one space
 * apiece and a prefix sum answers it exactly. Measuring each candidate run
 * instead makes this the slowest thing in a build -- the whole draft is 166 173
 * speeches. If that function ever learns kerning, this stops being exact and
 * has to go back to asking it.
 *
 * Exported because the chronology is laid out with it and is not a speech:
 * scripts/relayout_chronology.js balances each of its structural units across
 * that unit's own rows, in a box of its own and with the indent the Japanese
 * carries. What is shared is the division; nothing else about it is.
 *
 * @param {string[]} words
 * @param {number} count
 * @param {number} [tracking] the layout's own, defaulting to gameTextWidth's
 * @return {string[]} exactly `count` strings, none of them empty
 */
export const balanceAcross = (words, count, tracking) => {
    const space = gameTextWidth(" ", tracking);
    const upTo = [0];
    for (const word of words) {
        upTo.push(upTo[upTo.length - 1] + gameTextWidth(word, tracking));
    }
    /** The width of `words[from..to)` written out with single spaces. */
    const runWidth = (from, to) => upTo[to] - upTo[from] + space * (to - from - 1);

    // best[i][k] = the smallest possible widest row, cutting words[i..] into k rows.
    const best = Array.from({length: words.length + 1}, () => new Array(count + 1).fill(Infinity));
    const cut = Array.from({length: words.length + 1}, () => new Array(count + 1).fill(0));
    for (let k = 1; k <= count; k++) {
        for (let i = words.length - 1; i >= 0; i--) {
            const left = words.length - i;
            if (left < k) {
                continue; // not enough words to fill k non-empty rows
            }
            if (k === 1) {
                best[i][1] = runWidth(i, words.length);
                cut[i][1] = words.length;
                continue;
            }
            // take t words for this row, leave the rest for k-1 rows
            for (let t = 1; t <= left - (k - 1); t++) {
                const row = runWidth(i, i + t);
                const rest = best[i + t][k - 1];
                const worst = Math.max(row, rest);
                if (worst < best[i][k]) {
                    best[i][k] = worst;
                    cut[i][k] = i + t;
                }
            }
        }
    }
    const rows = [];
    let at = 0;
    for (let k = count; k >= 1; k--) {
        const to = cut[at][k];
        rows.push(words.slice(at, to).join(" "));
        at = to;
    }
    return rows;
};

/**
 * One speech's English, laid out on the rows the game gave it.
 *
 * `fits` is the answer to a different question from `rows`, and both are always
 * returned: the rows are what goes into the patch either way, because the count
 * is what the bytecode says and a build cannot decline to write a line. What a
 * caller does about a speech that does not fit is report it -- the same shape
 * `renderSummaryTable` uses for the synopsis panel, where the build names the
 * captions somebody has to shorten by meaning rather than cutting them itself.
 *
 * `tooFewWords` is the one case the rows themselves are wrong rather than wide:
 * a speech of three rows and two words cannot fill them, and an empty cell is
 * read by `assemblePatch` as "not translated yet" and falls through to the
 * language underneath. It is left for the caller to complain about, because the
 * fix is a longer translation and not a different layout.
 *
 * @param {string} english one speech, as the translator wrote it
 * @param {number} count how many `m[]` rows the speech has
 * @return {{rows: string[], fits: boolean, tooFewWords: boolean}}
 */
export const layOutSpeech = (english, count) => {
    const text = english.trim();
    const words = text.split(/\s+/).filter(Boolean);
    const budget = rowBudget(count);
    const answer = (rows, tooFewWords) =>
        ({rows, fits: drawnLines(rows) <= budget, tooFewWords});

    if (count <= 1 || words.length <= 1) {
        const rows = [text, ...new Array(Math.max(0, count - 1)).fill("")];
        return answer(rows.slice(0, Math.max(count, 1)), count > 1);
    }

    if (words.length < count) {
        // Nothing to balance: every word on its own row, and the rest empty.
        return answer([...words, ...new Array(count - words.length).fill("")], true);
    }

    const rows = balanceAcross(words, count);
    if (OPENS_QUOTED.test(text)) {
        for (let i = 1; i < rows.length; i++) {
            rows[i] = INDENT + rows[i];
        }
    }
    return answer(rows, false);
};
