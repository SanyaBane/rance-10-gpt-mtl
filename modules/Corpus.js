/**
 * Reading a text language's chunk files, on the numbering the game uses.
 *
 * A corpus is two folders of JSON, one record per line of dialogue: gpt_outputs
 * written against v1.00, and gpt_outputs_v104 for the lines v1.04 added. So
 * reading one is also moving it, and modules/LineNumbers.js is what it is moved
 * with -- a record whose v1.00 number found no partner is dropped, because
 * there is no slot in the game being patched to put it in.
 *
 * Here rather than inline in scripts/regenerate_aai_txt.js because rendering
 * the patch is no longer the only thing that reads a corpus. The chunk file
 * names carry line numbers of their own, the two folders have to be read in
 * that order and concatenated in that order, and a second copy of those rules
 * would not fail -- it would quietly answer a slightly different question.
 *
 * What comes back is in file order and may name the same line twice: a chunk
 * that overlaps its neighbour, or a duplicated number the corpus never had
 * squeezed out. Callers that key by line number take the last, which is what
 * rendering the patch has always done.
 */
import * as fs from "fs/promises";
import * as path from "path";

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
