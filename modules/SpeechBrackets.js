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
 * Which bucket the difference between the two shapes falls in, and which rule
 * has an answer for it.
 *
 * The three `lost` buckets are decidable without reading the line: the English
 * shape is the Japanese one with a bracket taken off an end, so putting that
 * bracket back is the only edit that makes the two agree. `quotes` and `rows`
 * are rules rather than deductions and are named as such -- what makes them
 * safe is not the rule but verifyFix, which asks the rows afterwards. `other`
 * has no rule, which is the finding.
 */
const classify = (japanese, english) => {
    if (japanese === english) {
        return null;
    }
    if (english.includes("\"")) {
        return asJapaneseQuotes(english) === japanese
            ? {bucket: "straight-quotes", fix: {kind: "quotes"}}
            : {bucket: "other", fix: null};
    }
    const opens = OPENERS.includes(japanese[0]);
    const closes = CLOSERS.includes(japanese[japanese.length - 1]);
    if (closes && english === japanese.slice(0, -1)) {
        return {bucket: "closing-lost", fix: {kind: "lost", close: japanese[japanese.length - 1]}};
    }
    if (opens && english === japanese.slice(1)) {
        return {bucket: "opening-lost", fix: {kind: "lost", open: japanese[0]}};
    }
    if (opens && closes && english === japanese.slice(1, -1)) {
        return {bucket: "both-lost",
            fix: {kind: "lost", open: japanese[0], close: japanese[japanese.length - 1]}};
    }
    if (holdsAllOf(english, japanese)) {
        return {bucket: "extra", fix: {kind: "rows"}};
    }
    return {bucket: "other", fix: null};
};

/**
 * The rows no bracket pass may touch, and why.
 *
 * 033355.tsv m[230508]-m[230530] is 23 rows whose English sits one row late:
 * m[230508] says what m[230509] says in Japanese, and so on until m[230530],
 * where the run ends on an empty cell and the scene comes back into step. It is
 * the shifted class of modules/SpeechGaps.js and not this one -- and that class
 * does not report it, because both of its signals need the wrong row to *look*
 * wrong. This is a third signal for the same fault: a shifted run cuts every
 * 「…」 in half, so a speech starts with the closer of the one before it and
 * ends with the opener of the one after. Seven speeches in the run have the
 * shape 」「 and nothing else in 5433 scenes does.
 *
 * Excluded rather than fixed, because a bracket written onto a row that is
 * carrying somebody else's sentence makes the wrong text look finished.
 */
const SHIFTED_RUNS = [{file: "033355.tsv", from: 230508, to: 230530}];

const isShifted = (file, lineNumber) => SHIFTED_RUNS.some(run =>
    run.file === file && lineNumber >= run.from && lineNumber <= run.to);

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
 * The space a fix is allowed to move: an ASCII space and a full-width one, and
 * deliberately not `\s`.
 *
 * A tab is whitespace to a regular expression and content to this format. 2929
 * of the game's messages hold one -- 033734.tsv writes its scenario notes with
 * two at the start of every row -- and modules/SceneFile.js escapes them for
 * exactly that reason. A rule that reached for `\s` or for trim() ate 15 of
 * them, and the post-condition below said nothing because it was collapsing
 * `\s` too. Both halves now name the two spaces they mean.
 */
const spacesAtEnd = /[ 　]+$/;
const spacesAtStart = /^[ 　]+/;

/**
 * What the speech says with every bracket and every run of space taken out.
 *
 * The second half of the post-condition: the fix is allowed to add or remove a
 * bracket and to close up the space where it was, and nothing else. Held
 * against the same string built before the edit, this is what says a rewrite
 * has not eaten a word -- or a tab.
 */
const withoutBrackets = (text) => text
    .replace(new RegExp(`[${BRACKETS}()"“”]`, "g"), "")
    .replace(/[ 　]+/g, " ")
    .replace(/^ | $/g, "");

/**
 * Whether a fix did what it said, asked of the rows after it rather than of
 * the rule that made it.
 *
 * Three conditions, and counting the symbols is none of them: 「」 and 」「 hold
 * the same two characters and only one of them is a speech. So the shape is
 * compared **in order**, as a string, which is the same comparison `classify`
 * makes and subsumes any tally. The second condition is that nothing else on
 * the rows moved. The third is that no row the fix touched was left empty --
 * `assemblePatch` reads a blank cell as "not translated" and the row plays in
 * Japanese, so a rule that takes a 」 off a row holding nothing else would
 * quietly put one line of the game back into Japanese.
 *
 * @return {{shape: string, kept: boolean, matches: boolean, filled: boolean}}
 */
export const verifyFix = (spoken, before, edits) => {
    const after = textsOf(spoken, edits);
    const shape = englishShape(after.english);
    return {
        shape,
        matches: shape === japaneseShape(after.japanese),
        kept: withoutBrackets(after.english) === withoutBrackets(before.english),
        filled: [...edits.values()].every(text => text.trim()),
    };
};

/** Whether the whole post-condition holds, which is what the writer gates on. */
export const holds = (verified) => Boolean(verified?.matches && verified.kept && verified.filled);

/**
 * Putting back the bracket that fell off an end of the speech.
 *
 * The opener goes on the first row that has English and the closer on the last,
 * glued to the text rather than spaced off it, and the trailing space the draft
 * left behind 「W-wife!? comes off with it. Glued rather than placed, because
 * the row layout is about to be baked into the `.tsv` and a bake moves words
 * between the rows of a speech: a bracket stuck to a word travels with the
 * word, and one written into a row of its own does not.
 *
 * The continuation indent in front of the opener is taken from **the game's own
 * row**, not from the English cell. The indent sits the text under the 「 that
 * opened the quote, so it belongs to a row the game continues on and to no
 * other -- and the draft put one on the first row of 030331.tsv m[566], where
 * 　「 would draw a full-width space and then the bracket, which is a row the
 * game never writes.
 */
const lostBracket = (written, fix) => {
    const edits = new Map();
    if (fix.open) {
        const row = written[0];
        const indent = row.japanese.startsWith("　") ? "　" : "";
        edits.set(row.lineNumber, indent + fix.open + row.english.replace(spacesAtStart, ""));
    }
    if (fix.close) {
        const row = written[written.length - 1];
        const text = edits.get(row.lineNumber) ?? row.english;
        edits.set(row.lineNumber, text.replace(spacesAtEnd, "") + fix.close);
    }
    return edits;
};

const opensInEnglish = (char) => OPENERS.includes(char) || char === "(";
const closesInEnglish = (char) => CLOSERS.includes(char) || char === ")";

/**
 * Taking off the brackets the draft put at the ends of rows the game does not
 * end there.
 *
 * The fork treated each row as a self-contained utterance: it closed 」 on every
 * row of a bubble rather than on the last, and 759 speeches read 「…」 / …」 with
 * a closing quote in the middle of them. That is the same mistake that lost the
 * closers -- a row is not an utterance -- so it is the same rule read the other
 * way: **a row may carry a bracket at an end only where the game's own row
 * carries one there.** Asked of the row's Japanese and never of its neighbours,
 * which is what makes it decidable at all.
 *
 * It leaves the middle of a row alone, so a draft that put （…） inside a
 * sentence the game did not fails the post-condition and is reported instead of
 * rewritten -- which is the right answer, because that one is a choice about
 * English rather than a bracket that fell off.
 */
const rowEndBrackets = (written) => {
    const edits = new Map();
    for (const row of written) {
        const japanese = row.japanese.replace(/^　/, "");
        const indent = row.english.startsWith("　") ? "　" : "";
        // Only ever sliced at a bracket and closed up with the space that was
        // beside it. Never trimmed: this runs over every row of the speech
        // rather than over the two ends, so a rule that tidies as it goes
        // rewrites rows that have no bracket on them at all.
        let text = row.english.slice(indent.length);
        if (opensInEnglish(text[0]) && !OPENERS.includes(japanese[0])) {
            text = text.slice(1).replace(spacesAtStart, "");
        }
        const untilSpace = text.replace(spacesAtEnd, "");
        if (closesInEnglish(untilSpace[untilSpace.length - 1])
            && !CLOSERS.includes(row.japanese.replace(spacesAtEnd, "").slice(-1))) {
            text = untilSpace.slice(0, -1).replace(spacesAtEnd, "");
        }
        if (indent + text !== row.english) {
            edits.set(row.lineNumber, indent + text);
        }
    }
    return edits;
};

/**
 * Straight quotes turned back into the brackets they stood in for.
 *
 * The alternation runs across the whole speech and not across a row, because a
 * bubble opened on one row closes on another. Which quote a `"` was depends
 * only on how many came before it, and `classify` has already checked that
 * reading them that way reproduces the Japanese exactly -- so this writes what
 * that check proved rather than guessing again.
 */
const straightQuotes = (written) => {
    const edits = new Map();
    let open = true;
    for (const row of written) {
        const text = [...row.english].map(char => {
            if (!ENGLISH_FORM.has(char) || ENGLISH_FORM.get(char) !== "\"") {
                return char;
            }
            open = !open;
            return open ? "」" : "「";
        }).join("");
        if (text !== row.english) {
            edits.set(row.lineNumber, text);
        }
    }
    return edits;
};

/**
 * The English of one speech's rows with the fix written in.
 *
 * @return {Map<number, string>} only the rows that change
 */
export const applyBracketFix = (rows, fix) => {
    const written = rows.filter(row => carriesText(row) && englishOf(row));
    if (fix.kind === "rows") {
        return rowEndBrackets(written);
    }
    if (fix.kind === "quotes") {
        return straightQuotes(written);
    }
    return lostBracket(written, fix);
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
            // A shifted run has no bracket fault to fix -- it has somebody
            // else's sentence on the row -- so no rule is offered one.
            const shifted = isShifted(fileName, speech.lineNumber);
            const fix = shifted ? null : verdict.fix;
            const edits = fix ? applyBracketFix(rows, fix) : new Map();
            const after = drawnLines(rows.map(row => edits.get(row.lineNumber) ?? englishOf(row)));
            // Asked of the rows the fix produced, never of the rule that made
            // it: a fix that is right by construction is a fix nobody checked.
            const verified = fix ? verifyFix(spoken, texts, edits) : null;

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
                shifted,
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
