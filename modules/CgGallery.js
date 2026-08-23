/**
 * Which scenes the CG recollection gallery lists, which is the game's own
 * statement of where its adult content is.
 *
 * 35_ＣＧ回想情報.x is a tree of the events the gallery replays, and each node's
 * イベント名 is a scene name exactly as the .ain spells it: all 131 of them
 * match a scene function, covering 27617 of the 269677 lines of dialogue.
 *
 * It is worth having because guessing from the name does not work. A substring
 * search for エロ or エッチ finds 19 of those 131 -- the rest are named 陵辱,
 * 拷問, 性教育 and the like -- while エロ in a name is more often エロピチャ, who
 * is a character called that. So a regex over scene names both misses most of
 * what it is looking for and flags a cast member.
 *
 * It is a strong first pass rather than a guarantee, and the reason is in what
 * the table is: a list of scenes that have a CG to replay. A scene with no
 * picture is not in it however explicit it is, so a pipeline that routes on
 * this flag alone still needs to handle a translator declining a scene the
 * gallery never mentioned. modules/SceneAcceptance.js is that half.
 */
import * as fs from "fs/promises";
import * as path from "path";
import {ROOT} from "./Env.js";

const EX_DIR = path.join(ROOT, "archives", "Rance10EX_v1_04");

/** The gallery, translated in place: the keys are scene names, not text. */
export const CG_GALLERY = path.join(EX_DIR, "35_ＣＧ回想情報.x");

/** イベント名 = "０２／シィルのエロ", one per node that replays anything. */
const EVENT_NAME = /^\s*イベント名\s*=\s*"(.+)"\s*,?\s*$/;

/**
 * The scene names the gallery replays.
 *
 * @return {Promise<Set<string>>}
 */
export const readGalleryScenes = async () => {
    const scenes = new Set();
    for (const line of (await fs.readFile(CG_GALLERY, "utf-8")).split(/\r?\n/)) {
        const event = EVENT_NAME.exec(line);
        if (event) {
            scenes.add(event[1]);
        }
    }
    return scenes;
};
