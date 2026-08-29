/**
 * What the game says on an m[] number, and how a number moves between game
 * versions.
 *
 * The first of those is what every caller wants. The game's own Japanese for a
 * number is the authority a translation is checked against, and a corpus
 * record's own copy of it was not: 5081 of the chunk corpus's 275293 records
 * disagreed with the dump. Most of that was a dropped closing bracket or an
 * ellipsis retyped as dots, but 1461 differed by more than punctuation and
 * m[8922] had 言わず where the game says 言わさず, because that corpus was written
 * by a model that re-typed the Japanese rather than copying it. A scene row
 * carries the dump's Japanese for exactly that reason.
 *
 * The second is archaeology now, and is called on purpose rather than paid for
 * on every run. The translation was written against v1.00 and the game ships
 * v1.04, which inserted lines: a chunk record's lineNumber was a v1.00 index,
 * and the .ain a build edits numbers the same line differently. mapLineNumbers
 * walks the two committed dumps in file order and pairs them by the Japanese,
 * never looking backwards -- so a v1.04 insertion shifts nothing after it, it
 * simply goes unmapped. 264632 of the v1.00 numbers find a partner that way and
 * 5044 v1.04 lines are left over, which is what the second chunk folder was
 * translated from.
 *
 * Nothing in the working tree is keyed by a v1.00 number any more -- the chunk
 * corpus was deleted on 2026-08-29. What keeps the walk here is that both
 * corpora are still in git and docs/text-languages.md tells you to read a line
 * out of one: placing such a number on the game's numbering by eye is the fault
 * eec7f479 and 8fbf3793 each spent a commit repairing, and it is invisible
 * until somebody plays the scene.
 */
import * as fs from "fs/promises";
import {AIN_JSON, AIN_V100_JSON} from "./AinFiles.js";

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
 * The game's own Japanese, by line number, off the committed v1.04 dump.
 *
 * One dump rather than two. This read the v1.00 one as well until the mapping
 * above lost its last caller, which was 543 ms of the 806 it took, on four
 * scripts, for a Map nobody asked for. Neither dump is touched by any build, so
 * this needs no GAME_DIR and no alice-tools.
 *
 * @return {Promise<Map<number, string>>}
 */
export const loadGameJapanese = async () => {
    const v104AinData = JSON.parse(await fs.readFile(AIN_JSON, "utf-8"));
    return new Map(v104AinData.map(rec => [+rec.lineNumber, rec.originalJapaneseLine]));
};

/**
 * The v1.00 to v1.04 mapping, and the v1.04 lines it cannot reach.
 *
 * No build calls this. What it is for is placing a line out of an archived
 * corpus -- git show en_gpt-final:text_languages/en_gpt/gpt_outputs/... -- onto
 * the numbering the game uses, which is the one thing a v1.00 number is still
 * good for. docs/text-languages.md is where that instruction lives.
 *
 * @return {Promise<{v100ToV104: Map<number, number>, unmapped: object[]}>}
 */
export const loadLineNumberMap = async () => {
    const [v100AinData, v104AinData] = await Promise.all([
        fs.readFile(AIN_V100_JSON, "utf-8").then(JSON.parse),
        fs.readFile(AIN_JSON, "utf-8").then(JSON.parse),
    ]);
    const [v100ToV104, unmapped] = mapLineNumbers(v100AinData, v104AinData);
    return {v100ToV104, unmapped};
};
