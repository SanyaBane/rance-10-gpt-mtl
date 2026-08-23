/**
 * Who is which gender, for pronouns.
 *
 * glossaries/character_genders.md is one of the three tables CLAUDE.md says to
 * consult before writing an English proper noun, and until now it was the one
 * nothing read: it is prose for a person, with an operational-rules section, a
 * log of past mistakes and a special-cases table above the list itself. So this
 * reads the "Master Alphabetical List" heading and nothing else -- the two
 * tables before it have two and three columns and would otherwise arrive as
 * characters called "Past mistake".
 *
 * Keyed by the English name, which is how the list is sorted and what
 * 立ち絵名札マッピング情報 also spells, so a portrait resolves through the plate
 * table into a key this can answer. 396 rows, against a thousand plate rows and
 * a cast far longer than either: a name missing here is the normal case, not a
 * fault, and the answer is null rather than a guess.
 */
import * as fs from "fs/promises";
import * as path from "path";
import {ROOT} from "./Env.js";

export const CHARACTER_GENDERS = path.join(ROOT, "glossaries", "character_genders.md");

/** The one table worth reading, and where it stops. */
const MASTER_LIST = "## Master Alphabetical List";

/** "| Name | Japanese | Gender | Game(s) |", separator rows included. */
const ROW = /^\|([^|]*)\|([^|]*)\|([^|]*)\|([^|]*)\|\s*$/;

/**
 * English name -> "Female" | "Male", as the table spells it.
 *
 * @return {Promise<Map<string, string>>}
 */
export const readCharacterGenders = async () => {
    const genders = new Map();
    let inList = false;
    for (const line of (await fs.readFile(CHARACTER_GENDERS, "utf-8")).split(/\r?\n/)) {
        if (line.startsWith("## ")) {
            inList = line.trim() === MASTER_LIST;
            continue;
        }
        const row = inList && ROW.exec(line);
        if (!row) {
            continue;
        }
        const [, name, , gender] = row.map(cell => cell.trim());
        // The header and the |---|---| under it match the shape as readily as
        // a character does; what tells them apart is the third column.
        if (gender === "Male" || gender === "Female") {
            genders.set(name, gender);
        }
    }
    return genders;
};
