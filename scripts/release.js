/**
 * Build every text language into a folder of its own rather than into the game.
 *
 *   npm run release                            # build/release
 *   npm run release -- --text-lang=en_grok     # just that one
 *   node scripts/release.js -o build/scratch
 *   node scripts/release.js --game             # into the game, all of it at once
 *
 * The builds are the three commands README lists, run with the output directory
 * pointed somewhere other than GAME_DIR -- see outputDir in
 * modules/AliceTools.js for why redirecting it cannot leave a build short of an
 * input. Nothing here knows how to build anything: the arguments it was given
 * are handed to each of them, each takes the flags it knows, and a flag added
 * to one of them needs no change in this file. The exceptions are the flags
 * this file answers itself -- where a build writes, and which text language it
 * is -- which are stripped before its own are added.
 *
 * A release folder is one folder per folder under text_languages/:
 *
 *   README.md                                          which folder is which
 *   en_grok/Rance10.ain, Rance10EX.ex, Rance10Pact.afa, README.md
 *           custom_mods/<one empty file per feature>, README.md
 *   jp/Rance10.ain, README.md
 *      custom_mods/<the same>, README.md
 *
 * Each is a whole install: copy the contents of one folder into the game and
 * that is the patch, with nothing to assemble out of two places. The READMEs
 * are written by modules/ReleaseReadme.js, and generated rather than copied
 * because what they have to say depends on the run -- which text language a
 * folder is, which features went into it, and which version of the patch it is
 * (modules/Version.js, which also says why that version is nowhere in the game
 * itself). The price is
 * that Rance10EX.ex and Rance10Pact.afa would be the same file in every English
 * folder -- they hold no dialogue, so they do not vary by text language -- which
 * is why they are built once and copied rather than built per folder.
 *
 * jp is the game's own script with the features over it and no English at all,
 * so it is one file; and with no features selected there would be nothing in it
 * but the game's own .ain, so that folder is skipped rather than shipped.
 *
 * Which features every folder takes is --with= and --without=, the same as any
 * other build. There used to be an optional/<feature>/Rance10.ain apiece here,
 * from when the enemy panel could only be turned on by installing a different
 * .ain; every feature has a switch file of its own now, so the .ain in every
 * folder is the one with the features in it, and custom_mods beside it is those
 * switches shipped already thrown -- one empty file per feature this build put
 * in, so that turning one off is deleting a file rather than working out which
 * one to create. modules/CustomMods.js writes it, and says why an install into
 * a game folder deliberately gets none.
 *
 * --game is the other job and gets the other layout: what you play, one text
 * language, straight into the game folder. A game folder reads one Rance10.ain,
 * so a tree of alternatives in it would be dead weight.
 *
 * What lands in a release folder is the text and the code, which is not the
 * whole patch: the two image archives are packed by hand out of half a gigabyte
 * of the game's own files that this repository cannot carry, and
 * docs/image-archives.md is how.
 */
import * as fs from "fs";
import * as path from "path";
import {spawnSync} from "child_process";
import {flagValue, hasFlag, withoutFlags} from "../modules/Argv.js";
import {outputDir, run} from "../modules/AliceTools.js";
import {switchedFeatures, switchNote, writeCustomMods} from "../modules/CustomMods.js";
import {BUILD} from "../modules/Env.js";
import {CUSTOM_MODS, FEATURES, selectedFeatures} from "../modules/Features.js";
import {filesFor, renderFolderReadme, renderIndexReadme} from "../modules/ReleaseReadme.js";
import {isTranslated, listTextLangs, TEXT_LANGS, textLangName} from "../modules/TextLanguages.js";
import {PATCH_TAG} from "../modules/Version.js";

/** The one build that is per text language, and the two that are not. */
const AIN = "ain.js";
const SHARED = ["ex.js", "pack.js"];
const SHARED_FILES = ["Rance10EX.ex", "Rance10Pact.afa"];

/**
 * A child process per build rather than three imports: each is written as an
 * entry point that sets process.exitCode and runs at import time, and the
 * dialogue generator alone holds some hundreds of megabytes that only come back
 * when the process ends.
 */
const node = (script, args) => {
    const result = spawnSync(process.execPath, [path.join(import.meta.dirname, script), ...args], {stdio: "inherit"});
    if (result.error) {
        throw result.error;
    }
    return result.status ?? 1;
};

/** Every build this run makes, in order, as {script, args}. */
const stagesFor = (scripts, args) => scripts.map(script => ({script, args}));

/**
 * What went in, and what the player has to do about it. Printed at the end of
 * either job, because a feature that does nothing until a file exists is worth
 * saying out loud to whoever just installed it -- a release folder says the same
 * in its README, and an install into the game has nowhere else to say it at all.
 *
 * `where` is where this run created the switch files, or "" for a run that
 * created none: a release folder was handed them as it was built and an install
 * was not, so one line says which file to delete and the other which to create.
 * This is the build log rather than a page for a player, so it keeps the names
 * under features/ -- they are what --with= and --without= take.
 */
const reportFeatures = (features, where) => {
    if (features.length === 0) {
        return;
    }
    console.log("\nOptional features in every Rance10.ain built here:");
    for (const name of features) {
        console.log(`  ${name} -- ${FEATURES[name].summary}`);
        console.log(`    ${switchNote(name, where) || "On as soon as it is installed."}`);
    }
};

/**
 * Installing: one text language into GAME_DIR, chosen the way every other build
 * chooses it -- the flag, then TEXT_LANG in .env, then the default. Said out
 * loud before anything is rendered, because the game folder holds one
 * Rance10.ain and working out afterwards which translation went into it means
 * reading the dialogue.
 */
const install = (args, dir, features) => {
    const lang = textLangName();
    console.log(`Installing ${lang} into ${dir}`
        + (features.length > 0 ? ` with: ${features.join(", ")}` : " with no optional features"));
    if (!isTranslated(lang)) {
        console.warn(`  WARNING: ${lang} builds Rance10.ain and nothing else, so that is all this installs.`
            + " Rance10EX.ex and Rance10Pact.afa in the game folder are left as they are -- if an English patch"
            + " is installed there, those two are still English.");
    }
    return stagesFor([AIN, ...(isTranslated(lang) ? SHARED : [])], args);
};

run(() => {
    const args = process.argv.slice(2);
    const installing = hasFlag("game", args);
    /*
     * Set for the children to inherit, and only as a default: --out on the
     * command line still wins inside each of them, and an OUT_DIR already in
     * the environment is somebody saying where their builds go. --game asks for
     * GAME_DIR by name, which outputDir() reads before either.
     */
    if (!installing && !flagValue(["out", "o"], args)) {
        process.env.OUT_DIR ??= path.join(BUILD, "release");
    }
    const dir = outputDir();
    /*
     * Read here as well as in every child, to answer two questions this file
     * has of its own: whether the untranslated folder would hold anything, and
     * what to print at the end.
     */
    const features = selectedFeatures();

    if (installing) {
        for (const stage of install(args, dir, features)) {
            const status = node(stage.script, stage.args);
            if (status !== 0) {
                console.error(`\n${stage.script} failed. ${dir} holds whatever the builds before it wrote.`);
                return status;
            }
        }
        console.log(`\nInstalled patch ${PATCH_TAG} into ${dir}.`);
        reportFeatures(features, "");
        return 0;
    }

    /*
     * Every text language, or the one --text-lang names. TEXT_LANG in .env is
     * not read here on purpose: it says which one you install, and a release
     * folder carries them all anyway.
     */
    const langs = flagValue("text-lang", args) ? [textLangName()] : listTextLangs();
    const rest = withoutFlags(args, ["out", "o", "text-lang"], ["game"]);
    const built = [];
    for (const lang of langs) {
        if (!isTranslated(lang) && features.length === 0) {
            console.log(`Skipping ${lang}: with no translation and no features it would be the game's own`
                + " Rance10.ain, byte for byte.");
            continue;
        }
        const status = node(AIN, [...rest, `--text-lang=${lang}`, `--out=${path.join(dir, lang)}`]);
        if (status !== 0) {
            console.error(`\n${AIN} failed on ${lang}. ${dir} holds whatever the builds before it wrote.`);
            return status;
        }
        built.push(lang);
    }

    /*
     * The other two hold no dialogue, so they are the same file in every
     * folder: built into the first translated one and copied into the rest.
     * Copied rather than built again because a second `ar pack` is a minute of
     * work to produce a file that is already there.
     */
    const translated = built.filter(isTranslated);
    for (const script of translated.length > 0 ? SHARED : []) {
        const status = node(script, [...rest, `--out=${path.join(dir, translated[0])}`]);
        if (status !== 0) {
            console.error(`\n${script} failed. ${dir} holds whatever the builds before it wrote.`);
            return status;
        }
    }
    for (const lang of translated.slice(1)) {
        for (const file of SHARED_FILES) {
            fs.copyFileSync(path.join(dir, translated[0], file), path.join(dir, lang, file));
        }
    }

    /*
     * The switches, and the page that says what a folder is. Every folder holds
     * the same file names now, so which translation this is, and which feature
     * each of those extensionless files turns on, are things nothing in the
     * folder shows -- modules/ReleaseReadme.js and modules/CustomMods.js write
     * them down. Both are per folder, because a folder is a whole install and
     * nothing in it may point at a neighbour.
     */
    const switched = switchedFeatures(features);
    for (const lang of built) {
        writeCustomMods(path.join(dir, lang), features);
        fs.writeFileSync(path.join(dir, lang, "README.md"), renderFolderReadme(lang, features), "utf-8");
    }
    fs.writeFileSync(path.join(dir, "README.md"), renderIndexReadme(built, features), "utf-8");

    const extra = switched.length > 0 ? [`${CUSTOM_MODS}/`] : [];
    console.log(`\nBuilt patch ${PATCH_TAG} into ${dir}:`);
    for (const lang of built) {
        console.log(`  ${lang}/ -- ${TEXT_LANGS[lang].summary}`);
        console.log(`    ${[...filesFor(lang), "README.md", ...extra].join(", ")}`);
    }
    reportFeatures(features, switched.length > 0 ? "in every folder here" : "");
    return 0;
});
