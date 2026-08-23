/**
 * The gender of a crowd portrait, for the scene files' cast lines.
 *
 * glossaries/character_genders.md answers a character: somebody with a name, a
 * history, and usually a wiki page. It cannot answer a costume, and 6428 lines
 * of dialogue are spoken from behind one -- 汎用魔物兵緑 alone is 1367 of them,
 * more than any named character in the game outside the main cast.
 *
 * They could have gone in that file as rows keyed by the name the plate prints,
 * and for most of them that would have worked. For three it cannot, and the
 * three are 819 lines: 汎用ゼス男魔法兵 and 汎用ゼス女魔法兵 are one plate name
 * between them, so are 汎用男武士兵 and 汎用女武士兵, and so are the four ポピンズ.
 * A table keyed by the name has one row to give each pair. So this one is keyed
 * by the portrait, which is what the bytecode actually carries and what
 * modules/SceneScript.js reads off it.
 *
 * The character table is asked first and this is the fallback, which makes a
 * row here that the character table also answers a dead row rather than an
 * override -- readPortraitGenders reports those rather than letting them sit.
 * There is one legitimate-looking case of the shape, and it is not one: 汎用ハニー
 * and 汎用カラー resolve to "Hanny" and "Kalar", which are races the character
 * table settles, so neither is in this file at all.
 */
import * as fs from "fs/promises";
import * as path from "path";
import {ROOT} from "./Env.js";

export const PORTRAIT_GENDERS = path.join(ROOT, "glossaries", "portrait_genders.tsv");

/**
 * The portrait key, the plate's English, the gender, and where it came from.
 *
 * Only the first and the third are read. The second is the same lookup
 * modules/Nameplates.js does and is written out so a person editing this file
 * can see who they are looking at; the fourth is the evidence, which is worth
 * carrying per row because it is not all of one kind -- a card's 性別 column for
 * most, the lines themselves where the two disagree.
 */
const ROW = /^([^\t]+)\t([^\t]*)\t([^\t]+)\t?(.*)$/;

/**
 * What the gender column may say here.
 *
 * The same closed-list discipline as modules/CharacterGenders.js and a shorter
 * list, because a costume has none of the interesting answers: no crowd
 * portrait changes sex during the story or is the player's to choose. "?" earns
 * its place as the answer for 汎用その他, which really is a Hanny in one scene
 * and a crowd of men in another.
 */
const GENDERS = new Set(["Male", "Female", "?"]);

/**
 * Portrait key -> gender, plus what could not be read.
 *
 * @return {Promise<{genders: Map<string, string>, malformed: string[]}>}
 */
export const readPortraitGenders = async () => {
    const genders = new Map();
    const malformed = [];
    for (const line of (await fs.readFile(PORTRAIT_GENDERS, "utf-8")).split(/\r?\n/)) {
        if (!line || line.startsWith("#")) {
            continue;
        }
        const row = ROW.exec(line);
        if (!row) {
            malformed.push(`${JSON.stringify(line)} is not four columns`);
            continue;
        }
        const [, portrait, , gender] = row;
        if (!GENDERS.has(gender)) {
            malformed.push(`${portrait} -- gender column says ${JSON.stringify(gender)}`);
            continue;
        }
        if (genders.has(portrait)) {
            malformed.push(`${portrait} is listed twice`);
            continue;
        }
        genders.set(portrait, gender);
    }
    return {genders, malformed};
};

/**
 * Rows that answer nothing, which is the only way this file can go wrong
 * quietly.
 *
 * Two shapes. A portrait the character table already answers is never reached,
 * because scripts/extract_scenes.js asks that one first -- so the row is either
 * dead weight or an override somebody meant to have and is not getting. And a
 * portrait no scene uses is a key that has been renamed or misspelled, which
 * looks exactly like a portrait that simply never speaks.
 *
 * @param {Map<string, string>} portraits from readPortraitGenders
 * @param {Map<string, string>} characters from modules/CharacterGenders.js
 * @param {(portrait: string) => string | null} resolve from modules/Nameplates.js
 * @param {Set<string>} used every portrait key the dialogue actually pushes
 */
export const unreachedRows = (portraits, characters, resolve, used) => {
    const complaints = [];
    for (const portrait of portraits.keys()) {
        if (!used.has(portrait)) {
            complaints.push(`${portrait} is in portrait_genders.tsv and no scene uses it`);
            continue;
        }
        const name = resolve(portrait) ?? resolve(portrait + "／基本");
        if (name && characters.has(name)) {
            complaints.push(`${portrait} is in portrait_genders.tsv, but its plate says`
                + ` ${JSON.stringify(name)}, which character_genders.md answers first`);
        }
    }
    return complaints;
};
