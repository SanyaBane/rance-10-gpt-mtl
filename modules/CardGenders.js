/**
 * What the game itself says a character's gender is.
 *
 * 8_カードデータ.x has a 性別 column, and it is not a guess about what that
 * column means. `PlayerCard@Sex::get` reads it, and the two lambdas beside it
 * say what the numbers are:
 *
 *     ; "PartyIndexer@<lambda : PartyIndexer@PurgeMale()(36, 17)>"
 *         PUSH 28103        -- PlayerCard@Sex::get
 *         CALLMETHOD 0
 *         PUSH 1
 *         EQUALE            -- Male is 1, and PurgeFemale below compares with 2
 *
 * 90 of the 1134 cards say 0, which is neither.
 *
 * This matters because glossaries/character_genders.md was assembled by hand off
 * the wiki and VNDB, and 133 of the dialogue's 378 speakers are not in it. The
 * game has been carrying the answer for most of them the whole time, in a file
 * this repository already installs. Held against the table for everybody both
 * know, 225 of 236 agree outright -- and every one of the eleven that do not is
 * worth seeing rather than averaging away, which is what checkCardGenders is
 * for.
 *
 * A card is keyed by the portrait it wears, which is the same key
 * modules/SceneScript.js reads off the bytecode and modules/Nameplates.js
 * resolves into a name. So the join needs nothing in between: the portrait
 * behind a line of dialogue is the portrait on a card, and the card carries the
 * gender.
 *
 * What it does *not* answer is a crowd portrait. 性別 belongs to the card, and a
 * generic costume worn by a card is not the extra wearing it in a scene:
 * 汎用自由都市警備兵Ａ dresses five 警備兵 cards that all say Female, while every
 * line spoken from behind it says 俺. That is why the crowd is settled in
 * glossaries/portrait_genders.tsv by reading the lines, and this is evidence
 * there rather than the answer.
 */
import * as fs from "fs/promises";
import {CARD_DATA} from "./Nameplates.js";

/** { "<Id>", "<識別名>", "<ＣＧ名>", 所属, 属性, 性別, ... } */
const CARD_ROW = /^\s*\{\s*"((?:[^"\\]|\\.)*)"\s*,\s*"((?:[^"\\]|\\.)*)"\s*,\s*"((?:[^"\\]|\\.)*)"\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)/;

/**
 * The column's three values, spelled the way character_genders.md spells them
 * so the two can be compared without a translation table in between.
 *
 * 0 is left as "0" rather than called Genderless: the cards that carry it are
 * items and machines as often as they are anything with a gender, and reading a
 * blank as a claim is how a table starts answering questions nobody asked it.
 */
const SEX = {0: "0", 1: "Male", 2: "Female"};

/**
 * Every card, and the genders claimed for each portrait and each 識別名.
 *
 * Both keys earn their place. The portrait is what a line of dialogue carries;
 * the 識別名 is what a card is filed under, and it is the one that answers a
 * character whose cards wear a costume rather than their own face.
 *
 * A Set rather than one value, because the interesting case is the key two
 * cards disagree about -- ケイブワン has one Male card and two Female ones -- and
 * a last-wins read would hide it.
 *
 * @return {Promise<{
 *     cards: {id: string, identity: string, portrait: string, gender: string}[],
 *     byPortrait: Map<string, Set<string>>,
 *     byIdentity: Map<string, Set<string>>,
 * }>}
 */
export const readCardGenders = async () => {
    const cards = [];
    for (const line of (await fs.readFile(CARD_DATA, "utf-8")).split(/\r?\n/)) {
        const row = CARD_ROW.exec(line);
        // The header row declares the columns in exactly this shape, and its
        // first cell is the word Id.
        if (row && row[1] !== "Id") {
            cards.push({
                id: row[1],
                identity: row[2],
                portrait: row[3].split("／")[0],
                gender: SEX[row[6]] ?? row[6],
            });
        }
    }
    const byPortrait = new Map();
    const byIdentity = new Map();
    const add = (index, key, gender) => {
        if (!key || gender === "0") {
            return;
        }
        if (!index.has(key)) {
            index.set(key, new Set());
        }
        index.get(key).add(gender);
    };
    for (const card of cards) {
        add(byPortrait, card.portrait, card.gender);
        add(byIdentity, card.identity, card.gender);
    }
    return {cards, byPortrait, byIdentity};
};

/** The one gender a key claims, or null where it claims none or two. */
export const oneGender = (claimed) => (claimed?.size === 1 ? [...claimed][0] : null);

/**
 * Where the hand-written table and the game disagree about somebody both name.
 *
 * Reported and never applied. Most of these are the table being more precise
 * than a two-value column can be -- RedEye is Genderless where the card says
 * Male, Yutin Fulz is a Hermaphrodite, Kesselring changes during the story --
 * and one of them is deliberate: Lexington's card says Female because the entity
 * wearing the name is Nimitz, and character_genders.md says so in its own notes.
 *
 * What is left after those is the row that is simply wrong, which is how ラッシー
 * was found sitting in the table as Female.
 *
 * @param {Map<string, string>} genders from modules/CharacterGenders.js
 * @param {(portrait: string) => string | null} resolve from modules/Nameplates.js
 * @return {Promise<{compared: number, disagree: string[]}>}
 */
export const checkCardGenders = async (genders, resolve) => {
    const {byPortrait} = await readCardGenders();
    const seen = new Map();
    for (const [portrait, claimed] of byPortrait) {
        // A plate is keyed "サーナキア／" as often as "サーナキア", and
        // AdvNameResolver::Resolve reaches both -- so ask it the way the game
        // does rather than trusting either spelling.
        const name = resolve(portrait) ?? resolve(portrait + "／基本");
        if (name && genders.has(name)) {
            seen.set(name, {portrait, claimed});
        }
    }
    const disagree = [];
    for (const [name, {portrait, claimed}] of [...seen].sort()) {
        const table = genders.get(name);
        if (oneGender(claimed) === table) {
            continue;
        }
        disagree.push(`${name} (${portrait}): the cards say ${[...claimed].join(" and ")},`
            + ` the table says ${table}`);
    }
    return {compared: seen.size, disagree};
};
