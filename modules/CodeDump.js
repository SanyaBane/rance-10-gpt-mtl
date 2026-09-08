/**
 * The game's bytecode, as alice-tools writes it.
 *
 *     alice ain dump -c -o build/Rance10.v1.04.code.jam game/ain/Rance10.v1.04.ain
 *
 * The macro form, `-c`, which writes an operand that names a string as the
 * string itself. The `-C --no-macros` form scripts/extract_enemy_info.js and its
 * three siblings use writes the slot number instead, which is what a script
 * looking for "who else pushes s[4018]" wants and exactly wrong for a script
 * asking what a function draws. Either way the dump is a by-product: it goes
 * into build/, it takes about three seconds, and deleting build/ throws it away.
 *
 * This module owns the path and the dumping because two callers now want them --
 * modules/SceneScript.js, which reads the dump for who says which line, and
 * modules/RBreaks.js, which reads it for which functions treat the letter r as a
 * line break. It was private to the first of those until the second arrived.
 */
import * as fs from "fs/promises";
import * as path from "path";
import {AIN} from "./AinFiles.js";
import {alice} from "./AliceTools.js";
import {BUILD, ensureBuild} from "./Env.js";

/** The code dump, written here rather than kept: see the header. */
export const CODE_JAM = path.join(BUILD, "Rance10.v1.04.code.jam");

/**
 * Produce the code dump if build/ does not already have one.
 *
 * Kept rather than re-dumped every run because three seconds is three seconds,
 * and thrown away by deleting build/. A game version bump cannot be served a
 * stale one silently: it moves every line number, and modules/LineNumbers.js is
 * what would notice.
 *
 * @return {Promise<boolean>} whether this call is the one that wrote it.
 */
export const ensureCodeDump = async () => {
    try {
        await fs.access(CODE_JAM);
        return false;
    } catch (error) {
        if (error.code !== "ENOENT") {
            throw error;
        }
    }
    ensureBuild();
    const status = alice(["ain", "dump", "-c", "-o", CODE_JAM, AIN]);
    if (status !== 0) {
        throw new Error(`alice ain dump -c failed with status ${status}`);
    }
    return true;
};
