/**
 * The name over a portrait in the dialogue window, and whether it spells people
 * the way the rest of the translation does.
 *
 * AdvNameResolver::Resolve is handed the standing portrait's name --
 * "キャンテル／基本" -- and looks it up in 立ち絵名札マッピング情報: an exact row
 * first, then a row whose key the portrait name starts with, then whatever sits
 * before the ／. So this table is what the plate says, and every one of its
 * thousand rows is written by hand.
 *
 * It is not only the plate. scripts/generate_card_names.js reads the same table
 * into 識別名情報.<識別名>.英名, which patches/card_names.jaf points
 * Character@Name::get at, so a name misspelled here is misspelled in the combat
 * log as well -- and the card plate beside it is spelled from
 * glossaries/card_name_glossary.tsv, which is a different file that can disagree.
 *
 * Nothing repaired any of it. The pass in modules/NameNormalizer.js runs over
 * the dialogue corpus, and scripts/ex.js hands alice-tools this file exactly as
 * it stands. キャンテル went out as "Kanteru" while the dialogue and the card both
 * said "Cantel", and "Jaharukkasu", "La Saizel" and "Yosef" went out beside it,
 * each of them a spelling glossaries/mistranslated_names.json lists as wrong.
 *
 * The check reads the whole key rather than looking for a name inside it the
 * way createNameChecker's mentions() does. A plate key is a cast list as much as
 * a name -- ルート肉片 is a chunk of meat rather than Root, 魔王ランスとシィル names
 * two characters where the plate names one, ケイブリス２ is the design that calls
 * itself "K-Chan" -- and eight of the thirteen complaints that reading produced
 * were of that kind, which is how a warning stops being read. A row keyed by
 * exactly a character's name is the row making a claim about how to spell them.
 *
 * A Japanese name the table spells two ways is satisfied by either: クルックー is
 * "Crook" and again "Ms. Crook", and the second entry is there to fix an
 * honorific's gender rather than to rename her, the same reason
 * modules/NameNormalizer.js leaves those pairs alone.
 */
import * as fs from "fs/promises";
import * as path from "path";
import {ROOT} from "./Env.js";
import {readSharedNameTable} from "./NameNormalizer.js";

/** The game's own table, translated in place: the key is a portrait, not text. */
export const NAMEPLATES = path.join(ROOT, "archives", "Rance10EX_v1_04", "48_立ち絵名札マッピング情報.x");

/** { "<識別名>／<pose>", "<english>" }, and the odd row with no pose at all. */
const PLATE_ROW = /^\s*\{\s*"((?:[^"\\]|\\.)*)"\s*,\s*"((?:[^"\\]|\\.)*)"/;

/** The spellings the translation has for a Japanese name, in file order. */
const spellingsByName = (table) => {
    const spellings = new Map();
    for (const record of table) {
        spellings.set(record.shortNameJpn, [
            ...spellings.get(record.shortNameJpn) ?? [],
            record.shortNameEng,
        ]);
    }
    return spellings;
};

const says = (english, spelling) => english.toLowerCase().includes(spelling.toLowerCase());

/**
 * The plates that name somebody the canonical table also names, and disagree.
 *
 * Reported rather than repaired: a plate is a full name where the table holds a
 * short one, so the fix is a word in this row rather than a substitution --
 * "La Saizel" wants to become "La Seizel" and keep its article.
 */
export const checkNameplates = async () => {
    const source = await fs.readFile(NAMEPLATES, "utf-8");
    const spellings = spellingsByName(await readSharedNameTable());

    const misnamed = [];
    let rows = 0;
    for (const line of source.split(/\r?\n/)) {
        const row = PLATE_ROW.exec(line);
        if (!row) {
            continue;
        }
        ++rows;
        const [, stand, english] = row;
        const identity = stand.split("／")[0];
        const canonical = spellings.get(identity);
        if (!canonical || canonical.some(spelling => says(english, spelling))) {
            continue;
        }
        misnamed.push(`the plate for ${identity} says ${JSON.stringify(english)},`
            + ` where the translation spells them ${canonical.map(name => `"${name}"`).join(" or ")}`);
    }

    return {report: `${rows} nameplates`, misnamed};
};
