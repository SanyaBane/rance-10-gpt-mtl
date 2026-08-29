/**
 * What one text language says, line by line, on the numbering the game uses.
 *
 * **One file per scene**, under text_languages/<lang>/scenes/. The numbers are
 * the game's already, every message sits in exactly one scene so no number is
 * claimed twice, and the row carries the game's own Japanese beside the English
 * rather than a copy somebody retyped. modules/SceneFile.js is the format.
 *
 * It was one of two until this commit. The other was a corpus of chunk files --
 * gpt_outputs written against v1.00 and gpt_outputs_v104 for the lines v1.04
 * added -- which the scenes were rendered out of, and reading one was also
 * moving it onto the game's numbering through modules/LineNumbers.js. Both gave
 * the same 269617 lines: the Japanese column only ever fed the name repair pass
 * and those repairs were written into the text years ago, which is
 * docs/baked-name-repairs.md. docs/scene-corpus-migration.md is the move.
 *
 * Two readers below, and choosing between them is a question about blanks: a
 * build wants what the game should be given, a report wants what the text says.
 */
import {speechesOf} from "./SceneFile.js";
import {readTranslatedScenes} from "./SceneTranslations.js";

/**
 * The same records out of one file per scene, on the game's numbering already.
 *
 * **The speech decides, and the row is written.** A speech nobody has
 * translated is left out entirely rather than written empty, because a line the
 * patch does not name plays in the game's own Japanese and an empty one plays
 * as an empty bubble -- untranslated Japanese is the better of those. But every
 * row of a speech that *has* been translated is written, including the rows
 * with nothing on them: the draft answers a whole utterance on its first row
 * and leaves the rest empty, so skipping those would put an English sentence on
 * one row of a bubble and the game's Japanese on the next. 1801 rows are that
 * shape. docs/speech-gaps.md is what else it costs and what fixes it.
 *
 * Nothing here reads the cells for meaning. A cell holding a full-width space
 * is written as one, because 825 of those sit on a row the game itself leaves
 * blank -- a beat inside a bubble, or text positioned across the screen with
 * runs of spaces -- and a build that decided such a cell was "empty enough"
 * would be deciding it about the game's own layout.
 *
 * @param {string} lang
 * @return {Promise<{records: object[], scenes: number, skipped: number}>}
 */
export const readSceneDialogue = async (lang) => {
    const scenes = await readTranslatedScenes(lang);
    const records = [];
    let skipped = 0;
    for (const {scene} of scenes) {
        const byNumber = new Map(scene.rows.map(row => [row.lineNumber, row]));
        for (const speech of speechesOf(scene)) {
            if (!speech.english.trim()) {
                skipped += speech.rows.length;
                continue;
            }
            for (const number of speech.rows) {
                const row = byNumber.get(number);
                records.push({
                    lineNumber: row.lineNumber,
                    originalJapaneseLine: row.japanese,
                    translatedEnglishLine: row.english,
                });
            }
        }
    }
    return {records, scenes: scenes.length, skipped};
};

/**
 * Every row of a language's scenes as it stands, which is what a report wants.
 *
 * readSceneDialogue above is what a build reads, and it applies the speech
 * rule: a speech nobody has translated is left out whole, so what comes back is
 * what the game would be given. A report asks the other question -- what does
 * the text say today -- so this hands back the cells as written, blanks
 * included, with the file each came from, because a finding nobody can open is
 * half a finding.
 *
 * The Japanese is the game's own either way. A scene row carries the dump's,
 * checked at every extraction, where a chunk record carried a copy a model had
 * retyped and 5081 of those disagreed with the game.
 *
 * @return {Promise<{lineNumber: number, japanese: string, english: string, scene: string}[]>}
 */
export const readSceneRows = async (lang) => {
    const scenes = await readTranslatedScenes(lang);
    return scenes.flatMap(({fileName, scene}) => scene.rows.map(row => ({
        lineNumber: row.lineNumber,
        japanese: row.japanese,
        english: row.english,
        scene: fileName,
    })));
};
