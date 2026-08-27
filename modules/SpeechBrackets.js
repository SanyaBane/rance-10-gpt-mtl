/**
 * The brackets a speech opens and closes with, and where the English lost one.
 *
 * 「かっ……か、かかか、かない！？」 came back as 「W-wife!? -- the opening bracket
 * carried over, the closing one fell off the end. The mirror happens too, and
 * so does losing both. A player sees a bubble that never closes, and the
 * backlog replays it that way.
 *
 * modules/SpeechGaps.js has asked half of this since it was written, and its
 * `bracket` class is where the question lives -- but a speech is reported there
 * once, under the worst class it answers, so a speech that also runs off the
 * window is counted as `overflow` and its missing bracket is invisible. 3635 is
 * a floor rather than a measurement. This module asks the bracket question of
 * every speech, and hands SpeechGaps the answer for the ones it still reports.
 *
 * ## Three rules the check is built on
 *
 * **A symbol is not owed to the English literally unless it is a bracket.**
 * 。！？、… all have to change on the way into English -- `replaceUnicode` turns
 * … into "..." itself -- so a check that asks for the Japanese character back
 * reports every line in the game and buries the ones that matter. Only the
 * paired marks below are owed, and （ is owed as either （ or (, because the
 * draft writes thoughts both ways and modules/SpeechGaps.js already reads both.
 *
 * **The question is asked of the speech, not of the row.** m[12754] and
 * m[12755] are one speech: 「 on the first row, 」 on the second. Asked row by
 * row the first row is missing its closer and the second its opener, and both
 * findings are wrong. A row the game itself left blank is not part of the
 * question either -- 954 speeches hold one, and it owes a translation nothing.
 *
 * **A bracket costs a character.** 」 is +1 on a row that may already be at the
 * edge of the window, so the fix has to be measured as well as made:
 * `overflowsAfter` is the speech that fits today and does not once the bracket
 * is back, and it is reported rather than quietly accepted.
 *
 * ## Where the fix is written
 *
 * On the **English of a row**, glued to a word: the opener to the first row
 * that has English, the closer to the last. Not into a blank row and not as a
 * row of its own, because the row layout is about to be baked into the `.tsv`
 * and a bake moves words between the rows of a speech. A bracket stuck to a
 * word travels with the word; a bracket alone on a row does not survive.
 */
import {speechesOf} from "./SceneFile.js";
import {readTranslatedScenes} from "./SceneTranslations.js";
import {drawnLines, rowBudget} from "./SpeechRows.js";

/**
 * A cell holding nothing but the continuation indent is a blank row wearing a
 * character: it draws as an empty line and `assemblePatch` would read it as
 * translated. modules/SpeechGaps.js takes the same view for the same reason.
 */
export const englishOf = (row) => (row.english.trim() ? row.english : "");

/**
 * Whether the game says anything on this row, which is what decides whether a
 * translation owes it anything. 954 speeches hold a row the game itself left
 * blank -- a beat inside a bubble, or text positioned across the screen with
 * runs of full-width spaces -- and an English cell that is blank there is the
 * faithful answer rather than a gap.
 */
export const carriesText = (row) => Boolean(row.japanese.trim());

/**
 * The paired marks that are owed to the English, and what counts as carrying
 * one over.
 *
 * 〈〉《》【】 are left out on purpose: nothing in the draft loses one, and
 * accepting < > [ ] as their English forms turns `＜エール＞` and every bracketed
 * aside into a finding. ♪ ☆ 〜 are left out for the opposite reason -- they are
 * not paired, so there is no boundary for them to fall off, and 〜 against the
 * ー the draft also writes as ~ is 1482 speeches of noise.
 */
const PAIRS = [
    {open: "「", close: "」"},
    {open: "『", close: "』"},
    {open: "（", close: "）"},
];

/** The English form of a bracket that is not the Japanese character itself. */
const ENGLISH_FORM = new Map([
    ["(", "（"], [")", "）"],
    // A straight or curly double quote stands in for 「」 in 142 speeches. It
    // is its own answer to the question and gets its own bucket, so it is kept
    // as a mark of its own rather than folded into 「」 here.
    ["\"", "\""], ["“", "\""], ["”", "\""],
]);

const OPENERS = PAIRS.map(pair => pair.open).join("");
const CLOSERS = PAIRS.map(pair => pair.close).join("");
const BRACKETS = OPENERS + CLOSERS;

/** Just the brackets of a string, in order: the shape a translation has to keep. */
const japaneseShape = (text) => [...text].filter(char => BRACKETS.includes(char)).join("");

const englishShape = (text) => [...text]
    .map(char => (BRACKETS.includes(char) ? char : ENGLISH_FORM.get(char)))
    .filter(Boolean)
    .join("");

/** `"` alternating open, close, open -- what a draft using straight quotes meant. */
const asJapaneseQuotes = (shape) => {
    let open = true;
    return [...shape].map(char => {
        if (char !== "\"") {
            return char;
        }
        open = !open;
        return open ? "」" : "「";
    }).join("");
};

/** Whether `shape` is `inner` with characters inserted, and nothing removed. */
const holdsAllOf = (shape, inner) => {
    let at = 0;
    for (const char of shape) {
        if (char === inner[at]) {
            ++at;
        }
    }
    return at === inner.length;
};

/**
 * Which bucket the difference between the two shapes falls in, and what to do
 * about it.
 *
 * The first three are decidable without reading the line: the English shape is
 * the Japanese one with a bracket taken off an end, so putting that bracket
 * back is the only edit that makes them agree. The rest name what somebody has
 * to look at.
 */
const classify = (japanese, english) => {
    if (japanese === english) {
        return null;
    }
    if (english.includes("\"")) {
        return asJapaneseQuotes(english) === japanese
            ? {bucket: "straight-quotes", fix: null}
            : {bucket: "other", fix: null};
    }
    const opens = OPENERS.includes(japanese[0]);
    const closes = CLOSERS.includes(japanese[japanese.length - 1]);
    if (closes && english === japanese.slice(0, -1)) {
        return {bucket: "closing-lost", fix: {close: japanese[japanese.length - 1]}};
    }
    if (opens && english === japanese.slice(1)) {
        return {bucket: "opening-lost", fix: {open: japanese[0]}};
    }
    if (opens && closes && english === japanese.slice(1, -1)) {
        return {bucket: "both-lost", fix: {open: japanese[0], close: japanese[japanese.length - 1]}};
    }
    if (holdsAllOf(english, japanese)) {
        return {bucket: "extra", fix: null};
    }
    return {bucket: "other", fix: null};
};

/** Worst first, which is also the order they are worth deciding in. */
export const BUCKETS = ["closing-lost", "opening-lost", "both-lost", "straight-quotes", "extra", "other"];

/**
 * One speech's two texts, the way the game puts its rows on screen.
 *
 * `edits` replaces the English of the rows it names, which is what makes this
 * the same code path before and after a fix: a post-condition read through a
 * second implementation of "what does this speech say" is a post-condition
 * about the second implementation.
 *
 * @param {object[]} spoken the rows the game says something on
 * @param {Map<number, string>} [edits]
 */
const textsOf = (spoken, edits) => ({
    japanese: spoken.map(row => row.japanese.replace(/^　/, "")).join(""),
    english: spoken
        .map(row => (edits?.has(row.lineNumber) ? edits.get(row.lineNumber) : row.english))
        .filter(text => text.trim())
        .map(text => text.replace(/^　/, ""))
        .join(" "),
});

/**
 * What the speech says with every bracket and every run of space taken out.
 *
 * The second half of the post-condition: the fix is allowed to add or remove a
 * bracket and to tidy the whitespace at the ends of a row it touched, and
 * nothing else. Held against the same string built before the edit, this is
 * what says a rewrite has not eaten a word.
 */
const withoutBrackets = (text) => text
    .replace(new RegExp(`[${BRACKETS}()"“”]`, "g"), "")
    .replace(/[\s　]+/g, " ")
    .trim();

/**
 * Whether a fix did what it said, asked of the rows after it rather than of
 * the rule that made it.
 *
 * Two conditions, and counting the symbols is neither of them: 「」 and 」「 hold
 * the same two characters and only one of them is a speech. So the shape is
 * compared **in order**, as a string, which is the same comparison `classify`
 * makes and subsumes any tally. The second condition is that nothing else on
 * the rows moved.
 *
 * @return {{shape: string, kept: boolean, matches: boolean}}
 */
export const verifyFix = (spoken, before, edits) => {
    const after = textsOf(spoken, edits);
    const shape = englishShape(after.english);
    return {
        shape,
        matches: shape === japaneseShape(after.japanese),
        kept: withoutBrackets(after.english) === withoutBrackets(before.english),
    };
};

/**
 * The English of one speech's rows with the fix written in.
 *
 * The opener goes on the first row that has English and the closer on the last,
 * glued to the text rather than spaced off it, and the trailing space the draft
 * left behind 「W-wife!? comes off with it.
 *
 * The continuation indent in front of the opener is taken from **the game's own
 * row**, not from the English cell. The indent sits the text under the 「 that
 * opened the quote, so it belongs to a row the game continues on and to no
 * other -- and the draft put one on the first row of 030331.tsv m[566], where
 * 　「 would draw a full-width space and then the bracket, which is a row the
 * game never writes.
 *
 * @return {Map<number, string>} only the rows that change
 */
export const applyBracketFix = (rows, fix) => {
    const written = rows.filter(row => carriesText(row) && englishOf(row));
    const edits = new Map();
    if (fix.open) {
        const row = written[0];
        const indent = row.japanese.startsWith("　") ? "　" : "";
        edits.set(row.lineNumber, indent + fix.open + row.english.replace(/^[\s　]+/, ""));
    }
    if (fix.close) {
        const row = written[written.length - 1];
        const text = (edits.get(row.lineNumber) ?? row.english).trimEnd() + fix.close;
        edits.set(row.lineNumber, text);
    }
    return edits;
};

/**
 * Every speech whose English does not carry the brackets its Japanese does.
 *
 * @param {string} lang
 * @return {Promise<{scenes: number, speeches: number, findings: object[]}>}
 */
export const findSpeechBrackets = async (lang, only) => {
    const scenes = await readTranslatedScenes(lang);
    const findings = [];
    let speeches = 0;

    for (const {fileName, scene} of scenes) {
        if (only && fileName !== only) {
            continue;
        }
        const byNumber = new Map(scene.rows.map(row => [row.lineNumber, row]));
        for (const speech of speechesOf(scene)) {
            const rows = speech.rows.map(number => byNumber.get(number));
            const spoken = rows.filter(carriesText);
            const written = spoken.filter(row => englishOf(row));
            if (!spoken.length || !written.length) {
                // A beat between two bubbles, or a speech nobody translated:
                // modules/SpeechGaps.js is where the second of those is reported.
                continue;
            }
            ++speeches;

            const texts = textsOf(spoken);
            const shape = {japanese: japaneseShape(texts.japanese), english: englishShape(texts.english)};
            const verdict = classify(shape.japanese, shape.english);
            if (!verdict) {
                continue;
            }

            const drawn = drawnLines(rows.map(englishOf));
            const budget = rowBudget(rows.length);
            const edits = verdict.fix ? applyBracketFix(rows, verdict.fix) : new Map();
            const after = drawnLines(rows.map(row => edits.get(row.lineNumber) ?? englishOf(row)));
            // Asked of the rows the fix produced, never of the rule that made
            // it: a fix that is right by construction is a fix nobody checked.
            const verified = verdict.fix ? verifyFix(spoken, texts, edits) : null;

            findings.push({
                file: fileName,
                lineNumber: speech.lineNumber,
                speaker: speech.speaker,
                bucket: verdict.bucket,
                shape,
                symbols: [verdict.fix?.open, verdict.fix?.close].filter(Boolean),
                rows,
                edits,
                verified,
                drawn,
                after,
                budget,
                // Rule three: a bracket is a character wide, and a speech that
                // sat at the edge of the window does not after the fix.
                overflowedBefore: drawn > budget,
                overflowsAfter: after > budget,
                pushedOver: after > budget && drawn <= budget,
            });
        }
    }
    return {scenes: scenes.length, speeches, findings};
};

/** How many findings each bucket holds, in the order they are worth reading. */
export const countByBucket = (findings) => Object.fromEntries(
    BUCKETS.map(name => [name, findings.filter(finding => finding.bucket === name).length]));
