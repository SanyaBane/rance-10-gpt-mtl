/**
 * Where a speech and the English written into its rows have come apart.
 *
 * The corpus this repository builds from was translated a line at a time, and
 * the fork that wrote it often answered a whole utterance on the utterance's
 * first row -- 「喧嘩や、悪ければ決闘沙汰にまで / 発展しそうになるんだぞ！」 came
 * back as one English sentence with the second row left empty. That is the same
 * shape modules/SceneTranslations.js writes on purpose, so most of it is
 * harmless. Some of it is not, and none of it was visible until the dialogue was
 * laid out scene by scene: a corpus record is a number, a Japanese line and an
 * English one, with no speech around it to be wrong about.
 *
 * What makes the question answerable here is that a scene file carries the
 * game's own Japanese, the speaker the bytecode names, and the row boundaries
 * the `MSG` operands gave -- so a row's English can be held against the row it
 * is on rather than against the record it came from. The alignment check in
 * docs/corpus-alignment.md cannot do this and reads 0: it compares a record's
 * Japanese with the dump, and in every case here the Japanese is right and the
 * English is what moved.
 *
 * ## The four classes, worst first
 *
 * **shifted** -- the English on a row belongs to a different row. The two
 * signals that are almost never anything else: a row whose Japanese is a
 * thought （…） answered with speech 「…」 or the other way round, and a row
 * whose English is nothing but dots over real Japanese, which is the padding a
 * run of shifted rows ends with. m[102332] carries the thought that belongs to
 * m[102333], and m[102335] carries "............".
 *
 * **blank** -- a speech with English on some rows and not others. Three kinds,
 * and they are not equally bad: a *hole* between two filled rows is the one a
 * player sees as a gap in the middle of a bubble; *trailing* blanks are the
 * whole utterance sitting in row one, which looks fine until it does not fit;
 * *leading* is the mirror. Each finding says whether the rows as they stand
 * draw in more lines than the window allows, which is the part that is not
 * cosmetic -- and whether laying the speech out again would fix it, which is
 * what modules/SpeechRows.js is for.
 *
 * **bracket** -- the speech opens 「 in Japanese and does not in English, or
 * closes 」 and does not. The text is on its own row; a quotation mark fell off
 * the end of one row or the start of the next. Cosmetic, and the largest class.
 *
 * **untranslated** -- a speech with no English at all. Reported because it is
 * what a build has to decide about rather than what somebody has to fix: a row
 * with no English is left unnamed, and an unnamed row plays in Japanese.
 *
 * A speech is reported once, under the worst class it answers, so the counts
 * add up to the speeches with something wrong rather than to the signals.
 */
import {speechesOf} from "./SceneFile.js";
import {readTranslatedScenes} from "./SceneTranslations.js";
import {drawnLines, layOutSpeech, rowBudget} from "./SpeechRows.js";

/** Worst first, which is also the order a fix is worth making in. */
export const CLASSES = ["shifted", "blank", "bracket", "untranslated"];

/**
 * Kana and kanji, and deliberately not ・ or ー.
 *
 * The katakana middle dot is a letter by codepoint and a dot by eye, and a row
 * whose Japanese is ………………・ answered with ..............・ is a translation
 * rather than a fault. A range that takes in U+30FB reports it as one.
 */
const HAS_JAPANESE = /[ぁ-ゖァ-ヺ一-鿿]/;
/** Dots, full-width dots and ellipses: the padding a shifted run ends with. */
const ONLY_DOTS = /^[\s　]*[.．・…][\s　.．・…]*$/;
const opens = (text, bracket) => text.trimStart().startsWith(bracket);
const closes = (text, bracket) => text.trimEnd().endsWith(bracket);

/**
 * A cell holding nothing but the continuation indent is a blank row wearing a
 * character. It draws as an empty line, `assemblePatch` would read it as
 * translated, and read as a dot it is a shifted run's padding -- which is three
 * different wrong answers to one whitespace.
 */
const englishOf = (row) => (row.english.trim() ? row.english : "");

/**
 * The English of a row that is a thought where its Japanese is speech, or the
 * reverse. Both languages mark the difference and the corpus keeps the marks,
 * so this is one of the two places a shifted row cannot hide.
 */
const swapsThoughtAndSpeech = (row) =>
    (opens(row.japanese, "（") && opens(row.english, "「"))
    || (opens(row.japanese, "「") && (opens(row.english, "（") || opens(row.english, "(")));

const shiftSignals = (rows) => {
    const signals = [];
    for (const row of rows) {
        const english = englishOf(row);
        if (!english || !row.japanese) {
            continue;
        }
        if (swapsThoughtAndSpeech({...row, english})) {
            signals.push({at: row.lineNumber, kind: "a thought answered with speech, or the reverse"});
        } else if (ONLY_DOTS.test(english) && HAS_JAPANESE.test(row.japanese)) {
            signals.push({at: row.lineNumber, kind: "English is nothing but dots over real Japanese"});
        }
    }
    return signals;
};

/** Which of the three shapes a speech's blanks make. */
const blankKind = (filled) => {
    const first = filled.indexOf(true);
    const last = filled.lastIndexOf(true);
    if (filled.slice(first, last).includes(false)) {
        return "a hole between two filled rows";
    }
    return first > 0 ? "blank rows before the English" : "blank rows after the English";
};

/**
 * Every speech of one text language's scenes that answers one of the classes.
 *
 * @param {string} lang
 * @return {Promise<{scenes: number, speeches: number, findings: object[]}>}
 */
export const findSpeechGaps = async (lang) => {
    const scenes = await readTranslatedScenes(lang);
    const findings = [];
    let speeches = 0;

    for (const {fileName, scene} of scenes) {
        const byNumber = new Map(scene.rows.map(row => [row.lineNumber, row]));
        for (const speech of speechesOf(scene)) {
            ++speeches;
            const rows = speech.rows.map(number => byNumber.get(number));
            const at = {file: fileName, lineNumber: speech.lineNumber, speaker: speech.speaker, rows};

            const signals = shiftSignals(rows);
            if (signals.length) {
                findings.push({...at, class: "shifted", kind: signals[0].kind, signals});
                continue;
            }

            if (!speech.english.trim()) {
                // A speech nobody translated. Only its rows' emptiness says so:
                // the Japanese is there and the game will play it.
                findings.push({...at, class: "untranslated", kind: "no English at all"});
                continue;
            }

            const filled = rows.map(row => Boolean(englishOf(row)));
            if (filled.includes(false)) {
                const drawn = drawnLines(rows.map(englishOf));
                const budget = rowBudget(rows.length);
                const again = layOutSpeech(speech.english, rows.length);
                findings.push({
                    ...at,
                    class: "blank",
                    kind: blankKind(filled),
                    overflows: drawn > budget,
                    drawn,
                    budget,
                    // What laying it out again would put in the rows, so that a
                    // report can show the fix rather than assert one exists.
                    laidOut: again.rows,
                    fixes: drawn > budget && again.fits,
                    stillOverflows: !again.fits,
                });
                continue;
            }

            const missing = [];
            if (opens(speech.japanese, "「") && !opens(speech.english, "「")) {
                missing.push("opening 「");
            }
            if (closes(speech.japanese, "」") && !closes(speech.english, "」")) {
                missing.push("closing 」");
            }
            if (missing.length) {
                findings.push({...at, class: "bracket", kind: `no ${missing.join(" and no ")}`});
            }
        }
    }

    return {scenes: scenes.length, speeches, findings};
};

/** How many findings each class holds, in the order they are worth reading. */
export const countByClass = (findings) => Object.fromEntries(
    CLASSES.map(name => [name, findings.filter(finding => finding.class === name).length]));
