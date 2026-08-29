/**
 * What one text language says, line by line, on the numbering the game uses.
 *
 * Two shapes, and the first is the one to write new things against.
 *
 * **One file per scene**, under text_languages/<lang>/scenes/. The numbers are
 * the game's already, every message sits in exactly one scene so no number is
 * claimed twice, and the row carries the game's own Japanese beside the English
 * rather than a copy somebody retyped. modules/SceneFile.js is the format.
 *
 * **A corpus of chunk files**, which is what the scenes were rendered out of:
 * gpt_outputs written against v1.00 and gpt_outputs_v104 for the lines v1.04
 * added. Reading one is also moving it onto the game's numbering, which is what
 * modules/LineNumbers.js is for -- a record whose v1.00 number found no partner
 * is dropped, because there is no slot in the game being patched to put it in.
 * It comes back in file order and may name the same line twice, since the chunk
 * ranges overlap; callers key by line number and take the last, which is what
 * rendering the patch has always done.
 *
 * Both hand back the same record -- a line number, the Japanese it stands for
 * and the English -- so what reads a language does not have to know which shape
 * it keeps. The Japanese differs between them on 5081 records and it costs
 * nothing: rendering the patch from either gives the same 269617 lines, because
 * the only thing that reads that field is the name repair pass and the repairs
 * were written into the text years ago. docs/baked-name-repairs.md is that.
 */
import * as fs from "fs/promises";
import * as path from "path";
import {speechesOf} from "./SceneFile.js";
import {readTranslatedScenes} from "./SceneTranslations.js";

/** One folder of chunk files, read in line-number order, records concatenated. */
const readTranslations = async (folderPath) => {
    const chunkFileNames = await fs.readdir(folderPath);
    const chunkFiles = chunkFileNames
        .map(fileName => {
            const [, startLineNumber, endLineNumber] = fileName.match(/^(\d+)_(\d+)\.json$/);
            return {
                fileName,
                startLineNumber: Number(startLineNumber),
                endLineNumber: Number(endLineNumber),
            };
        })
        .sort((a,b) => a.startLineNumber - b.startLineNumber);

    const allLineRecords = [];

    for (const chunkFile of chunkFiles) {
        const json = await fs.readFile(folderPath + "/" + chunkFile.fileName, "utf-8");
        let data;
        try {
            data = JSON.parse(json);
        } catch (error) {
            error.message += 'At file ' + chunkFile.fileName;
            throw error;
        }
        allLineRecords.push(...data.output_parsed.translationLines);
    }

    return allLineRecords;
};

/**
 * A corpus is written against the v1.00 line numbers, plus a second folder for
 * the lines v1.04 added, so reading one is also moving it onto the numbering
 * the game being patched uses.
 *
 * @param {string} root a text language's folder, from modules/TextLanguages.js
 * @param {Map<number, number>} v100ToV104 from modules/LineNumbers.js
 */
export const readCorpus = async (root, v100ToV104) => {
    const allLineRecordsV100 = await readTranslations(path.join(root, "gpt_outputs"));
    const allLineRecordsV104 = await readTranslations(path.join(root, "gpt_outputs_v104"));
    return allLineRecordsV100
        .flatMap(lr => {
            const v104LineNumber = v100ToV104.get(+lr.lineNumber);
            if (!v104LineNumber) {
                return [];
            } else {
                return { ...lr, lineNumber: v104LineNumber };
            }
        })
        .concat(allLineRecordsV104);
};

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
