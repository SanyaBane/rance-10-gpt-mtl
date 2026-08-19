/**
 * The README a release folder is handed to the player with.
 *
 * A release folder used to say what it was by its shape: three files were the
 * translation, and an optional/<feature>/ beside them was the feature you could
 * copy over it. Now every folder holds the same file names and the differences
 * are things a folder cannot show -- which translation this is, that the panel
 * needs a file created before it does anything, that the Japanese folder
 * replaces one file of three. So each one carries a written page saying it.
 *
 * Generated rather than written by hand and copied, because two of the three
 * things it says are decided by the run: which features went in (--with= and
 * --without=) and which text language this is. A hand-written page would be
 * right until the first build that left a feature out.
 *
 * What a feature says for itself comes out of its own feature.js -- the summary
 * every feature has, and the howToTurnOn line the ones with a switch add -- so
 * the next feature brings its own paragraph rather than a line being added
 * here.
 */
import * as path from "path";
import {AIN} from "./AinFiles.js";
import {FEATURES} from "./Features.js";
import {isTranslated, TEXT_LANGS} from "./TextLanguages.js";

/** Rance10.v1.04, the game build every file here was made from. */
const GAME_BUILD = path.basename(AIN, ".ain");

const FILES = {
    "Rance10.ain": "the script: dialogue, menus, and everything the battle screen says",
    "Rance10EX.ex": "skill and character descriptions, the quests, and the synopsis screen",
    "Rance10Pact.afa": "the interface",
};

/** The files a folder of this text language holds, in the order they matter. */
export const filesFor = (lang) => (isTranslated(lang)
    ? ["Rance10.ain", "Rance10EX.ex", "Rance10Pact.afa"]
    : ["Rance10.ain"]);

/**
 * The features this build carries, as a bullet apiece: what it does, and what
 * the player has to do for it to do anything. A feature with no howToTurnOn is
 * on as soon as it is installed, and says so.
 */
const featureSection = (features) => {
    if (features.length === 0) {
        return ["## Optional features", "", "None. This build changes what the game says and never how it plays."];
    }
    const lines = ["## Optional features", "",
        "Built into the `Rance10.ain` here. They change how the game behaves rather than what it says:", ""];
    for (const name of features) {
        const feature = FEATURES[name];
        lines.push(`- **${name}** — ${feature.summary}`);
        lines.push(feature.howToTurnOn
            ? `  ${feature.howToTurnOn}`
            : "  Nothing to switch on: it is on as soon as this file is installed.");
    }
    return lines;
};

/**
 * The two lines the index says about the features, which depend on whether any
 * of them waits on the player -- a page that promises a switch nobody has to
 * throw sends whoever reads it looking for one.
 */
const featureNote = (features) => {
    if (features.length === 0) {
        return ["These builds carry no optional features: they change what the game says and",
            "never how it plays."];
    }
    const waiting = features.filter(name => FEATURES[name].howToTurnOn);
    return [`Every build here carries the optional features: ${features.join(", ")}.`,
        "Each folder's README says what they do"
        + (waiting.length > 0
            ? `, and what to create for ${waiting.length === 1 ? "the one that waits" : "the ones that wait"}`
                + " on a file of yours."
            : ".")];
};

/** The page in one release folder. */
export const renderFolderReadme = (lang, features) => {
    const files = filesFor(lang);
    const lines = [
        `# Rance 10 — ${lang}`,
        "",
        `${TEXT_LANGS[lang].summary[0].toUpperCase()}${TEXT_LANGS[lang].summary.slice(1)}.`,
        `Built from ${GAME_BUILD}.`,
        "",
        "## Installing",
        "",
        `Copy the ${files.length === 1 ? "file" : "files"} in this folder into your Rance 10 folder — the one holding`,
        "`Rance10.exe` — over what is already there. Keep a copy of the originals first:",
        "nothing here puts them back.",
        "",
        "| File | What it holds |",
        "|---|---|",
        ...files.map(file => `| \`${file}\` | ${FILES[file]} |`),
        "",
    ];
    if (isTranslated(lang)) {
        lines.push(
            "The images are not in here. The two archives holding the drawn-in Japanese are",
            "packed by hand out of half a gigabyte of the game's own files, so they are not",
            "part of a build.",
            "",
        );
    } else {
        lines.push(
            "## What this does not replace",
            "",
            "`Rance10EX.ex` and `Rance10Pact.afa` are not in here, and there is no Japanese",
            "build of them: those two only ever exist with the English written into them. So",
            "whatever your game folder holds is what stays — if you installed an English patch",
            "before this, the descriptions and the interface are still English, and putting the",
            "game's own back is a matter of your backup or a reinstall.",
            "",
        );
    }
    lines.push(...featureSection(features), "");
    return lines.join("\n");
};

/** The page beside the folders, saying which is which. */
export const renderIndexReadme = (langs, features) => [
    "# Rance 10 — patch builds",
    "",
    `One folder per text the game can be built with, all of them from ${GAME_BUILD}.`,
    "Copy the contents of **one** folder into your Rance 10 folder, over what is",
    "already there. Each folder has a README of its own saying what is in it.",
    "",
    ...langs.map(lang => `- \`${lang}/\` — ${TEXT_LANGS[lang].summary}`
        + ` (${filesFor(lang).length} file${filesFor(lang).length === 1 ? "" : "s"})`),
    "",
    ...featureNote(features),
    "",
].join("\n");
