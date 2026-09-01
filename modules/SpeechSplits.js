/**
 * Where the English draws the line between two utterances and the game does not.
 *
 * A speech is a run of `m[]` rows, and the game decides not only how many rows
 * there are but which of them starts a fresh utterance: a row whose Japanese
 * opens 「 rather than carrying the continuation indent is a new bubble-line, a
 * beat the player reads as a pause. 033028's 「したらさぁ…」 runs two rows and
 * 「は？　魔王退治？」 gets the third to itself.
 *
 * The English there did not. It spilled the first utterance onto the third row
 * and set the second beside it, so the player read
 * `together?」 「Huh? Defeating the Demon King?」` -- a closing bracket and an
 * opening one in the middle of a line, which looks like a typo, with the pause
 * gone. Three of the twelve were worse than cosmetic: 033076, 033310 and 033381
 * put one character's words on another character's row, because the row the
 * English overran belonged to a different speaker.
 *
 * ## Why the neighbouring reports are silent
 *
 * modules/SpeechGaps.js reads 0 for every one of them. Its `shifted` class wants
 * one of two signals -- a thought answered with speech, or a row of nothing but
 * dots -- and neither fires here; its width classes are content, because every
 * row involved is comfortably inside the box. modules/SpeechBrackets.js asks the
 * *speech* whether its brackets balance, on purpose (docs/speech-brackets.md says
 * why), and in every case here they do: the same marks are present, just not on
 * the rows the game put them on.
 *
 * So this is a third question, and the reason it can be asked at all is the
 * reason the other two can: a scene file carries the game's own Japanese row by
 * row, so a row's English can be held against the row it sits on.
 *
 * ## The three classes, worst first
 *
 * **invented** -- the English closes one utterance and opens another where the
 * game's Japanese has no second utterance anywhere in the speech. 035886's
 * 「その上、悪い奴らの / 秘密の取引現場を見てしまったので / 命を狙われる我々だ」 is
 * one sentence over three rows and came back as `bad men」 「making a secret
 * deal,` -- a speaker boundary the game never wrote. Worst because it is the
 * only one that changes what the game says rather than where it says it.
 *
 * **crammed** -- the boundary is real and on the wrong row: the English row
 * carries the tail of the utterance above it and the whole of the next.
 *
 * **indented** -- the mild one. The row's Japanese opens 「, so it starts an
 * utterance, and its English begins with the continuation indent, which says it
 * carries on from the row above. 033275 had the fresh quote and the indent both.
 *
 * ## What it does not ask
 *
 * Whether the English *should* have a boundary the Japanese lacks. A translator
 * may split one Japanese sentence into two English ones inside a speech and be
 * right to; `invented` reports those too, and reading them is the price of
 * catching the ones that put words in the wrong mouth.
 *
 * And it says nothing about rows the game leaves to a translator's discretion:
 * moving words between the rows of one speech is allowed and normal
 * (docs/message-window.md), so a row simply divided differently is not a
 * finding. Only the utterance boundary is.
 */
import {speechesOf} from "./SceneFile.js";
import {readTranslatedScenes} from "./SceneTranslations.js";

/** Worst first, which is also the order they are worth reading in. */
export const CLASSES = ["invented", "crammed", "indented"];

const OPENS = "「";
/** The continuation indent a row carries when it does not start an utterance. */
const INDENT = "　";
/**
 * A closing bracket and an opening one on the same row.
 *
 * The space between them is optional because the fault is the pair, not the
 * spacing -- `」「` and `」 「` are the same row read aloud, and only one of them
 * would be caught by a check that insisted on the space.
 */
const BOUNDARY = /」[\s　]*「/;

/**
 * A scene that is the scenario document rather than a scene the game plays.
 *
 * The same test modules/SpeechGaps.js uses and for the same reason: a leading
 * ASCII `t` on a scene name whose siblings are all Japanese. 185 of the 192 rows
 * this found on its first run were in these, where the writer's own notes quote
 * dialogue inline and nobody is reading the result off a screen.
 */
const isDraftScene = (name) => name.startsWith("t");

/**
 * @param {string} lang
 * @param {string} [only] one scene file, with or without the .tsv, so that a
 * translator working on a scene gets a report about that scene.
 */
export const findSpeechSplits = async (lang, only) => {
    const wanted = only && (only.endsWith(".tsv") ? only : `${only}.tsv`);
    const scenes = (await readTranslatedScenes(lang))
        .filter(({fileName}) => !wanted || fileName === wanted);
    const findings = [];
    let speeches = 0;
    let drafts = 0;

    for (const {fileName, scene} of scenes) {
        const draft = isDraftScene(scene.name);
        const byNumber = new Map(scene.rows.map(row => [row.lineNumber, row]));
        for (const speech of speechesOf(scene)) {
            ++speeches;
            const rows = speech.rows.map(number => byNumber.get(number));
            // Where the game itself starts a second utterance. Asked of the
            // whole speech rather than of the row, because it is what separates
            // a boundary on the wrong row from one that is not in the game.
            const gameSplits = rows.slice(1).some(row => row.japanese.startsWith(OPENS));

            const signals = [];
            for (const row of rows.slice(1)) {
                if (!row.english.trim()) {
                    continue;
                }
                // A Japanese row holding the boundary itself is the game's own
                // layout, and the English matching it is agreement, not a fault.
                if (BOUNDARY.test(row.english) && !BOUNDARY.test(row.japanese)) {
                    signals.push({lineNumber: row.lineNumber, class: gameSplits ? "crammed" : "invented"});
                } else if (row.japanese.startsWith(OPENS) && row.english.startsWith(INDENT)) {
                    signals.push({lineNumber: row.lineNumber, class: "indented"});
                }
            }
            if (!signals.length) {
                continue;
            }
            if (draft) {
                ++drafts;
                continue;
            }
            // One finding per speech, because the repair is per speech: the rows
            // are laid out again together. Every signal is carried rather than
            // only the worst, so the count is speeches and the detail is rows --
            // a report that files a speech once and forgets the rest gives a
            // floor rather than a measurement, which is what docs/speech-brackets.md
            // cost to learn.
            findings.push({
                file: fileName,
                lineNumber: speech.lineNumber,
                speaker: speech.speaker,
                class: CLASSES.find(name => signals.some(signal => signal.class === name)),
                signals,
                rows,
            });
        }
    }

    return {scenes: scenes.length, speeches, findings, drafts};
};

/** How many findings each class holds, in the order they are worth reading. */
export const countByClass = (findings) => Object.fromEntries(
    CLASSES.map(name => [name, findings.filter(finding => finding.class === name).length]));
