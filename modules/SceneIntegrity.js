/**
 * Whether a scene file still says what the game says -- all of it except the
 * English.
 *
 * A scene file is four columns of the game's own data with a fifth column of
 * ours: the `m[]` number, the speaker the bytecode names, what the portrait is
 * doing, the Japanese, and the translation. **Only the fifth is anybody's to
 * write.** The other four are a checksum, which is the whole reason
 * modules/SceneFile.js carries them: a diff between the extraction and the
 * translation is then exactly the change in the English, and a game version
 * that moved the numbers says so at assembly rather than in the game.
 *
 * Nothing checked that. modules/SceneAcceptance.js judges what a translator
 * *answers* -- rows of "N<tab>english" -- and modules/SceneTranslations.js then
 * writes the file itself, taking only the English out of that answer, so
 * nothing a translator says can move a line number or a speaker. That covers
 * the driver in docs/scene-driver.md and nothing else. An agent handed the
 * `.tsv` and asked to improve the English edits the file directly, and the
 * columns it is not supposed to touch are one careless rewrite away from
 * moving.
 *
 * Which is not hypothetical. Commit a2a62d738 "Refine translation" joined two
 * narration speeches into one in 033243.tsv -- speaker `-` rewritten to `+`,
 * the blank line before it deleted -- and split one in 033244.tsv by adding a
 * blank line. Neither touched a word of English; both change which rows the
 * build lays a speech into, because the blank line *is* the speech boundary.
 * Neither was visible in review: a diff of a 250-line `.tsv` where every line
 * legitimately changed is not read line by line.
 *
 * ## The two references, and why the structure needs the second
 *
 * The Japanese and the line numbers are answerable from a committed dump --
 * `game/ain/Rance10.v1.04.ain.json`, through modules/LineNumbers.js -- so those
 * checks need no alice-tools, no GAME_DIR and no build. They run anywhere.
 *
 * The speaker, the portrait state and the speech boundaries are in the
 * bytecode and in no committed table, so the only thing that knows them is an
 * extraction: `build/scenes/<lang>/`, written by scripts/extract_scenes.js.
 * That folder is a build product and a fresh checkout has none, so the class is
 * skipped rather than failed when it is not there -- but when it is, it is the
 * one that catches the two faults above.
 *
 * **Any language's extraction will do.** The structure is the game's, not the
 * translation's: extract_scenes takes the numbers, the speakers and the row
 * boundaries from the `.ain` and only the English column from the corpus. So a
 * check of en_opus can hold its structure against build/scenes/en_grok/ and be
 * answering the same question. Said out loud when it happens, because a
 * borrowed reference is a fact about the run worth knowing.
 *
 * ## What it deliberately does not ask
 *
 * Whether the English is any good. Whether a speech fits its window is
 * scripts/find_speech_gaps.js, whether it kept its brackets is
 * scripts/find_speech_brackets.js, and whether it spells the names right is
 * modules/NameNormalizer.js. This asks the one question none of those can: is
 * the row still the row the game gave us.
 *
 * The two English checks that *are* here are the two that are not about
 * quality. A dropped ＜エール＞ writes one player's name into everybody's game
 * (docs/player-name-token.md), and a gender branch answered with one sentence
 * throws away half of what the game plays (modules/SceneAcceptance.js). Both
 * are silent in the English on its own, which is why they travel with the
 * structural checks rather than with the reports about wording -- and both are
 * warnings rather than faults, because 18 of the first are deliberate.
 */
import * as fs from "fs/promises";
import * as path from "path";
import {loadGameJapanese} from "./LineNumbers.js";
import {SUBSTITUTIONS, describeFlattenedRoute, flattenedRoutes} from "./SceneAcceptance.js";
import {parseSceneFile, renderSceneFile, sceneFileName, speechesOf} from "./SceneFile.js";
import {SCENES, sceneDir} from "./SceneIndex.js";
import {textLangScenes} from "./TextLanguages.js";

/**
 * Worst first, and the order the report prints them in.
 *
 * "parse" is first because it is the one that stops the file being read at all,
 * and "english" is last because it is the only one that is not a fault.
 */
export const CLASSES = ["parse", "line", "japanese", "structure", "file", "english"];

/** The classes that mean the file no longer matches the game. */
export const FAULTS = CLASSES.filter(name => name !== "english");

/** What each class is, for the report's own summary. */
export const WHAT = {
    parse: "the file is not a scene file",
    line: "an m[] number the game does not have there",
    japanese: "the Japanese column disagrees with the game",
    structure: "the speaker, the portrait or a speech boundary moved",
    file: "the file itself: its name, or what it renders back as",
    english: "the English carries something the game reads, or drops it",
};

/**
 * The extraction to hold the structure against, or null if there is none.
 *
 * The language's own first, then anybody's -- see the header for why borrowing
 * is sound. Sorted so which one gets borrowed does not depend on readdir order,
 * because a run that says "borrowed from en_grok" today and "from en_opus"
 * tomorrow reads as something having changed.
 *
 * @return {Promise<{dir: string, lang: string, borrowed: boolean} | null>}
 */
export const findReference = async (lang) => {
    const own = sceneDir(lang);
    if (await hasScenes(own)) {
        return {dir: own, lang, borrowed: false};
    }
    let others;
    try {
        others = (await fs.readdir(SCENES, {withFileTypes: true}))
            .filter(entry => entry.isDirectory())
            .map(entry => entry.name)
            .sort();
    } catch (error) {
        if (error.code === "ENOENT") {
            return null;
        }
        throw error;
    }
    for (const other of others) {
        if (await hasScenes(sceneDir(other))) {
            return {dir: sceneDir(other), lang: other, borrowed: true};
        }
    }
    return null;
};

const hasScenes = async (dir) => {
    try {
        return (await fs.readdir(dir)).some(name => name.endsWith(".tsv"));
    } catch (error) {
        if (error.code === "ENOENT") {
            return false;
        }
        throw error;
    }
};

/** The fields of a row that belong to the game and not to the translation. */
const GAME_FIELDS = [
    ["speaker", "the speaker"],
    ["state", "what the portrait is doing"],
    ["startsUtterance", "whether a new speech starts here"],
    ["route", "which of El's two routes plays this"],
];

/**
 * Everything wrong with one language's scene files that is not about wording.
 *
 * Reads the files itself rather than through modules/SceneTranslations.js,
 * which is the one place this cannot reuse: readTranslatedScenes parses as it
 * reads, so one unparseable file throws and there is no report at all. A
 * validator that dies on the first broken file is the wrong shape -- the
 * broken file is the finding.
 *
 * @param {string} lang
 * @param {string} [only] one scene, "033243" or "033243.tsv"
 * @return {Promise<{
 *     findings: {file: string, class: string, lineNumber: number|null, kind: string}[],
 *     scenes: number,
 *     rows: number,
 *     gameLines: number,
 *     uncovered: number,
 *     reference: {dir: string, lang: string, borrowed: boolean} | null,
 * }>}
 */
export const checkScenes = async (lang, only) => {
    const wanted = only && (only.endsWith(".tsv") ? only : `${only}.tsv`);
    const dir = textLangScenes(lang);
    let fileNames;
    try {
        fileNames = (await fs.readdir(dir)).filter(name => name.endsWith(".tsv")).sort();
    } catch (error) {
        if (error.code !== "ENOENT") {
            throw error;
        }
        fileNames = [];
    }
    if (wanted) {
        fileNames = fileNames.filter(name => name === wanted);
    }

    const japaneseByLineNumber = await loadGameJapanese();
    const reference = await findReference(lang);
    const findings = [];
    const add = (file, className, lineNumber, kind) =>
        findings.push({file, class: className, lineNumber, kind});

    /*
     * Which file claimed each number, across the whole language.
     *
     * Every one of the game's messages sits in exactly one scene function, so
     * two files claiming a number means one of them was edited into holding a
     * row that is not its own -- a copy-paste between scenes, which is the
     * fault assemblePatch would otherwise be the first to notice.
     */
    const claimedBy = new Map();
    let rows = 0;

    /*
     * The duplicates gathered per pair of files rather than per row.
     *
     * A whole scene copied to a second name -- which is how this gets tested,
     * and a plausible way to make it happen for real -- is one mistake, and
     * reporting it once per row buries every other class under two hundred
     * lines saying the same thing. The first number is kept because it is what
     * somebody would go and look at.
     */
    const duplicates = new Map();

    for (const fileName of fileNames) {
        const text = await fs.readFile(path.join(dir, fileName), "utf-8");
        let scene;
        try {
            scene = parseSceneFile(text);
        } catch (error) {
            add(fileName, "parse", null, error.message);
            continue;
        }

        if (sceneFileName(scene.functionId) !== fileName) {
            add(fileName, "file", null, `the header says scene ${scene.functionId}, which is`
                + ` ${sceneFileName(scene.functionId)}`);
        }
        /*
         * Rendering what was parsed has to reproduce the file byte for byte.
         *
         * One comparison covering the escaping, the column count, the blank
         * lines and the line endings at once, the way scripts/extract_scenes.js
         * asserts it over its own output. It is the check that fires when a
         * file has been edited by something that does not know the format --
         * CRLF written back over LF, a trailing space added to a cell, the
         * final newline dropped.
         */
        if (renderSceneFile(scene) !== text) {
            add(fileName, "file", null, "rendering what was read does not reproduce the file"
                + " -- line endings, an edited blank line, or whitespace on the end of a cell");
        }

        let previous = null;
        for (const row of scene.rows) {
            rows++;
            const claimed = claimedBy.get(row.lineNumber);
            if (claimed) {
                const key = `${fileName}\t${claimed}`;
                const held = duplicates.get(key) ?? {file: fileName, other: claimed, rows: 0,
                    first: row.lineNumber};
                held.rows++;
                duplicates.set(key, held);
            } else {
                claimedBy.set(row.lineNumber, fileName);
            }
            if (previous !== null && row.lineNumber <= previous) {
                add(fileName, "line", row.lineNumber, `out of order: it follows ${previous}`);
            }
            previous = row.lineNumber;

            const japanese = japaneseByLineNumber.get(row.lineNumber);
            if (japanese === undefined) {
                add(fileName, "line", row.lineNumber, "the game has no such message");
            } else if (japanese !== row.japanese) {
                add(fileName, "japanese", row.lineNumber, `the file says ${JSON.stringify(row.japanese)}`
                    + `, the game says ${JSON.stringify(japanese)}`);
            }
        }

        if (reference) {
            await checkStructure(reference, fileName, scene, add);
        }
        checkEnglish(fileName, scene, add);
    }

    for (const {file, other, rows: shared, first} of duplicates.values()) {
        add(file, "line", first, `${shared} of its rows are also claimed by ${other}, from`
            + ` m[${first}] -- every message of the game sits in exactly one scene`);
    }

    /*
     * How much of the game these scenes do not name.
     *
     * A number rather than a list of findings, because for a translation still
     * being written it is the work left rather than a fault -- en_opus names a
     * few hundred lines on purpose. It earns its place because for a language
     * that did cover everything, a jump in it is a scene file that lost rows.
     */
    let uncovered = 0;
    if (!wanted) {
        for (const lineNumber of japaneseByLineNumber.keys()) {
            if (!claimedBy.has(lineNumber)) {
                uncovered++;
            }
        }
    }

    return {
        findings,
        scenes: fileNames.length,
        rows,
        gameLines: japaneseByLineNumber.size,
        uncovered,
        reference,
    };
};

/**
 * The four columns the game wrote, against a fresh extraction of them.
 *
 * Row by row on the line number rather than position by position: a file that
 * gained or lost a row would otherwise report every row after it, and the one
 * fact worth having is which rows moved.
 */
const checkStructure = async (reference, fileName, scene, add) => {
    let text;
    try {
        text = await fs.readFile(path.join(reference.dir, fileName), "utf-8");
    } catch (error) {
        if (error.code !== "ENOENT") {
            throw error;
        }
        // A scene the extraction does not have at all. Worth saying, because
        // either the file is not the game's or the extraction is stale, and
        // both are things to find out before building.
        add(fileName, "structure", null, `build/scenes/${reference.lang}/ has no such scene --`
            + " either it is not one of the game's, or the extraction predates it");
        return;
    }
    const extracted = parseSceneFile(text);

    if (extracted.name !== scene.name) {
        add(fileName, "structure", null, `the scene is called ${JSON.stringify(extracted.name)}`
            + `, not ${JSON.stringify(scene.name)}`);
    }
    if (extracted.flags.join(",") !== scene.flags.join(",")) {
        add(fileName, "structure", null, `the flags are ${JSON.stringify(extracted.flags.join(","))}`
            + `, not ${JSON.stringify(scene.flags.join(","))}`);
    }
    if (JSON.stringify(extracted.cast) !== JSON.stringify(scene.cast)) {
        add(fileName, "structure", null, `the cast list is ${extracted.cast.length} lines in the`
            + ` extraction and ${scene.cast.length} here, or they differ`);
    }
    if (extracted.rows.length !== scene.rows.length) {
        add(fileName, "structure", null, `${scene.rows.length} rows against the extraction's`
            + ` ${extracted.rows.length}`);
    }

    const byNumber = new Map(extracted.rows.map(row => [row.lineNumber, row]));
    for (const row of scene.rows) {
        const want = byNumber.get(row.lineNumber);
        if (!want) {
            // Already reported as a line the game does not have, if that is
            // what it is; a number the game has but this scene does not is the
            // copy-paste the "line" class describes.
            continue;
        }
        for (const [field, what] of GAME_FIELDS) {
            if (String(row[field] ?? "") !== String(want[field] ?? "")) {
                add(fileName, "structure", row.lineNumber, `${what}: ${JSON.stringify(row[field] ?? "")}`
                    + ` against the extraction's ${JSON.stringify(want[field] ?? "")}`);
            }
        }
    }
};

/**
 * The two things about the English that are not questions of wording.
 *
 * Asked of the speech rather than of the row, which is the rule
 * docs/speech-brackets.md paid for: a translation answers a whole utterance and
 * its rows are where Japanese typesetting fell, so a token that moved from one
 * row of a bubble to the next has not gone anywhere.
 */
const checkEnglish = (fileName, scene, add) => {
    const speeches = speechesOf(scene);
    const english = new Map(speeches.map(speech => [speech.lineNumber, speech.english]));
    for (const speech of speeches) {
        if (!speech.english.trim()) {
            continue;
        }
        for (const token of SUBSTITUTIONS) {
            if (speech.japanese.includes(token) && !speech.english.includes(token)) {
                add(fileName, "english", speech.lineNumber, `drops ${token}, which the game replaces`
                    + " with the name the player typed");
            }
        }
    }
    for (const flattened of flattenedRoutes(speeches, english)) {
        add(fileName, "english", flattened.male.lineNumber, describeFlattenedRoute(flattened));
    }
};

/** How many findings each class holds, for the summary. */
export const countByClass = (findings) => Object.fromEntries(CLASSES
    .map(name => [name, findings.filter(finding => finding.class === name).length])
    .filter(([, count]) => count));
