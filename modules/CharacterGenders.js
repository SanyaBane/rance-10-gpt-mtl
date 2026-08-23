/**
 * Who is which gender, for pronouns.
 *
 * glossaries/character_genders.md is one of the three tables CLAUDE.md says to
 * consult before writing an English proper noun, and until recently it was the
 * one nothing read: it is prose for a person, with an operational-rules
 * section, a log of past mistakes and a special-cases table above the list
 * itself. So this reads the "Master Alphabetical List" heading and nothing else
 * -- the two tables before it have two and three columns and would otherwise
 * arrive as characters called "Past mistake".
 *
 * Keyed by the English name, which is how the list is sorted and what
 * 立ち絵名札マッピング情報 also spells, so a portrait resolves through the plate
 * table into a key this can answer. A name missing here is the normal case
 * rather than a fault -- the cast is far longer than either table -- and the
 * answer is null, not a guess.
 *
 * The one thing worth spelling out is the notation, because reading a cell
 * whole rather than as written cost thirteen characters their pronouns. A cell
 * names one person and may spell them more than one way:
 *
 *     Masou Shizuka / Shizuka Masou     two orderings
 *     Kola (Cola)                       two renderings
 *     Zance (Zans/Zence)                three, nested
 *     Diphteria (city mayor)            one, plus a note about who he is
 *
 * So the parenthesis comes off first and both halves split on the slash --
 * doing it the other way round tears "Zance (Zans/Zence)" in half -- and a
 * parenthetical is taken as a name only when it is capitalised like one. That
 * is what separates "(Cola)" from "(city mayor)" and "(Freya faction)", and
 * getting it wrong would file a character under "city mayor".
 */
import * as fs from "fs/promises";
import * as path from "path";
import {ROOT} from "./Env.js";

export const CHARACTER_GENDERS = path.join(ROOT, "glossaries", "character_genders.md");

/** The one table worth reading, and where it stops. */
const MASTER_LIST = "## Master Alphabetical List";

/** "| Name | Japanese | Gender | Game(s) |", separator rows included. */
const ROW = /^\|([^|]*)\|([^|]*)\|([^|]*)\|([^|]*)\|\s*$/;

/** A parenthetical is an alternate name only if it is spelled like one. */
const looksLikeAName = (text) => /^[A-Z0-9]/.test(text)
    && text.split(/[\s/]+/).filter(Boolean).every(word => /^[A-Z0-9]/.test(word));

/**
 * Every way one cell spells the person it names.
 *
 * @param {string} cell
 * @return {string[]}
 */
export const spellingsInCell = (cell) => {
    const parenthetical = /\(([^)]*)\)/.exec(cell);
    const outside = cell.replace(/\s*\([^)]*\)\s*/, " ");
    const parts = [outside];
    if (parenthetical && looksLikeAName(parenthetical[1].trim())) {
        parts.push(parenthetical[1]);
    }
    return parts
        .flatMap(part => part.split("/"))
        .map(name => name.trim())
        .filter(Boolean);
};

/**
 * What the gender column is allowed to say.
 *
 * Not Male and Female alone, which is the mistake this list replaces. Filtering
 * to two values threw away the answer for six of the cast and reported them as
 * unlisted -- RedEye is Genderless, Yutin Fulz is a Hermaphrodite, Kesselring
 * is Male→Female because she changes during the story, and three characters the
 * table has honestly marked "?" were being counted as rows that do not exist.
 * Those are the six answers a translator most needs, so they are passed through
 * as written rather than flattened.
 *
 * "Player's choice" is the newest of them and the only one that is not a fact
 * about a character. El Mofus is the protagonist of the second half and the
 * player picks at ２部旅立ち -- 選択_２択 between ルート：性別＝男 and
 * ルート：性別＝女, kept in the setting the game calls 主人公性別, and the game
 * ships an エール２男Ａ card and an エール２女Ａ card for the same 識別名. So there
 * is no answer to look up, and "?" would be the wrong way to say so: that means
 * nobody has found out, and this is 575 lines where the English has to work
 * either way on purpose.
 *
 * A closed list rather than anything at all, because the row that has to stay
 * caught is the one whose columns are shifted: "Dark Wings (Freya faction)"
 * would otherwise file a faction under the gender "RX".
 */
const GENDERS = new Set(["Male", "Female", "?", "Both", "Genderless", "Hermaphrodite",
    "Male→Female", "Female→Male", "Male/Female", "Player's choice"]);

/**
 * English name -> the gender column as written, plus the rows that cannot be read.
 *
 * Two of the latter exist today and both are worth seeing rather than dropping:
 * "Dark Wings (Freya faction)" is three columns where the table has four, and
 * "Tokugawa Ieyasu / Tokugawa Sen" is one row for two people. A table nothing
 * complains about is a table where the next such row goes unnoticed.
 *
 * @return {Promise<{genders: Map<string, string>, malformed: string[]}>}
 */
export const readCharacterGenders = async () => {
    const genders = new Map();
    const malformed = [];
    let inList = false;
    for (const line of (await fs.readFile(CHARACTER_GENDERS, "utf-8")).split(/\r?\n/)) {
        if (line.startsWith("## ")) {
            inList = line.trim() === MASTER_LIST;
            continue;
        }
        if (!inList || !line.startsWith("|")) {
            continue;
        }
        const row = ROW.exec(line);
        if (!row) {
            // A row of the master list that is not four columns wide. The
            // header rule and a blank line are not; a character with a column
            // missing is, and that is the one worth hearing about.
            malformed.push(`${line.trim()} -- ${line.split("|").length - 2} columns, not 4`);
            continue;
        }
        const [, cell, , gender] = row.map(text => text.trim());
        // The header and the |---|---| under it match the shape as readily as a
        // character does; what tells them apart is the third column.
        if (GENDERS.has(gender)) {
            for (const name of spellingsInCell(cell)) {
                genders.set(name, gender);
            }
        } else if (gender !== "Gender" && !/^-+$/.test(gender)) {
            malformed.push(`${cell} -- gender column says ${JSON.stringify(gender)}`);
        }
    }
    return {genders, malformed};
};
