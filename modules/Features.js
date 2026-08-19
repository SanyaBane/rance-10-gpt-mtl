/**
 * The optional patches: the ones that change what the game *does* rather than
 * what it says, each under a name you can build with or without.
 *
 * A feature is a folder under features/, and everything it consists of is
 * inside that folder: the files that make the change, and a feature.js saying
 * what it does and in what order they are applied. The folder's name is the
 * feature's name. Nothing here holds a list, because features/ is the list --
 * this module reads it, scripts/ain.js applies whichever are selected,
 * scripts/release.js builds one extra .ain per feature without being told any
 * names, and adding the next one is a folder rather than an edit to any of the
 * three.
 *
 * They are on by default, because the .ain a build installs into the game is
 * the one that gets played. The release folder is the other way round: its
 * Rance10.ain is the translation and nothing else, and each feature is a
 * separate file to copy over it, so that installing the English does not mean
 * taking modified game logic with it. scripts/release.js is where that layout
 * is written down.
 */
import * as fs from "fs";
import * as path from "path";
import {pathToFileURL} from "url";
import {flagValue} from "./Argv.js";
import {ROOT} from "./Env.js";

/** One folder per feature, each holding the files it applies and the manifest naming them. */
export const FEATURES_DIR = path.join(ROOT, "features");

const MANIFEST = "feature.js";

/**
 * Which `alice ain edit` flag carries which kind of file. A manifest lists the
 * files rather than the arguments because the two never disagree -- a .jaf is
 * compiled and a .jam is assembled, whoever is asking -- and the order it
 * lists them in is the order alice-tools gets them, which for the pair the
 * enemy panel is made of is the difference between a build and "Unable to
 * resolve function".
 */
const FLAGS = {".jaf": "--jaf", ".jam": "--jam"};

/**
 * A feature's arguments: each file it names, as a path relative to the
 * repository root, behind the flag its extension asks for. alice-tools runs
 * from the root -- see modules/AliceTools.js -- so that is what it can resolve.
 */
const patchArgs = (name, dir, patches) => patches.flatMap(file => {
    const flag = FLAGS[path.extname(file)];
    if (!flag) {
        throw new Error(`The "${name}" feature lists ${file}, and modules/Features.js has no flag for that kind of`
            + ` file. Its FLAGS table has: ${Object.keys(FLAGS).join(", ")}.`);
    }
    const full = path.join(dir, file);
    if (!fs.existsSync(full)) {
        throw new Error(`The "${name}" feature lists ${file}, which is not in ${path.relative(ROOT, dir)}.`);
    }
    return [flag, path.relative(ROOT, full)];
});

/**
 * A folder under features/ read as one. Imported rather than parsed so that a
 * manifest can carry the comments explaining itself, which is most of what
 * there is to say about a feature; the import wants a file:// URL, because a
 * Windows path with a drive letter reads as a URL scheme otherwise.
 */
const readFeature = async (name) => {
    const dir = path.join(FEATURES_DIR, name);
    const manifest = path.join(dir, MANIFEST);
    if (!fs.existsSync(manifest)) {
        throw new Error(`features/${name} has no ${MANIFEST}, so nothing there says what that feature is.`
            + ` Every folder under features/ is one feature.`);
    }
    const {default: feature} = await import(pathToFileURL(manifest));
    if (!feature?.summary) {
        throw new Error(`features/${name}/${MANIFEST} has no summary. It is the line --with= and the release`
            + ` listing print, so a feature without one has no way to say what it does.`);
    }
    return [name, {
        summary: feature.summary,
        /*
         * What the player has to do for it to do anything, in a sentence or
         * two, or "" for a feature that is on as soon as it is built in. Read
         * by modules/ReleaseReadme.js and printed by scripts/release.js: the
         * switch belongs to the feature, so the line describing it lives in the
         * feature's folder rather than in either of those.
         */
        howToTurnOn: feature.howToTurnOn ?? "",
        args: patchArgs(name, dir, feature.patches ?? []),
        default: feature.default ?? false,
    }];
};

/**
 * Every feature there is, by name. Sorted, because readdir's order is the
 * filesystem's and this decides the order patches reach alice-tools.
 *
 * Read as this module is imported, so a folder that says nothing about itself
 * or names a file that is not there stops a build before it renders a line of
 * dialogue -- the same reason scripts/ain.js reads the selection first. The
 * cost is that such a folder is reported as a stack trace rather than by
 * run(), which is not yet on the stack; it is a mistake in this repository
 * rather than in somebody's .env, and the message is the first line of it.
 */
export const FEATURES = Object.fromEntries(await Promise.all(fs.readdirSync(FEATURES_DIR, {withFileTypes: true})
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort()
    .map(readFeature)));

export const FEATURE_NAMES = Object.keys(FEATURES);

/** --with=a,b and --without=a,b, both spellings each, empty entries ignored. */
const listed = (flag) => (flagValue(flag) ?? "")
    .split(",")
    .map(name => name.trim())
    .filter(Boolean)
    .map(name => {
        if (!(name in FEATURES)) {
            throw new Error(`There is no "${name}" feature. features/ has: ${FEATURE_NAMES.join(", ")}.`);
        }
        return name;
    });

/**
 * What this run builds: the defaults, less what --without names, plus what
 * --with names. A feature in both flags is a contradiction rather than a
 * precedence question, so it is reported instead of resolved.
 */
export const selectedFeatures = () => {
    const added = listed("with");
    const removed = listed("without");
    const both = added.filter(name => removed.includes(name));
    if (both.length > 0) {
        throw new Error(`--with and --without both name ${both.join(", ")}. Pass each feature to one of them.`);
    }
    return FEATURE_NAMES.filter(name => (FEATURES[name].default || added.includes(name)) && !removed.includes(name));
};

/**
 * Their arguments for `alice ain edit`, in the order features/ lists them.
 * Takes the selection so that a caller which has already read it -- to report
 * it, or to refuse a name -- does not read the command line twice.
 */
export const featureArgs = (names = selectedFeatures()) => names.flatMap(name => FEATURES[name].args);
