/**
 * build/scenes/<lang>/index.tsv: one row per scene, so deciding what to
 * translate next does not mean opening 5433 files.
 *
 *     # file	flags	lines	scene
 *     030324.tsv		80	サーナキア／キャライベントＡ
 *     031358.tsv	cg	77	００／ヌヌハラ／ランス
 *
 * Reader and writer together, for the reason modules/SceneFile.js gives about
 * the scene files themselves: this is a tab-separated format whose last column
 * is free text, and a second implementation of the split is how a scene name
 * holding a tab quietly moves every column after it. scripts/extract_scenes.js
 * wrote it inline until the driver wanted to read it.
 *
 * The flags are routing hints and nothing more. What each of them means is in
 * scripts/extract_scenes.js, which decides them; what they do not promise is in
 * modules/CgGallery.js.
 */
import * as fs from "fs/promises";
import * as path from "path";
import {BUILD} from "./Env.js";
import {escapeCell, unescapeCell} from "./SceneFile.js";
import {translatedScenesDir} from "./SceneTranslations.js";

/** Where every text language's scenes go, and the one file shared across them. */
export const SCENES = path.join(BUILD, "scenes");

/** build/scenes/<lang>: one folder per text language, one file per scene. */
export const sceneDir = (lang) => path.join(BUILD, "scenes", lang);

export const sceneIndexFile = (lang) => path.join(sceneDir(lang), "index.tsv");

/** Scenes the CG recollection gallery replays. 131 of them, 27617 lines. */
export const CG_FLAG = "cg";

/** Scenes holding a line the game plays on only one of El's two routes. */
export const ROUTE_FLAG = "route";

const HEADER = "# file\tflags\tlines\tscene";

/**
 * @param {{fileName: string, flags: string[], lines: number, name: string}[]} scenes
 */
export const renderSceneIndex = (scenes) => [
    HEADER,
    ...scenes.map(scene =>
        [scene.fileName, scene.flags.join(","), scene.lines, escapeCell(scene.name)].join("\t")),
].join("\n") + "\n";

/**
 * @return {Promise<{fileName: string, flags: string[], lines: number, name: string}[]>}
 */
export const readSceneIndex = async (lang) => {
    const file = sceneIndexFile(lang);
    let text;
    try {
        text = await fs.readFile(file, "utf-8");
    } catch (error) {
        if (error.code !== "ENOENT") {
            throw error;
        }
        throw new Error(`${path.relative(BUILD, file)} is not there, so nothing says what the scenes are.`
            + " Run npm run extract-scenes first -- build/ is a build product and a fresh checkout has none.");
    }
    const scenes = [];
    for (const line of text.split(/\r?\n/)) {
        if (!line || line.startsWith("# ")) {
            continue;
        }
        const cells = line.split("\t");
        if (cells.length !== 4) {
            throw new Error(`${path.basename(file)}: ${cells.length} columns, not 4,`
                + ` in ${JSON.stringify(line)}`);
        }
        scenes.push({
            fileName: cells[0],
            flags: cells[1].split(",").filter(Boolean),
            lines: Number(cells[2]),
            name: unescapeCell(cells[3]),
        });
    }
    return scenes;
};

/**
 * Which scenes are already translated, as a set of file names.
 *
 * A directory listing rather than a ledger, which is the whole reason
 * modules/SceneTranslations.js keeps one file per scene: an interrupted run
 * leaves no half-written state to reconcile, and re-translating a scene
 * overwrites one file. Nothing has to be told what happened last time.
 */
export const translatedFileNames = async (lang) => {
    try {
        return new Set((await fs.readdir(translatedScenesDir(lang))).filter(name => name.endsWith(".tsv")));
    } catch (error) {
        if (error.code === "ENOENT") {
            return new Set();
        }
        throw error;
    }
};

/**
 * The orders a run can go in.
 *
 * "index" is the .ain's own order, which is roughly the order the scenes were
 * written and so roughly the order they are played -- the useful default,
 * because a translation reads better when the scene before it was done first.
 * The other two are for shaking the pipeline out: "small" buys coverage
 * fastest, "large" finds out early whether the biggest scene fits in one ask.
 */
export const ORDERS = {
    index: () => 0,
    small: (a, b) => a.lines - b.lines,
    large: (a, b) => b.lines - a.lines,
};
