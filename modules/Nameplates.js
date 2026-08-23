/**
 * The names the .ex tables print for a character -- over a portrait in the
 * dialogue window, and on the card detail panel -- and whether they spell
 * people the way the rest of the translation does.
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
 *
 * checkCardNames below asks the same question of 9_カード情報.x's フルネーム,
 * which is the other namelist a build installs and which nothing was reading:
 * twenty of its rows disagreed with the table when it was first run.
 */
import * as fs from "fs/promises";
import * as path from "path";
import {CHERRY_PICKS} from "./CherryPicks.js";
import {ROOT} from "./Env.js";
import {readSharedNameTable} from "./NameNormalizer.js";

const EX_DIR = path.join(ROOT, "archives", "Rance10EX_v1_04");

/** The game's own table, translated in place: the key is a portrait, not text. */
export const NAMEPLATES = path.join(EX_DIR, "48_立ち絵名札マッピング情報.x");

/** { "<Id>", "<識別名>", "<ＣＧ名>", ... }: which character each card is. */
export const CARD_DATA = path.join(EX_DIR, "8_カードデータ.x");

/** One node per card Id, holding the フルネーム the detail panel prints. */
export const CARD_INFO = path.join(EX_DIR, "9_カード情報.x");

/**
 * The short names the card plate prints, keyed by the Japanese. Hand-written,
 * and the file the header above means when it says the plate can disagree with
 * 立ち絵名札マッピング情報.
 */
export const CARD_GLOSSARY = path.join(ROOT, "glossaries", "card_name_glossary.tsv");

/** { "<識別名>／<pose>", "<english>" }, and the odd row with no pose at all. */
const PLATE_ROW = /^\s*\{\s*"((?:[^"\\]|\\.)*)"\s*,\s*"((?:[^"\\]|\\.)*)"/;

/** The first three columns of カードデータ: Id, 識別名, ＣＧ名. */
const CARD_ROW = /^\s*\{\s*"((?:[^"\\]|\\.)*)"\s*,\s*"((?:[^"\\]|\\.)*)"\s*,\s*"((?:[^"\\]|\\.)*)"/;

// depth-agnostic on the leaf, pinned on the node: カード情報's Ids sit exactly
// one tab in and 238 of them are bare words rather than quoted strings
const FULL_NAME = /^\s*フルネーム\s*=\s*"(.*)"\s*,?\s*$/;
const CARD_NODE = /^\t("?)([^\t]+?)\1\s*=\s*\{\s*$/;

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

/**
 * The table as it stands: [portrait key, English], in file order.
 *
 * Order is part of the data rather than a detail of the reader. Resolve below
 * takes the first row a portrait opens on, so two rows that both match settle
 * it by which was written first -- the same way the game does.
 */
export const readPlateRows = async () => {
    const rows = [];
    for (const line of (await fs.readFile(NAMEPLATES, "utf-8")).split(/\r?\n/)) {
        const row = PLATE_ROW.exec(line);
        if (row && row[2]) {
            rows.push([row[1], row[2]]);
        }
    }
    return rows;
};

/**
 * AdvNameResolver::Resolve: the name the dialogue window prints over a portrait.
 *
 * An exact row first, then the first row whose key the portrait name starts
 * with, then the part before the ／ on its own -- 立ち絵名札マッピング情報 keys
 * most characters by "サーナキア／" and a handful by a bare name, so all three
 * steps earn their place. Null for a portrait the table does not name, which is
 * not a fault: 汎用男性／基本 is a passer-by, and 大爆発 is an explosion.
 *
 * Built once and memoised, because a script asking this asks it a quarter of a
 * million times over a thousand-row table.
 */
export const createNameplateResolver = async () => {
    const rows = await readPlateRows();
    const resolved = new Map();
    return (stand) => {
        if (resolved.has(stand)) {
            return resolved.get(stand);
        }
        const head = stand.split("／")[0];
        const name = rows.find(([key]) => key === stand)?.[1]
            ?? rows.find(([key]) => stand.startsWith(key))?.[1]
            ?? rows.find(([key]) => key === head || key === head + "／")?.[1]
            ?? null;
        resolved.set(stand, name);
        return name;
    };
};

/**
 * The one plate row the game's own code compares a string against.
 *
 * AdvNamePlate@InnerCreate resolves the plate and then, if what came back is
 * exactly エール・モフス, replaces it with the name the player typed at the
 * エール入力画面 plus ・モフス. Both of those are string slots -- s[2665] and
 * s[2666] -- and patches/system_cherry_picks.v1.04.ain.txt translates them,
 * because the value the first is compared against is this row, which this
 * repository translated years ago.
 *
 * Which makes two files that have to agree letter for letter, in different
 * archives, edited for different reasons, with nothing between them. They
 * disagreed for years and the symptom was silent: the plate kept saying "El
 * Mofus" and the player's name was thrown away. So the agreement is checked at
 * every .ain build and every .ex build, since either side can move.
 */
export const PLAYER_PLATE_KEY = "エール２／";

/** s[2665], the sentinel; s[2666] is the suffix and has nothing to agree with. */
const PLAYER_PLATE_SLOT = 2665;

/**
 * Whether the cherry-picked sentinel still says what the plate says.
 *
 * @param {string} [cherryPicks] the text of patches/system_cherry_picks.v1.04.ain.txt,
 *     which the .ain build has in hand already and the .ex build has not
 * @return {Promise<{report: string, complaints: string[]}>}
 */
export const checkPlayerNamePlate = async (cherryPicks) => {
    const text = cherryPicks ?? await fs.readFile(CHERRY_PICKS, "utf-8");
    const plate = (await readPlateRows()).find(([key]) => key === PLAYER_PLATE_KEY)?.[1];
    const assigned = new RegExp(String.raw`^s\[${PLAYER_PLATE_SLOT}]\s*=\s*"((?:[^"\\\n]|\\.)*)"`, "m")
        .exec(text)?.[1];
    const complaints = [];
    if (plate === undefined) {
        complaints.push(`${PLAYER_PLATE_KEY} is no longer a row of ${path.basename(NAMEPLATES)},`
            + " so nothing puts the player's name over El's portrait");
    } else if (assigned === undefined) {
        complaints.push(`s[${PLAYER_PLATE_SLOT}] is not cherry-picked, so the game compares the plate`
            + ` against エール・モフス and ${JSON.stringify(plate)} will never match it`);
    } else if (assigned !== plate) {
        complaints.push(`s[${PLAYER_PLATE_SLOT}] says ${JSON.stringify(assigned)} where the plate for`
            + ` ${PLAYER_PLATE_KEY} says ${JSON.stringify(plate)}. The game compares the two, so El's`
            + " plate will read that plate instead of the name the player typed.");
    }
    return {report: `the player's nameplate against s[${PLAYER_PLATE_SLOT}]`, complaints};
};

/** Every English name the plate table has for a portrait key. */
const readPlates = async () => {
    const plates = new Map();
    for (const [stand, english] of await readPlateRows()) {
        const key = stand.split("／")[0];
        if (key) {
            plates.set(key, [...plates.get(key) ?? [], english]);
        }
    }
    return plates;
};

/** Card Id -> the 識別名 it is filed under and the portrait it wears. */
const readCardKeys = async () => {
    const keys = new Map();
    for (const line of (await fs.readFile(CARD_DATA, "utf-8")).split(/\r?\n/)) {
        const row = CARD_ROW.exec(line);
        if (row) {
            keys.set(row[1], [...new Set([row[2], row[3].split("／")[0]])].filter(Boolean));
        }
    }
    return keys;
};

/** Card Id -> its フルネーム and the line it is written on. */
const readFullNames = async () => {
    const names = new Map();
    let node = null;
    let at = 0;
    for (const line of (await fs.readFile(CARD_INFO, "utf-8")).split(/\r?\n/)) {
        ++at;
        const card = CARD_NODE.exec(line);
        if (card) {
            node = card[2];
            continue;
        }
        const name = FULL_NAME.exec(line);
        if (name && node) {
            names.set(node, {english: name[1], line: at});
        }
    }
    return names;
};

const words = (name) => name.split(/[^\p{L}\p{N}]+/u).filter(Boolean);

/**
 * Whether one of these names is the other with more words around it.
 *
 * The same rule scripts/generate_card_names.js applies to the card plate, and
 * for the same reason: half the canonical table carries a surname or an
 * honorific that a name field has no use for. フルネーム is the shorter form
 * about as often as it is the longer one -- the table says "Megas Horus" where
 * the panel prints "Megas", and "Jaro Jaslak" where it prints "Jaro" -- and
 * neither direction is a misspelling.
 */
const wraps = (a, b) => {
    const [inner, outer] = words(a).length <= words(b).length
        ? [words(a), words(b)]
        : [words(b), words(a)];
    if (inner.length === 0 || inner.length === outer.length) {
        return false;
    }
    const key = inner.join(" ");
    return outer.slice(0, inner.length).join(" ") === key
        || outer.slice(outer.length - inner.length).join(" ") === key;
};

const agrees = (english, spelling) => says(english, spelling) || wraps(english, spelling);

const KATAKANA = /[゠-ヿ]/;

/**
 * Whether a card's key opens a longer name in the table rather than merely
 * sitting inside one.
 *
 * ミラクル's cards are filed under ミラクル, whose canonical spelling is the
 * bare "Miracle" -- which "Miracle Tou" contains, so the card looked settled
 * while every one of its six rows misspelled ミラクル・トー. Reaching from the
 * key to the longer entry is what found them.
 *
 * Only from the key outwards, never the other way: 香澄's cards would otherwise
 * be judged against 香 ("Kou") and ランスＪｒ's against ランス, and a card filed
 * under a longer name is not a card about the shorter character.
 *
 * The katakana rule is mentions()'s, with the middle dot excepted -- it is a
 * separator inside a name rather than a letter, so ミラクル・トー opens on
 * ミラクル where レイラ does not open on レイ.
 */
const opens = (longer, key) => longer.startsWith(key)
    && (longer[key.length] === "・"
        || !(KATAKANA.test(key[key.length - 1]) && KATAKANA.test(longer[key.length])));

/**
 * The placeholders カード情報 writes where a card has no name to give: an empty
 * field, the ｘｘｘ it uses for a character not yet met, and the digits it gives
 * a machine -- ピグ's name really is "110101100101010" in the game's own table.
 */
const unnamed = (english) => english === "" || english === "ｘｘｘ"
    || [...english].every(character => /\p{Nd}/u.test(character));

/**
 * The same question asked of カード情報's フルネーム: does the card detail panel
 * spell this character the way the rest of the translation does.
 *
 * Worth asking separately because the plates are not the only namelist the
 * build installs. scripts/generate_card_names.js falls back to フルネーム for
 * the 63 characters with no portrait, so a name misspelled here reaches the
 * combat log too -- and the panel prints it either way. Twenty rows were wrong
 * when this was first run: ソルトアン as "Sultan", ガルバン as "Girl Ban",
 * フロストバイン as "Frostvine", よーぜふ as "Joseph" (which is ヨシフ, a
 * different character), クゥ as "QD" (which the game's own コメント gives as her
 * alias, not her name).
 *
 * Judged against the character the *card* is about rather than the last word of
 * its Id. They are usually the same word and sometimes are not: Lv65 戦姫 is
 * filed under 千姫 and prints "Tokugawa Sen", 魔人 レキシントン under ニミッツ and
 * prints "Nimitz Leak". Reading the Id instead made both of those complaints,
 * and both were right as written.
 *
 * The portrait counts as a key beside the 識別名, because a card wearing a
 * different 立ち絵 is presenting a different persona: 魔王 美樹 draws
 * リトルプリンセス and prints "Little Princess", which is that portrait's plate
 * and not a misspelling of Miki.
 *
 * The plate settles it wherever the two namelists disagree -- a フルネーム that
 * matches the portrait's plate is left alone even when the canonical table
 * would have wanted another word. That disagreement used to run to around sixty
 * characters and has been reconciled by hand: the Sengoku names now read in the
 * order the rest of the translation uses on both sides ("Mouri Motonari"), and
 * the plates that were left as bare romanisations were respelled from the
 * glossaries ("Rarukatto" -> "Ralcat", "Yamisagi" -> "Dark Heron").
 *
 * What is left is the nineteen rows where the two tables are not naming the same
 * Japanese at all -- a generic portrait's role against the card's individual
 * name (汎用魔法使い "Wizard" against ジェリー・オネ), a joke design against the
 * character wearing it (ケーちゃん "K-Chan" against ケイブリス), a short name
 * against a full one (マジスコ against マジック・スコルピオン) -- which is why the
 * plate still settles a row it matches rather than the check policing the two
 * tables against each other.
 */
export const checkCardNames = async () => {
    const spellings = spellingsByName(await readSharedNameTable());
    const plates = await readPlates();
    const cards = await readCardKeys();
    const names = await readFullNames();

    const misnamed = [];
    let rows = 0;
    for (const [cardId, keys] of cards) {
        const card = names.get(cardId);
        if (!card || unnamed(card.english)) {
            continue;
        }
        const claims = [...spellings]
            .filter(([japanese]) => keys.some(key => key === japanese || opens(japanese, key)));
        if (claims.length === 0) {
            continue;
        }
        ++rows;
        const unmet = claims.filter(([, canonical]) => !canonical.some(name => agrees(card.english, name)));
        const plate = keys.flatMap(key => plates.get(key) ?? []);
        if (unmet.length === 0 || plate.some(name => agrees(card.english, name))) {
            continue;
        }
        misnamed.push(`the card ${JSON.stringify(cardId)} is named ${JSON.stringify(card.english)},`
            + ` where the translation spells ${unmet.map(([japanese, canonical]) =>
                `${japanese} ${canonical.map(name => `"${name}"`).join(" or ")}`).join(", ")}`);
    }

    return {report: `${rows} card names`, misnamed};
};
