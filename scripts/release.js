/**
 * Build all three patched files into one folder rather than into the game.
 *
 *   npm run release                             # build/release
 *   npm run release -- --variant=grok
 *   node scripts/release.js -o build/scratch
 *   node scripts/release.js --game              # into the game, all three at once
 *
 * The three builds are the three commands README lists, run in order, with the
 * output directory pointed at build/release instead of GAME_DIR -- see
 * outputDir in modules/AliceTools.js for why redirecting it cannot leave a
 * build short of an input. Nothing here knows how to build anything: the
 * arguments it was given are handed to each of them, each takes the flags it
 * knows, and a flag added to one of them needs no change in this file. The
 * exceptions are the flags this file answers itself -- where a build writes,
 * and which features it takes -- which are stripped before its own are added.
 *
 * A release folder is laid out so that installing the English never means
 * installing modified game logic with it:
 *
 *   Rance10.ain                        the translation, and no feature at all
 *   Rance10EX.ex
 *   Rance10Pact.afa
 *   optional/enemy-panel/Rance10.ain   the same, plus that one feature
 *
 * One extra .ain per entry in modules/Features.js, each of them the base plus
 * that feature and nothing else, to be copied over the base to turn it on. The
 * two archives never vary, so they are built once.
 *
 * --game is the other job and gets the other layout: what you play, which is
 * the features that are on by default and nothing beside it. A game folder
 * reads one Rance10.ain, so a tree of alternatives in it would be dead weight.
 *
 * What lands in a release folder is the text and the code, which is not the
 * whole patch: the two image archives are packed by hand out of half a gigabyte
 * of the game's own files that this repository cannot carry, and
 * docs/image-archives.md is how.
 */
import * as path from "path";
import {spawnSync} from "child_process";
import {flagValue, hasFlag, withoutFlags} from "../modules/Argv.js";
import {outputDir, run} from "../modules/AliceTools.js";
import {BUILD} from "../modules/Env.js";
import {FEATURES, FEATURE_NAMES} from "../modules/Features.js";

const BUILDS = ["ain.js", "ex.js", "pack.js"];
const OPTIONAL = "optional";

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

/** Every feature off, and every feature but one off: the two selections below. */
const NO_FEATURES = `--without=${FEATURE_NAMES.join(",")}`;
const onlyFeature = (name) => [`--with=${name}`, `--without=${FEATURE_NAMES.filter(other => other !== name).join(",")}`];

run(() => {
    const args = process.argv.slice(2);
    /*
     * Set for the children to inherit, and only as a default: --out on the
     * command line still wins inside each of them, and an OUT_DIR already in
     * the environment is somebody saying where their builds go. --game asks for
     * GAME_DIR by name, which outputDir() reads before either.
     */
    if (!hasFlag("game", args) && !flagValue(["out", "o"], args)) {
        process.env.OUT_DIR ??= path.join(BUILD, "release");
    }
    const dir = outputDir();
    const installing = hasFlag("game", args);
    /*
     * A release folder holds every feature already, one .ain apiece, so there
     * is nothing for --with or --without to decide and they would be dropped
     * without a word. Installing is the run where choosing makes sense.
     */
    if (!installing && (flagValue("with") !== undefined || flagValue("without") !== undefined)) {
        throw new Error("--with and --without are for --game: a release folder builds every feature anyway,"
            + " one Rance10.ain each under optional/.");
    }
    /*
     * Every build below is told where to write and which features to take, so
     * the run's own answers to those two questions go first -- otherwise --game
     * would reach a child that is being handed an --out as well, and the two
     * refuse to be in the same command.
     */
    const rest = withoutFlags(args, ["out", "o", "with", "without"], ["game"]);

    const stages = installing
        ? BUILDS.map(script => ({script, args}))
        : [
            ...BUILDS.map(script => ({script, args: [...rest, `--out=${dir}`, NO_FEATURES]})),
            ...FEATURE_NAMES.map(name => ({
                script: "ain.js",
                args: [...rest, `--out=${path.join(dir, OPTIONAL, name)}`, ...onlyFeature(name)],
            })),
        ];

    for (const stage of stages) {
        const status = node(stage.script, stage.args);
        if (status !== 0) {
            console.error(`\n${stage.script} failed. ${dir} holds whatever the builds before it wrote.`);
            return status;
        }
    }

    console.log(`\nBuilt into ${dir}: Rance10.ain, Rance10EX.ex, Rance10Pact.afa.`);
    if (!installing) {
        for (const name of FEATURE_NAMES) {
            console.log(`  ${OPTIONAL}/${name}/Rance10.ain -- ${FEATURES[name].summary}`);
        }
    }
    return 0;
});
