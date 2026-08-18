/**
 * Run alice-tools with the paths from .env, so package.json does not have to
 * name them. {game} in any argument expands to the directory a build installs
 * into -- GAME_DIR, or whatever --out=<dir> names.
 *
 *   node scripts/alice.js ex build -o {game}/Rance10EX.ex archives/Rance10EX_v1_04/main.x
 */
import {alice, run} from "../modules/AliceTools.js";

run(() => alice(process.argv.slice(2)));
