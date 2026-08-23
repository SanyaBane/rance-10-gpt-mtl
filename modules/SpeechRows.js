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
import {gameTextWidth} from "./GameFont.js";
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
const drawnLines = (rows) => rows.reduce((sum, row) =>
    sum + (row.trim() ? wrapAt(row, LONGEST_DIALOGUE_LINE).split("\n").length : 1), 0);

/**
 * The window's own row, as a string rather than a number, the way
 * modules/SceneAcceptance.js and modules/SummaryLines.js both state a width:
 * twenty-four full-width characters is what `MessageWindow02`'s placeholder
 * carries and what docs/message-window.md settled.
 */
export const WINDOW_ROW = "あ".repeat(24);

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
 * @param {string[]} words
 * @param {number} count
 * @return {string[]} exactly `count` strings, none of them empty
 */
const balance = (words, count) => {
    const space = gameTextWidth(" ");
    const upTo = [0];
    for (const word of words) {
        upTo.push(upTo[upTo.length - 1] + gameTextWidth(word));
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
    const budget = Math.max(count, WINDOW_ROWS);
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

    const rows = balance(words, count);
    if (OPENS_QUOTED.test(text)) {
        for (let i = 1; i < rows.length; i++) {
            rows[i] = INDENT + rows[i];
        }
    }
    return answer(rows, false);
};
