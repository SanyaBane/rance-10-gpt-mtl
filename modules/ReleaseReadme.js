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
 * every feature has, and the switch the ones with a switch name -- so the next
 * feature brings its own bullet rather than a line being added here. The bullet
 * itself, and the instruction under the list, are modules/CustomMods.js, which
 * writes the page inside custom_mods out of exactly the same pieces.
 *
 * Written for whoever installed the patch and nobody else. What a file is
 * called inside the game, when the switch is read, what the feature is called
 * under features/ -- none of that is on this page: it is three steps to
 * install, a list of what is in the folder, and what each optional feature
 * changes.
 */
import * as path from "path";
import {AIN} from "./AinFiles.js";
import {featureBullet, switchedFeatures, switchingLines} from "./CustomMods.js";
import {CUSTOM_MODS} from "./Features.js";
import {isTranslated, TEXT_LANGS} from "./TextLanguages.js";
import {PATCH_TAG} from "./Version.js";
import {wrap} from "./Wrap.js";

/** Rance10.v1.04, the game build every file here was made from. */
const GAME_BUILD = path.basename(AIN, ".ain");

const FILES = {
    "Rance10.ain": "the script: dialogue, menus, and everything the battle screen says",
    "Rance10EX.ex": "skill and character descriptions, the quests, and the synopsis screen",
    "Rance10Pact.afa": "the interface",
};

/**
 * A count in words, because "the same 4 optional features" is a page written by
 * a program and "the same four" is a sentence. Past ten it goes back to digits,
 * which is a number of features nobody is going to read as prose anyway.
 */
const spelled = (n) => ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
    "ten"][n] ?? String(n);

/** The files a folder of this text language holds, in the order they matter. */
export const filesFor = (lang) => (isTranslated(lang)
    ? ["Rance10.ain", "Rance10EX.ex", "Rance10Pact.afa"]
    : ["Rance10.ain"]);

/**
 * The features this build carries: what each one changes, and one instruction
 * about the files that switch them rather than the same two sentences four
 * times over. The bullets are modules/CustomMods.js, because the page inside
 * custom_mods lists the same things and the two saying it differently would be
 * two answers to one question.
 */
const featureSection = (features) => {
    if (features.length === 0) {
        return ["## Optional features", "",
            ...wrap("None. This build changes what the game says and never how it plays.")];
    }
    const switched = switchedFeatures(features);
    return ["## Optional features", "",
        ...wrap("These come with the patch. Unlike the rest of it, they change how the game plays rather than"
            + " what it says in English, so each one is yours to keep or turn off. Not sure you want any of"
            + ` them? Leave the \`${CUSTOM_MODS}\` folder out when you copy: what is left is the translation`
            + " and nothing else, and the game plays exactly the way it always has."),
        "",
        ...features.flatMap(featureBullet),
        ...(switched.length > 0
            ? ["", ...switchingLines(`The \`${CUSTOM_MODS}\` folder here`)]
            : []),
    ];
};

/**
 * The lines the index says about the features, which depend on whether any of
 * them is switched by a file -- a page that promises a folder of switches for a
 * build whose features have none sends whoever reads it looking for one. The
 * names under features/ are this repository's and stay out of it: what the
 * player needs from this page is that the features are there and already on.
 */
const featureNote = (features) => {
    if (features.length === 0) {
        return wrap("These builds carry no optional features: they change what the game says and never how it"
            + " plays.");
    }
    const many = features.length === 1
        ? "one optional feature"
        : `the same ${spelled(features.length)} optional features`;
    return switchedFeatures(features).length > 0
        ? wrap(`Every folder here carries ${many}, which change how the game plays rather than what it says.`
            + ` Each folder's \`${CUSTOM_MODS}\` has them switched on already, and that folder's README says`
            + " what each file changes and how to turn one off.")
        : wrap(`Every folder here carries ${many}, which change how the game plays rather than what it says.`
            + " Each folder's README says what they do.");
};

/**
 * The page in one release folder.
 *
 * Three steps first and the detail after them, because installing this is
 * copying a folder and everything else on the page is something you only need
 * once it is copied. Nothing here is folded by hand: wrap() does it, so a
 * sentence can be edited without re-folding the paragraph under it, and the
 * page is the same 80 columns wherever it was generated.
 */
export const renderFolderReadme = (lang, features) => {
    const files = filesFor(lang);
    const lines = [
        `# Rance 10 — ${lang}`,
        "",
        `${TEXT_LANGS[lang].summary[0].toUpperCase()}${TEXT_LANGS[lang].summary.slice(1)}.`,
        `Patch ${PATCH_TAG}, built from ${GAME_BUILD}.`,
        "",
        "## Quick start",
        "",
        ...wrap("Make a copy of your Rance 10 folder, or at least of the files listed below —"
            + " nothing here puts the originals back.", "1. ", "   "),
        ...wrap("Copy everything in this folder into your Rance 10 folder, the one holding `Rance10.exe`,"
            + " over what is already there.", "2. ", "   "),
        ...wrap("Play. The rest of this page is only worth reading if you want to change what the optional"
            + " features do.", "3. ", "   "),
        "",
        "## What is in this folder",
        "",
        "| Name | What it holds |",
        "|---|---|",
        ...files.map(file => `| \`${file}\` | ${FILES[file]} |`),
        ...(switchedFeatures(features).length > 0
            ? [`| \`${CUSTOM_MODS}\\\` | the switches for the optional features below, every one already on |`]
            : []),
        "",
    ];
    if (isTranslated(lang)) {
        lines.push(
            ...wrap("The images are not in here. The two archives holding the drawn-in Japanese are packed by"
                + " hand out of half a gigabyte of the game's own files, so they are not part of a build."),
            "",
        );
    } else {
        lines.push(
            "## What this does not replace",
            "",
            ...wrap("`Rance10EX.ex` and `Rance10Pact.afa` are not in here, and there is no Japanese build of"
                + " them: those two only ever exist with the English written into them. So whatever your game"
                + " folder holds is what stays — if you installed an English patch before this, the"
                + " descriptions and the interface are still English, and putting the game's own back is a"
                + " matter of your backup or a reinstall."),
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
    ...wrap(`Patch ${PATCH_TAG}. One folder per text the game can be built with, all of them from`
        + ` ${GAME_BUILD}. Copy the contents`
        + " of **one** folder into your Rance 10 folder, over what is already there. Each folder has a README"
        + " of its own saying what is in it and how to install it."),
    "",
    ...langs.flatMap(lang => wrap(`\`${lang}/\` — ${TEXT_LANGS[lang].summary}`
        + ` (${filesFor(lang).length} file${filesFor(lang).length === 1 ? "" : "s"})`, "- ", "  ")),
    "",
    ...featureNote(features),
    "",
].join("\n");
