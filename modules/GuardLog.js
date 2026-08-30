/**
 * The two guard lines the absorbed-damage feature has to re-push, and the check
 * that keeps them agreed with the translation.
 *
 * SceneBattle@ShowLogGuard (FUNC 24930) is the one place the game puts a
 * 制限装甲 or 無敵結界 into words, and it is where
 * features/absorbed-damage-in-log adds the number that was rolled. Replacing a
 * function means re-emitting all of it, and two of its instructions push
 * strings that patches/system_cherry_picks.v1.04.ain.txt translates:
 *
 *   s[3295]  the Fiend's barrier being removed
 *   s[3296]  "Cannot deal damage！(<Any>)"
 *
 * A literal in a .jam is matched against the string table by text, and the text
 * patch has already run by the time alice-tools reads the file. So the .jam has
 * to spell those two the way the cherry-picks leave them: push the Japanese and
 * it matches nothing, a new Japanese slot is appended, and the line the player
 * reads goes back to Japanese in an English build. That is the fault
 * patches/leader_state_names.jam exists for, and it is invisible in a diff --
 * the .jam is verbatim from the game's own dump, which is exactly what makes it
 * wrong.
 *
 * Whether the English then resolves to those slots or to duplicates of them
 * depends on what else the run applied -- measured both ways, and the .jam says
 * where. Neither is a fault, because a duplicate holds the same sentence. What
 * it does mean is that this wording decides what the player reads with the
 * feature on, while the cherry-picked slot decides it with the feature off, and
 * nothing in a diff would show the two drifting apart.
 *
 * Hence this. The .jam is held to the cherry-picks at the start of every build,
 * so rewording either half is a stopped build rather than a battle log that
 * says one thing with the feature on and another with it off. It is the same
 * bargain as modules/CardBack.js: the duplication is real and it cannot rot
 * silently.
 *
 * It checks one direction only -- that each of the two texts is somewhere in
 * the .jam -- because the other direction is not a fault. The .jam pushes three
 * strings of its own (the number's own log entry and the two words it ends
 * with), and those are new slots on purpose: they are the only words the
 * feature invents, they are language-neutral, and nothing translates them.
 */
import * as fs from "fs/promises";
import * as path from "path";
import {readSlotEnglish} from "./CherryPicks.js";
import {ROOT} from "./Env.js";

/** The feature's half of FUNC 24930. Named here rather than in scripts/ain.js. */
export const GUARD_LOG_JAM = path.join(ROOT, "features", "absorbed-damage-in-log", "absorbed_damage_in_log.jam");

/**
 * The slots that function pushes and this repository translates, each with what
 * it is, for a message somebody can act on without opening the dump.
 */
const OWNED = new Map([
    [3295, "the Fiend's invincible barrier being removed"],
    [3296, "the line an absorbed hit prints, \"Cannot deal damage！(<Any>)\""],
]);

/** Every S_PUSH literal in the file, unescaped the way the assembler reads it. */
const literals = (text) => new Set([...text.matchAll(/^\s*S_PUSH\s+"((?:[^"\\\n]|\\.)*)"/gm)]
    .map(match => match[1].replace(/\\(.)/g, (_, character) =>
        character === "n" ? "\n" : character === "t" ? "\t" : character === "r" ? "\r" : character)));

/**
 * Stop the build if the feature's .jam and the cherry-picks disagree about
 * either line, naming both spellings -- the whole point is to be told which of
 * the two was edited.
 *
 * A slot the cherry-picks no longer assign at all is the same fault seen from
 * the other side: the .jam would then be pushing English at a slot that still
 * says Japanese, so it is reported rather than skipped.
 */
export const checkGuardLog = async () => {
    const english = readSlotEnglish();
    const pushed = literals(await fs.readFile(GUARD_LOG_JAM, "utf-8"));
    const where = path.relative(ROOT, GUARD_LOG_JAM);
    for (const [slot, what] of OWNED) {
        const translated = english.get(slot);
        if (translated === undefined) {
            throw new Error(`patches/system_cherry_picks.v1.04.ain.txt no longer assigns s[${slot}], which is`
                + ` ${what}. ${where} replaces the function that pushes it and spells it in English, so that`
                + " slot has to be translated there. modules/GuardLog.js says why.");
        }
        if (!pushed.has(translated)) {
            throw new Error(`${where} and the cherry-picks disagree about s[${slot}], ${what}:\n`
                + `  patches/system_cherry_picks.v1.04.ain.txt: ${JSON.stringify(translated)}\n`
                + `  ${where} pushes: ${[...pushed].map(one => JSON.stringify(one)).join(", ")}\n`
                + "A .jam literal is matched by text against the table the text patch has already written, so"
                + " the two have to say the same thing or that line reverts to Japanese in an English build."
                + " modules/GuardLog.js says why.");
        }
    }
};
