/**
 * The full-width space a row of a bubble begins with, and where the English
 * lost it.
 *
 * The game indents the rows of a speech after the first, so the text sits under
 * the 「 that opened the quote rather than flush against the window edge:
 *
 *     89751  「以前にカオスとは会ったことがあるので、  「Having crossed paths with Chaos before, I did sometimes
 *     89752  　いずれはこんな日が……                    wonder if such a reunion
 *     89753  　と思ったこともありましたが」             might eventually happen...」
 *
 * Three rows of one bubble, two of which the game starts a character in and the
 * English does not. The player sees a paragraph whose middle and last lines
 * hang out to the left of the first, and the backlog replays it that way.
 *
 * It is not the same thing as a row the build wraps. A row too wide for the
 * window is folded at render time and the fold has no indent to carry; this is
 * the indent the corpus itself is missing, on rows that are already the rows
 * the bytecode gave them, and it is written into the scene file the way every
 * other repair to a baked corpus is (`docs/baked-name-repairs.md`).
 *
 * ## The question is asked of the row
 *
 * Which is the opposite of modules/SpeechBrackets.js, and the difference is
 * about the mark rather than about the report: a bracket belongs to the
 * utterance -- 「 on one row and 」 three rows later are one pair, and asked row
 * by row both rows are findings and both are wrong -- while an indent belongs
 * to the row it is drawn on. The game's own row states where its text starts,
 * and the English on that row answers the same statement without anything
 * around it to be wrong about.
 *
 * That is also what leaves no judgement in the class. The Japanese column of a
 * scene file is the game's own, held against the dump at every extraction, so
 * "this row starts one full-width space in" is a fact read off the game rather
 * than a rule somebody wrote about English.
 *
 * ## The whole run, not one space
 *
 * 228 rows in the class begin with two or more. Six are the game's own --
 * ＜ぺちーん＞ is a sound effect positioned across the window -- and the rest
 * are the scenario documents, where the indent is an outline level. Mirroring
 * the run keeps the English row starting where the Japanese row starts, which
 * is what those spaces say; mirroring a single space would move the sound
 * effect left and leave the report with a class it could never close.
 *
 * ## An ASCII space is not an indent
 *
 * 43 rows answer 　 with " ". It draws a third of the width, and on the rows
 * long enough to be wrapped it does not draw at all: `wrap` in
 * modules/TextNormalization.js keeps `^　*` on purpose and splits the rest on
 * whitespace, so a leading ASCII space is dropped exactly where it was standing
 * in for an indent. Those rows are this fault wearing a different character,
 * and the fix is the same fix.
 *
 * **A leading tab is neither**, and is never touched. The scene format escapes
 * tabs because 2929 of the game's messages hold one, and a pass that normalised
 * `[\s　]+` has already eaten fifteen of them once -- `docs/speech-brackets.md`
 * is that lesson, and CLAUDE.md states it as a rule. No row in the class begins
 * with a tab today; the guard is there for the next translation rather than for
 * this one.
 *
 * ## What it leaves alone
 *
 * **A row the game says nothing on.** 954 speeches hold one -- a beat inside a
 * bubble, or text positioned across the screen with runs of full-width spaces
 * -- and a translation owes it nothing, an indent included. One row in the
 * corpus is that shape with English on it anyway (m[134063], `　` answered with
 * `.`), which is a shifted run's padding and modules/SpeechGaps.js's finding
 * rather than this one's.
 *
 * **An indent the English carries and the Japanese does not.** 141 rows, and
 * most of them are this repository's own doing: `layOutSpeech` used to infer
 * the indent from the bracket a speech opens with rather than from the row
 * underneath, and scripts/bake_speech_rows.js wrote that into the corpus. That
 * guess is gone -- the layout reads `leadingIndent` of each row's Japanese now,
 * so a bake agrees with this pass instead of undoing it -- but the rows it
 * already wrote are text somebody may have since edited, and reading them back
 * off would be a sweep of its own rather than this one.
 *
 * **A leading ASCII space on a row whose Japanese has no indent.** 75 rows.
 * That is a stray character rather than an indent that was written wrong, and
 * nothing in the Japanese says what should be there instead.
 *
 * ## An indent is a character wide
 *
 * So the same third rule modules/SpeechBrackets.js carries applies here: a
 * speech that fits its window today can stop fitting once the indent is back.
 * 43 do -- the widest row of each is within a full-width space of the fold --
 * and they are named rather than quietly accepted. Every one of them is a row
 * the game draws one character further right than the English did, so the
 * overflow was always there and the corpus was hiding it; `pushedOver` is where
 * it surfaces. 20 of the 43 are in scenario documents the game never draws;
 * scripts/bake_speech_rows.js laid 12 of the other 23 back into their rows, and
 * the 11 left hold more English than two or three rows can draw whatever the
 * layout, which is somebody's edit rather than a pass's.
 */
import {speechesOf} from "./SceneFile.js";
import {readTranslatedScenes} from "./SceneTranslations.js";
import {isDraftScene} from "./SpeechGaps.js";
import {drawnLines, inHistoryFrameOf, leadingIndent, rowBudget} from "./SpeechRows.js";

/** The two ways a row can be missing the indent its Japanese carries. */
export const BUCKETS = ["missing", "ascii-space"];

/**
 * A cell holding nothing but the continuation indent is a blank row wearing a
 * character. modules/SpeechGaps.js and modules/SpeechBrackets.js both take this
 * view, and for the same reason: it draws as an empty line and a build would
 * read it as translated.
 */
export const englishOf = (row) => (row.english.trim() ? row.english : "");

/**
 * Whether the game says anything on this row, which is what decides whether a
 * translation owes it an indent.
 */
export const carriesText = (row) => Boolean(row.japanese.trim());

/**
 * The English of a row with the indent its Japanese carries.
 *
 * Only ASCII spaces come off the front -- never a tab, which is a character the
 * scene format escapes on purpose -- and nothing else on the row is touched.
 */
export const applyIndent = (row) => leadingIndent(row.japanese) + row.english.replace(/^ +/, "");

/**
 * Whether the row the fix produced is the row that was asked for, asked of the
 * text rather than of the rule that made it.
 *
 * `kept` compares the two with their leading spaces off and the tab left in: a
 * check that normalised away the character it is protecting would pass the one
 * mistake it exists to catch.
 */
export const verifyIndent = (row, fixed) => {
    const indent = leadingIndent(row.japanese);
    return {
        mirrors: fixed.startsWith(indent) && !/^[　 ]/.test(fixed.slice(indent.length)),
        kept: fixed.replace(/^[　 ]+/, "") === row.english.replace(/^[　 ]+/, ""),
        filled: Boolean(fixed.trim()),
    };
};

export const holds = (verified) =>
    Boolean(verified && verified.mirrors && verified.kept && verified.filled);

/**
 * Whether this row is one the pass has an opinion about at all.
 *
 * @return {"missing" | "ascii-space" | null}
 */
const bucketOf = (row) => {
    if (!leadingIndent(row.japanese) || !carriesText(row) || !englishOf(row)) {
        return null;
    }
    if (row.english.startsWith("　") || row.english.startsWith("\t")) {
        return null;
    }
    return row.english.startsWith(" ") ? "ascii-space" : "missing";
};

/**
 * Every row of one text language's scenes whose English does not start where
 * the game's own row starts.
 *
 * Findings are rows, because that is what the question is about. The width the
 * fix costs is a question about the speech, so the speeches the fix pushes past
 * their window come back beside them rather than on them.
 *
 * It reads text_languages/<lang>/scenes/ and nothing else -- no alice-tools, no
 * GAME_DIR, no dump -- and writes nothing.
 *
 * @param {string} lang
 * @param {string} [only] one scene file, so a translator refining one scene
 *        reads a report about that scene
 * @return {Promise<{scenes: number, rows: number, findings: object[], pushed: object[],
 *     heldTabs: object[]}>}
 */
export const findSpeechIndent = async (lang, only) => {
    const wanted = only && (only.endsWith(".tsv") ? only : `${only}.tsv`);
    const scenes = (await readTranslatedScenes(lang))
        .filter(({fileName}) => !wanted || fileName === wanted);
    const findings = [];
    const pushed = [];
    const heldTabs = [];
    let rows = 0;

    for (const {fileName, scene} of scenes) {
        const draft = isDraftScene(scene.name);
        const byNumber = new Map(scene.rows.map(row => [row.lineNumber, row]));
        rows += scene.rows.length;
        for (const speech of speechesOf(scene)) {
            const speechRows = speech.rows.map(number => byNumber.get(number));
            const edits = new Map();
            for (const row of speechRows) {
                if (row.english.startsWith("\t") && leadingIndent(row.japanese) && englishOf(row)) {
                    // Named rather than fixed: the tab is what the format
                    // escapes, and a pass that reaches past one to tidy the
                    // whitespace in front of it is the pass that ate fifteen.
                    heldTabs.push({file: fileName, lineNumber: row.lineNumber});
                    continue;
                }
                const bucket = bucketOf(row);
                if (!bucket) {
                    continue;
                }
                const fixed = applyIndent(row);
                edits.set(row.lineNumber, fixed);
                findings.push({
                    file: fileName,
                    draft,
                    speech: speech.lineNumber,
                    speaker: speech.speaker,
                    lineNumber: row.lineNumber,
                    bucket,
                    japanese: row.japanese,
                    english: row.english,
                    fixed,
                    verified: verifyIndent(row, fixed),
                });
            }
            if (!edits.size) {
                continue;
            }

            /*
             * The width, once per speech and only where the window is the one
             * this measurement is about. The ■歴史枠 chronology is drawn in a
             * 40-wide frame and modules/SpeechRows.js is where that range
             * lives; asking a 24-wide question about it is how 15 speeches
             * became findings that wanted shortening by meaning and fitted the
             * box they are actually in.
             */
            if (inHistoryFrameOf(fileName, speech.lineNumber)) {
                continue;
            }
            const drawn = drawnLines(speechRows.map(englishOf));
            const after = drawnLines(speechRows.map(row => edits.get(row.lineNumber) ?? englishOf(row)));
            const budget = rowBudget(speechRows.length);
            if (after > budget && drawn <= budget) {
                pushed.push({
                    file: fileName,
                    draft,
                    lineNumber: speech.lineNumber,
                    speaker: speech.speaker,
                    rows: speechRows,
                    edits,
                    drawn,
                    after,
                    budget,
                });
            }
        }
    }
    return {scenes: scenes.length, rows, findings, pushed, heldTabs};
};

/** How many findings each bucket holds. */
export const countByBucket = (findings) => Object.fromEntries(
    BUCKETS.map(name => [name, findings.filter(finding => finding.bucket === name).length]));

/**
 * The rows the English indents and the Japanese does not, counted rather than
 * fixed.
 *
 * Read from the same files in the same pass so the report can say what it is
 * leaving alone and how much of it there is. Most of these are the layout's:
 * `layOutSpeech` indents every continuation of a quoted speech whatever the
 * Japanese says, and the bake writes that into the corpus.
 */
export const countOppositeIndents = async (lang, only) => {
    const wanted = only && (only.endsWith(".tsv") ? only : `${only}.tsv`);
    const scenes = (await readTranslatedScenes(lang))
        .filter(({fileName}) => !wanted || fileName === wanted);
    let englishOnly = 0;
    let strayAsciiSpace = 0;
    for (const {scene} of scenes) {
        for (const row of scene.rows) {
            if (leadingIndent(row.japanese) || !englishOf(row)) {
                continue;
            }
            if (row.english.startsWith("　")) {
                ++englishOnly;
            } else if (row.english.startsWith(" ")) {
                ++strayAsciiSpace;
            }
        }
    }
    return {englishOnly, strayAsciiSpace};
};
