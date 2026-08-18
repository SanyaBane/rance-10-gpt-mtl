/**
 * Running alice-tools with the paths from .env.
 */
import * as fs from "fs";
import * as path from "path";
import {spawnSync} from "child_process";
import {flagValue, hasFlag} from "./Argv.js";
import {required, ROOT} from "./Env.js";

/**
 * The directory a build installs into: GAME_DIR, or the one --out=<dir> (-o for
 * short) or OUT_DIR names for this run. --game is GAME_DIR said out loud, for a
 * run that would otherwise pick up an OUT_DIR from its environment -- which is
 * how scripts/release.js tells its three children where to write.
 *
 * Redirecting it is safe by construction, because nothing here ever *reads*
 * this directory -- scripts/ain.js takes its .ain from game/, scripts/ex.js and
 * scripts/pack.js take their sources from archives/, and all three only write.
 * So the only thing this decides is where Rance10.ain, Rance10EX.ex and
 * Rance10Pact.afa land, which is what scripts/release.js collects into one
 * folder and what building a copy to verify against needs.
 *
 * A relative --out is resolved against the repository root rather than the
 * working directory, like every other path here, so --out=build/release names
 * the same folder whatever directory the entry point was started from.
 *
 * Created if it is missing. alice-tools makes no directory of its own: it does
 * the whole edit first and then stops with "Failed to open ...: No such file or
 * directory", which is a long way to go to be told to run mkdir.
 */
export const outputDir = () => {
    const flag = flagValue(["out", "o"]);
    if (hasFlag("game") && flag) {
        throw new Error(`--game and --out name two directories, GAME_DIR and ${flag}. Pass one or the other.`);
    }
    const named = hasFlag("game") ? undefined : flag || process.env.OUT_DIR;
    const dir = named ? path.resolve(ROOT, named) : required("GAME_DIR");
    fs.mkdirSync(dir, {recursive: true});
    return dir;
};

/**
 * Run alice-tools, expanding {game} in every argument.
 *
 * Spawned without a shell on purpose. These paths contain spaces, so they have
 * to be quoted, and cmd.exe strips the quotes off a command line that *begins*
 * with one -- which is how "E:\Modding games\..." ends up being run as
 * "E:\Modding". Passing an argv array sidesteps the question entirely.
 *
 * From the repository root, whatever directory the build was started from.
 * Several arguments are paths relative to it -- a manifest, the patch, the .jaf
 * overrides -- and alice-tools resolves them against its own working directory,
 * so this is what lets the entry points be run from anywhere.
 *
 * {game} is expanded only where it appears, so a command that writes nowhere --
 * a dump, say -- needs no GAME_DIR set to run.
 */
export const alice = (args, exe = required("ALICE_EXE")) => {
    const expanded = args.map(arg => arg.includes("{game}") ? arg.replaceAll("{game}", outputDir()) : arg);
    const result = spawnSync(exe, expanded, {stdio: "inherit", cwd: ROOT});
    if (result.error?.code === "ENOENT") {
        throw new Error(`alice-tools is not at ${exe} -- check ALICE_EXE in .env`);
    }
    if (result.error) {
        throw result.error;
    }
    return result.status ?? 1;
};

/**
 * Run an entry point, reporting a misconfigured .env as a plain message. A
 * missing path is the reader's problem to fix, not a stack trace to read.
 *
 * Awaited, so that an entry point which reads files can be async and still get
 * the same treatment -- an unawaited body would assign a promise to exitCode
 * and let its rejection past the catch as an unhandled one.
 */
export const run = async (body) => {
    try {
        process.exitCode = await body();
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    }
};
