/**
 * The switches a release folder ships, already thrown.
 *
 * A feature is built into Rance10.ain and does nothing until the game finds the
 * file it looks for: custom_mods\<something>_on beside Rance10.exe. Which is an
 * empty file with no extension, in a folder that is not there yet, on a system
 * that hides extensions -- three ways to get it wrong before the feature has
 * done anything at all. So a release folder carries that folder ready made, one
 * empty file per feature the build put in, and the player deletes what they do
 * not want instead of creating what they do.
 *
 * A release folder only. `node scripts/release.js --game` writes into an
 * installed game, where those files belong to whoever plays it: creating one
 * there would turn a gameplay change on without being asked, and the next build
 * would put back every file they had deleted. That run says what the switches
 * are instead -- reportFeatures in scripts/release.js.
 *
 * Everything said about a switch is written here rather than in the feature,
 * because almost all of it is the same for every one of them: how to turn a
 * feature off, that neither direction takes a restart, that a save file is
 * never in question, and what Windows does to a file made in Notepad. The page
 * says that once. What only the feature knows -- the file's name, when the
 * change shows, and what is different once it is on -- is the `switch` in its
 * feature.js, and modules/Features.js checks that name against the .jaf that
 * looks it up.
 */
import * as fs from "fs";
import * as path from "path";
import {CUSTOM_MODS, FEATURES} from "./Features.js";
import {wrap} from "./Wrap.js";

/**
 * The switch as the player reads it, which is a Windows path in a sentence
 * rather than the forward-slashed one the .jaf carries.
 */
export const switchPath = (name) => `${CUSTOM_MODS}\\${FEATURES[name].switch.file}`;

/** Which of these features are turned on by a file, in the order they were given. */
export const switchedFeatures = (features) => features.filter(name => FEATURES[name].switch);

/**
 * One feature as a player-facing bullet, folded to the page width: the file
 * that switches it, what it changes, and whatever else the feature has to say
 * for itself.
 *
 * The file comes first because it is the thing the player acts on -- the name
 * under features/ is this repository's word for the feature and means nothing
 * to them. What is not here is anything the same for all of them: how to turn
 * a feature off, and that neither direction takes a restart, are said once
 * under the list (switchingLines below) rather than four times inside it.
 *
 * A feature with no switch has no file to lead with, so it leads with what it
 * does and says there is nothing to switch.
 */
export const featureBullet = (name) => {
    const {summary, switch: sw} = FEATURES[name];
    if (!sw) {
        return wrap(`${summary[0].toUpperCase()}${summary.slice(1)}. This one has no file of its own:`
            + " it is on as soon as the patch is installed.", "- ", "  ");
    }
    return wrap(`\`${sw.file}\` — ${summary}.${sw.whenOn ? ` ${sw.whenOn}` : ""}`, "- ", "  ");
};

/**
 * How switching works, said once for all of them. `folder` names the one the
 * files are in, because the page in custom_mods is standing in it and the page
 * beside custom_mods is pointing at it.
 *
 * Three paragraphs, and the third is there because of Windows rather than
 * because of the game: File Explorer hides known extensions, so a file made in
 * Notepad is really <name>.txt, the game does not find it, and the feature
 * looks broken. Renaming a file that is already there sidesteps all of it,
 * which is why that is the advice given first.
 */
export const switchingLines = (folder) => [
    ...wrap(`${folder} holds one empty file per feature, and that file being there is the whole of what turns`
        + " the feature on. The files are empty on purpose: what the game looks for is the name."),
    "",
    ...wrap("To turn a feature off, rename its file — putting `.off` on the end is enough, and it is easier to"
        + " undo than deleting. To turn it back on, take the `.off` away again. Neither takes a restart, and"
        + " switching part-way through a playthrough is safe: your saved games are not touched, and only what"
        + " happens from then on changes."),
    "",
    ...wrap("If you would rather delete and re-create than rename, mind that Windows hides file extensions: a"
        + " file Notepad saves under one of these names is really that name with `.txt` on the end, which is"
        + " not what the game looks for. Renaming a file that is already there never runs into that."),
];

/**
 * The same switch for the build log, which is read by whoever ran the build and
 * wants one line: the file, and whether this run created it. A feature with no
 * switch gets "", which is the caller's line to write -- this module has nothing
 * to say about one.
 */
export const switchNote = (name, where) => {
    const sw = FEATURES[name].switch;
    if (!sw) {
        return "";
    }
    return where
        ? `${switchPath(name)}, created ${where} -- delete it to turn this off`
        : `${switchPath(name)} -- create this empty file beside Rance10.exe to turn this on`;
};

/**
 * The page in the folder, so that a handful of extensionless files say what they
 * are. Written for whoever installed the patch and nobody else: which file
 * changes what, and how to turn one off. Every line of it is folded to the page
 * width, because the folder it sits in is opened in Notepad more often than on
 * anything that reflows.
 */
export const renderCustomModsReadme = (features) => [
    `# ${CUSTOM_MODS}`,
    "",
    ...wrap("The switches for the optional features in this patch. A feature is on while its file is in"
        + " here, and off while it is not — nothing else in the patch is affected either way."),
    "",
    ...wrap("Not sure you want any of it? Then do not copy this folder into the game at all. Everything else"
        + " in the patch is the translation, so without this folder the game plays exactly the way it always"
        + " has, in English."),
    "",
    "## What each file changes",
    "",
    ...features.flatMap(featureBullet),
    "",
    "## Turning one off, and back on",
    "",
    ...switchingLines("This folder"),
    "",
    "## Where this folder goes",
    "",
    ...wrap("Beside `Rance10.exe`, in your Rance 10 folder — copying the folder it came in puts it there. If"
        + " you already have a `custom_mods`, let the two merge rather than replacing it. The `README.md`"
        + " beside this folder says what the rest of the patch is."),
    "",
].join("\n");

/**
 * Write the folder into one release folder. Nothing at all for a build whose
 * features are on by themselves, or which was given none: an empty folder with
 * a page in it explaining that it switches nothing is worse than no folder.
 *
 * Whatever was there goes first, and every file is written again, because what
 * turns a feature on is the name being there rather than anything in it: there
 * is nothing to keep from a previous build, and a folder built twice -- the
 * second time with --without= -- would otherwise still carry the switch for a
 * feature its Rance10.ain no longer has. Which is the one failure worth going
 * out of the way for: a file that says a feature is on, beside an .ain that
 * cannot turn it on at all.
 */
export const writeCustomMods = (dir, features) => {
    const folder = path.join(dir, CUSTOM_MODS);
    fs.rmSync(folder, {recursive: true, force: true});
    const switched = switchedFeatures(features);
    if (switched.length === 0) {
        return;
    }
    fs.mkdirSync(folder, {recursive: true});
    for (const name of switched) {
        fs.writeFileSync(path.join(folder, FEATURES[name].switch.file), "");
    }
    fs.writeFileSync(path.join(folder, "README.md"), renderCustomModsReadme(switched), "utf-8");
};
