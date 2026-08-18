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
 * build short of an input. Nothing here knows how to build anything: every
 * argument is handed to all three entry points, each takes the flags it knows,
 * and a flag added to one of them needs no change in this file.
 *
 * What lands there is the text and the code, which is not the whole patch: the
 * two image archives are packed by hand out of half a gigabyte of the game's
 * own files that this repository cannot carry. docs/image-archives.md.
 */
import * as path from "path";
import {spawnSync} from "child_process";
import {flagValue, hasFlag} from "../modules/Argv.js";
import {outputDir, run} from "../modules/AliceTools.js";
import {BUILD} from "../modules/Env.js";

const BUILDS = ["ain.js", "ex.js", "pack.js"];

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

    for (const script of BUILDS) {
        const status = node(script, args);
        if (status !== 0) {
            console.error(`\n${script} failed. ${dir} holds whatever the builds before it wrote.`);
            return status;
        }
    }
    console.log(`\nBuilt into ${dir}: Rance10.ain, Rance10EX.ex, Rance10Pact.afa.`);
    return 0;
});
