/**
 * Deciding whether a translated scene may be written back.
 *
 * A scene is the unit: all of it is accepted or none of it is. That is not
 * tidiness, it is the only shape that makes a declined translation harmless.
 * The game is handed one English line per m[] number, so a scene that came back
 * short does not lose its tail -- it shifts it, and every line after the gap
 * goes out under the previous line's number. 158 lines of six scenes played one
 * line out of step that way until eec7f479, and that was a merge in the corpus
 * rather than a translator stopping halfway.
 *
 * Which is the case this exists for. A translator asked to render Rance 10 will
 * decline some of it, and the failure worth designing against is not the clean
 * refusal -- it is the scene that runs as ordinary dialogue for two hundred
 * lines, turns explicit, and comes back translated up to that point. There is
 * nothing in the text of such an answer that says it stopped early. Only the
 * line numbers say so, so the line numbers are what is checked.
 *
 * Refusals are recognised by structure, never by scanning the translation for
 * apologetic phrases: a line of dialogue is free to say anything, and a phrase
 * list run over the cells would eventually throw away a good scene because a
 * character said the wrong sentence. What gets looked at is only the part of
 * the answer that did not parse as rows.
 *
 * The file format itself is modules/SceneFile.js. This module only judges.
 */
import {unescapeCell} from "./SceneFile.js";

/** "N<tab>english", or the four-column form when a translator echoes the input. */
const ROW = /^(\d+)\t(.*)$/;

/**
 * A translated line may not carry a raw tab or a line break: the first moves
 * every column after it when the scene is written back, and the second turns
 * one line into two.
 */
const CONTROL = /[\t\r\n]/;

/**
 * How much longer than its draft an accepted line may get before it is worth
 * a second look. Generous on purpose -- English runs wider than Japanese and a
 * short line runs wider still -- because this is a warning and not a verdict.
 */
const LONGER_THAN_DRAFT = 3;

/**
 * Hold what came back against the scene it was asked about.
 *
 * @param {import("./SceneFile.js").parseSceneFile} scene the source scene
 * @param {string} returned the translator's answer, "N<tab>english" per line
 * @return {{
 *     accepted: boolean,
 *     english: Map<number, string>,
 *     problems: string[],
 *     warnings: string[],
 * }}
 */
export const acceptTranslation = (scene, returned) => {
    const problems = [];
    const warnings = [];
    const english = new Map();
    const duplicated = [];
    const unasked = [];
    /** Everything that was not a row, which is where a refusal would be. */
    const prose = [];

    const expected = new Map(scene.rows.map(row => [row.lineNumber, row]));

    for (const line of returned.split(/\r?\n/)) {
        if (!line.trim()) {
            continue;
        }
        const cells = line.split("\t");
        // A translator handed four columns sometimes gives four back. The
        // number is still first and the English still last, so that is
        // readable; anything else is not a row.
        const row = cells.length === 4 && /^\d+$/.test(cells[0])
            ? [line, cells[0], cells[3]]
            : ROW.exec(line);
        if (!row) {
            prose.push(line);
            continue;
        }
        const lineNumber = Number(row[1]);
        if (!expected.has(lineNumber)) {
            unasked.push(lineNumber);
            continue;
        }
        if (english.has(lineNumber)) {
            duplicated.push(lineNumber);
            continue;
        }
        english.set(lineNumber, unescapeCell(row[2]));
    }

    if (english.size === 0) {
        problems.push(prose.length
            ? `no lines came back, only prose: ${JSON.stringify(prose.join(" ").slice(0, 200))}`
            : "no lines came back and nothing was said");
        return {accepted: false, english, problems, warnings};
    }

    const missing = scene.rows.filter(row => !english.has(row.lineNumber)).map(row => row.lineNumber);
    if (missing.length) {
        problems.push(`${missing.length} of ${scene.rows.length} lines missing,`
            + ` from ${missing[0]}: a scene that stops early shifts every line after it`);
        if (prose.length) {
            problems.push(`what was said instead: ${JSON.stringify(prose.join(" ").slice(0, 200))}`);
        }
    }
    if (duplicated.length) {
        problems.push(`${duplicated.length} line numbers came back twice, from ${duplicated[0]}`);
    }
    if (unasked.length) {
        problems.push(`${unasked.length} line numbers this scene never had, from ${unasked[0]}`);
    }

    for (const [lineNumber, text] of english) {
        const row = expected.get(lineNumber);
        if (CONTROL.test(text)) {
            problems.push(`line ${lineNumber} holds a tab or a line break`);
        }
        if (!text && row.japanese) {
            problems.push(`line ${lineNumber} came back empty for ${JSON.stringify(row.japanese)}`);
        }
        if (row.english && text.length > row.english.length * LONGER_THAN_DRAFT) {
            warnings.push(`line ${lineNumber} is ${Math.round(text.length / row.english.length)}x`
                + " the draft's length -- a note to the reader rather than a translation?");
        }
    }

    // Prose alongside a complete answer is a preamble, not a refusal, and the
    // rows are all there -- worth saying once, not worth rejecting over.
    if (prose.length && !problems.length) {
        warnings.push(`${prose.length} lines of the answer were not rows and were ignored`);
    }

    return {accepted: problems.length === 0, english, problems, warnings};
};
