/**
 * What an m[] line number means, and how one moves between game versions.
 *
 * The translation was written against v1.00 and the game ships v1.04, which
 * inserted lines: a corpus record's lineNumber is a v1.00 index, and the .ain a
 * build edits numbers the same line differently. mapLineNumbers walks the two
 * committed dumps in file order and pairs them by the Japanese, never looking
 * backwards -- so a v1.04 insertion shifts nothing after it, it simply goes
 * unmapped. 264632 of the v1.00 numbers find a partner that way and 5044 v1.04
 * lines are left over, which is what UNMAPPED below holds and what the second
 * corpus folder was translated from. 59 lines have no English even after that.
 *
 * Here rather than inline in scripts/regenerate_aai_txt.js because rendering
 * the patch is no longer the only thing that needs it. Anything laying the
 * corpus beside the game -- the English next to the scene and the speaker the
 * bytecode names, say -- has to move its numbers the same way, and a second
 * definition of the same walk would not fail, it would put the English out one
 * line late. That is the failure eec7f479 and 8fbf3793 each spent a commit
 * repairing, and it is invisible until somebody plays the scene.
 *
 * japaneseByLineNumber is the other half, and the reason both live in one file:
 * the game's own Japanese for a number, which is the authority. A corpus
 * record's originalJapaneseLine is not -- 5081 of 275293 records disagree with
 * the dump. Most of that is a dropped closing bracket or an ellipsis retyped as
 * dots, but 1461 differ by more than punctuation, and m[8922] has 言わず where
 * the game says 言わさず: the corpus was written by a model that re-typed the
 * Japanese rather than copying it. readPatch reads the dump because a patch
 * carries no Japanese of its own; everything else should read it on purpose.
 */
import * as fs from "fs/promises";
import * as path from "path";
import {AIN_JSON, AIN_V100_JSON} from "./AinFiles.js";
import {BUILD} from "./Env.js";

/**
 * The v1.04 lines no corpus covers, for scripts/translate_chunks.js to feed on.
 *
 * A by-product of the mapping rather than something anybody asks for. A
 * constant here because the script that writes it and the script that reads it
 * used to spell the same path separately, which is one rename away from a
 * translator run that silently re-translates last week's leftovers.
 */
export const UNMAPPED = path.join(BUILD, "unmapped.ain.json");

/**
 * Pair the two dumps by their Japanese, in file order.
 *
 * @param {{lineNumber: number|string, originalJapaneseLine: string}[]} v100AinData
 * @param {{lineNumber: number|string, originalJapaneseLine: string}[]} v104AinData
 * @return {[Map<number, number>, object[]]} the v1.00 number of every line that
 *     found a partner against its v1.04 number, and the v1.04 records nothing
 *     was mapped onto.
 */
export const mapLineNumbers = (v100AinData, v104AinData) => {
    let v100Offset = 0;
    let v104LastMappedOffset = -1;
    const mapping = new Map();
    done:
    while (v100Offset < v100AinData.length) {
        for (let v104Offset = v104LastMappedOffset + 1; v104Offset < v104AinData.length; ++v104Offset) {
            const v100Record = v100AinData[v100Offset];
            const v104Record = v104AinData[v104Offset];
            if (v100Record.originalJapaneseLine === v104Record.originalJapaneseLine) {
                mapping.set(+v100Record.lineNumber, +v104Record.lineNumber);
                ++v100Offset;
                v104LastMappedOffset = v104Offset;
                if (v100Offset === v100AinData.length) {
                    break done;
                }
            }
        }
        ++v100Offset;
    }
    const mapped = new Set(mapping.values());
    const unmapped = v104AinData.filter(rec => !mapped.has(+rec.lineNumber));
    return [mapping, unmapped];
};

/**
 * The mapping and the game's Japanese, read off the two committed dumps.
 *
 * Both are wanted together often enough -- moving a corpus onto the game's
 * numbering and then asking what those numbers say -- that reading the 30 MB
 * twice for them is the wrong shape. Neither dump is touched by any build, so
 * this needs no GAME_DIR and no alice-tools.
 *
 * @return {Promise<{
 *     v100ToV104: Map<number, number>,
 *     unmapped: object[],
 *     japaneseByLineNumber: Map<number, string>,
 * }>}
 */
export const loadLineNumbers = async () => {
    const v100AinData = JSON.parse(await fs.readFile(AIN_V100_JSON, "utf-8"));
    const v104AinData = JSON.parse(await fs.readFile(AIN_JSON, "utf-8"));
    const [v100ToV104, unmapped] = mapLineNumbers(v100AinData, v104AinData);
    return {
        v100ToV104,
        unmapped,
        japaneseByLineNumber: new Map(v104AinData.map(rec => [+rec.lineNumber, rec.originalJapaneseLine])),
    };
};
