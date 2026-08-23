/**
 * A retranslation kept one file per scene, and the patch assembled out of it.
 *
 * text_languages/<lang>/scenes/030774.tsv is the source of truth: the same four
 * columns scripts/extract_scenes.js lays out, with the English replaced. A
 * scene file exists exactly when that scene has been translated, so coverage is
 * a directory listing, a diff against build/scenes/<source>/ is exactly the
 * change in the English, and re-translating a scene overwrites one file.
 *
 * Under text_languages/ rather than under build/, which is the part worth being
 * deliberate about. The input scenes are derived and disposable --
 * scripts/extract_scenes.js deletes and rewrites its whole output folder every
 * run, and build/ is documented as safe to delete outright. A translation is
 * the most expensive thing in the project and belongs on the other side of that
 * line, in the folder the repository already gives to "one folder per text the
 * game can be built with".
 *
 * dialogue.ain.txt is then generated from these and never edited: the build
 * knows two shapes of text language, a corpus of chunk files or one finished
 * patch, and has no third that reads a folder of scenes. Rewritten whole rather
 * than appended to, so it cannot drift from the scenes it came from and cannot
 * grow a second opinion about a line.
 *
 * Assembling can never hit a conflict, and that is a property of the game
 * rather than of this code: every one of the 269677 messages sits in exactly
 * one scene function, so two scene files cannot both claim a line number. It is
 * checked anyway -- the day that stops being true is the day the numbers moved,
 * and finding that out here beats finding it out in the game.
 */
import * as fs from "fs/promises";
import * as path from "path";
import {parseSceneFile, renderSceneFile, sceneFileName, speechesOf} from "./SceneFile.js";
import {layOutSpeech} from "./SpeechRows.js";
import {textLangDir} from "./TextLanguages.js";

/** text_languages/<lang>/scenes: the translation, one file per scene. */
export const translatedScenesDir = (lang) => path.join(textLangDir(lang), "scenes");

/**
 * Write one accepted scene, replacing whatever was there.
 *
 * The source scene is what gets written -- its header, its cast, its Japanese,
 * its blank lines -- with only the English column taken from the translation.
 * Nothing a translator says can move a line number or a speaker that way.
 *
 * The English is keyed by speech and the file has a line per row, so the
 * utterance goes on the speech's first row and its continuations are written
 * **blank**. Blank rather than left alone: renderSceneFile falls back to the
 * row's existing English, which in the source scene is the en_grok draft, so
 * skipping them would file half a machine translation inside a retranslated
 * scene and nothing downstream would notice. assemblePatch joins the rows of a
 * speech back up before laying it out, so the blanks cost nothing.
 *
 * @param {string} lang
 * @param {ReturnType<parseSceneFile>} scene the source scene, from build/scenes
 * @param {Map<number, string>} english an accepted acceptTranslation().english,
 *        keyed by the first row of each speech
 */
export const writeTranslatedScene = async (lang, scene, english) => {
    const dir = translatedScenesDir(lang);
    await fs.mkdir(dir, {recursive: true});
    const file = path.join(dir, sceneFileName(scene.functionId));
    const perRow = new Map();
    for (const speech of speechesOf(scene)) {
        speech.rows.forEach((lineNumber, at) => {
            perRow.set(lineNumber, at === 0 ? (english.get(speech.lineNumber) ?? "") : "");
        });
    }
    await fs.writeFile(file, renderSceneFile(scene, perRow), "utf-8");
    return file;
};

/**
 * Every scene translated so far, in scene order.
 *
 * @return {Promise<{fileName: string, scene: ReturnType<parseSceneFile>}[]>}
 */
export const readTranslatedScenes = async (lang) => {
    const dir = translatedScenesDir(lang);
    let fileNames;
    try {
        fileNames = await fs.readdir(dir);
    } catch (error) {
        if (error.code === "ENOENT") {
            return [];
        }
        throw error;
    }
    const scenes = [];
    for (const fileName of fileNames.filter(name => name.endsWith(".tsv")).sort()) {
        const text = await fs.readFile(path.join(dir, fileName), "utf-8");
        scenes.push({fileName, scene: parseSceneFile(text)});
    }
    return scenes;
};

/**
 * The dialogue.ain.txt those scenes make, and what went into it.
 *
 * A line with no English is left out rather than written empty: the build
 * renders the default text language underneath a patch, and an empty string
 * would override that with nothing where leaving the line unnamed lets the
 * draft show through. Ten of the game's messages are empty in Japanese too.
 *
 * **The speech is the unit, and the rows are worked out here.** A translation
 * is written and stored as whole utterances -- the English of a speech sits on
 * its first row and its continuations are blank -- because the rows are where
 * Japanese typesetting fell at twenty-four full-width characters, and English
 * shaped to them loses words to them. modules/SpeechRows.js puts each speech
 * back into exactly the rows the bytecode gave it.
 *
 * Doing it here rather than at acceptance is what keeps that reversible: the
 * division is a build product, so changing how it is divided is a rebuild and
 * never an edit to a committed translation.
 *
 * A file whose English sits on every row instead -- the shape the first two
 * scenes were accepted in -- assembles the same way and needs no conversion:
 * speechesOf joins the rows of a speech back into the utterance before this
 * ever sees them, so an older file is simply laid out again.
 *
 * @return {Promise<{text: string, scenes: number, lines: number, skipped: number}>}
 */
export const assemblePatch = async (lang) => {
    const translated = await readTranslatedScenes(lang);
    const byLineNumber = new Map();
    const owner = new Map();
    let skipped = 0;
    for (const {fileName, scene} of translated) {
        for (const speech of speechesOf(scene)) {
            if (!speech.english) {
                skipped += speech.rows.length;
                continue;
            }
            const {rows} = layOutSpeech(speech.english, speech.rows.length);
            speech.rows.forEach((lineNumber, at) => {
                if (owner.has(lineNumber)) {
                    throw new Error(`line ${lineNumber} is claimed by both ${owner.get(lineNumber)}`
                        + ` and ${fileName}. A line belongs to one scene, so the line numbers have moved --`
                        + " regenerate the scenes before assembling this.");
                }
                owner.set(lineNumber, fileName);
                byLineNumber.set(lineNumber, rows[at]);
            });
        }
    }
    const text = [...byLineNumber.keys()]
        .sort((a, b) => a - b)
        .map(lineNumber => `m[${lineNumber}] = ${JSON.stringify(byLineNumber.get(lineNumber))}`)
        .join("\n");
    return {text: text + "\n", scenes: translated.length, lines: byLineNumber.size, skipped};
};
