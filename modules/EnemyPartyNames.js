/**
 * The name over an enemy's HP bar -- ランス部隊's opposite number, the one that
 * reads ジャハルッカス or 魔物兵(25匹) while the fight is on.
 *
 * That string is Enemy@Id, which Ｔ敵本体生成 fills in from its own ▲名前: one
 * function, 178 calls to Ｔ敵本, 231 names. Nothing compares Enemy@Id -- the
 * keys are the fields beside it, コード名 and ▲ＣＧ名, which pick the enemy's
 * data and its picture -- so all five places that read it are display:
 * BattleHpBar@PartyName, SceneSimpleBattleInfo, SceneBattleInformation,
 * BattleLog@EnemyName and PlayerAction@StarterName.
 *
 * Which is why this is an override rather than 231 translated strings. The
 * strings cannot be translated as a group: 45 of the slots are pushed somewhere
 * else as well, and 14 of those are keys -- ジャハルッカス is the Id Ｔカード箱
 * hands to the card box, マエリータ隊 is a flag name TadaFlags::Parse reads back
 * -- so translating them would break a lookup rather than change a label. See
 * docs/enemy-party-names.md, and docs/card-name-localization.md for the same
 * shape one layer down.
 *
 * 64 of these names *were* translated as strings, in
 * patches/system_cherry_picks.v1.04.ain.txt, before any of this existed. They
 * are in the glossary now and out of that file: keyed by the Japanese, a name
 * is translated once, and there is nowhere left to write a second spelling of
 * it.
 */
import * as fs from "fs/promises";
import * as path from "path";
import {BUILD, ROOT} from "./Env.js";
import {gameTextWidth} from "./GameFont.js";
import {createNameChecker} from "./NameNormalizer.js";

/** The function that names every enemy in the game, and the local it names them in. */
export const ENEMY_PARTY_FUNCTION = "Ｔ敵本体生成";
export const ENEMY_PARTY_VARIABLE = "▲名前";

/** The accessor the whole of this hangs on: display everywhere, key nowhere. */
export const ENEMY_ID_ACCESSOR = "Enemy@Id::get";

export const ENEMY_PARTY_NAMES = path.join(ROOT, "game", "extracted", "enemy_party_names.v1.04.tsv");
export const ENEMY_PARTY_GLOSSARY = path.join(ROOT, "glossaries", "enemy_party_glossary.tsv");

/** Generated, so it goes to build/ beside race_names.jaf rather than to patches/. */
export const ENEMY_PARTY_JAF = path.join(BUILD, "enemy_party_names.jaf");

/**
 * What 難易度調整 sticks on the end of a name after the table below was written,
 * and what the .jaf has to take off again before it can look one up.
 *
 * Two kinds. A difficulty pass marks a fight it has quietly rebalanced -- "+"
 * where it made a too-weak enemy stronger, "v" where it cut down one that
 * outclassed the party -- and either can land twice, so ジャハルッカス+ and
 * 魔物兵vv are names the player really sees. Then, if the enemy is a group, ▲数
 * is appended as (25匹): a bracket, the number, and the counter word for
 * whatever is being counted -- 匹 for beasts, 名 for people, 体 for things.
 *
 * The counter word is dropped rather than translated. "Monster Soldiers (25匹)"
 * is the one thing worse than either language on its own, and English has no
 * counter to put there; ×25 is what the game itself writes elsewhere.
 */
export const REBALANCE_MARKS = ["+", "v"];
export const COUNTER_WORDS = ["匹", "名", "体"];

/**
 * How wide a name can go before it is worth saying something.
 *
 * Nothing clips here and nothing wraps: Name in HpBarEnemy.pactex.x and
 * HpBarPlayer.pactex.x carries 表示領域 = 0,0,0,0, so the text runs from where
 * it starts -- left to right from x=15 for the enemy, right to left from
 * x=1906 for the party. What it runs *across* is the bar it labels, 867 pixels
 * of シス／戦闘／敵ＨＰ下地 drawn at font 32, and the game's own longest name --
 * 魔人レッドアイ（トッポス憑依） -- uses 531 of them.
 *
 * So this is a warning rather than a limit, and it is set at the bar rather
 * than at the Japanese: a name wider than the thing it labels has stopped
 * reading as a label, but it is still legible, and shortening it is a
 * judgement about wording.
 */
const BAR_PIXELS = 867;
const NAME_FONT = 32;

/**
 * gameTextWidth counts in the font file's own units, where a full-width glyph
 * is 45; the layout draws this label at 32 pixels. docs/text-width.md has the
 * measure and where the two numbers that are not in the file came from.
 */
const FULL_WIDTH_UNITS = 45;
export const namePixels = (english) => gameTextWidth(english) / FULL_WIDTH_UNITS * NAME_FONT;

const readTsv = async (filePath) => {
    const text = await fs.readFile(filePath, "utf-8");
    return text.split(/\r?\n/)
        .filter(line => line.trim() && !line.startsWith("#"))
        .map(line => line.split("\t"));
};

/** The Japanese names, in the order Ｔ敵本体生成 defines them. */
export const readEnemyPartyNames = async () => {
    const rows = await readTsv(ENEMY_PARTY_NAMES);
    return rows.map(([japanese, slot, otherUses]) => ({
        japanese: JSON.parse(japanese),
        slot: Number(slot),
        otherUses: Number(otherUses),
    }));
};

export const readEnemyPartyGlossary = async () => {
    const rows = await readTsv(ENEMY_PARTY_GLOSSARY);
    return new Map(rows.map(([japanese, english]) => [japanese, english ?? ""]));
};

/** A .jaf string literal: the compiler takes C escapes, and these carry quotes and brackets. */
const literal = (text) => JSON.stringify(text);

/** name.EndsWith("x") || name.EndsWith("y"), for however many the constants above name. */
const endsWithAny = (suffixes) => suffixes.map(suffix => `name.EndsWith(${literal(suffix)})`).join(" || ");

/**
 * The .jaf to hand alice-tools, and what to say about it.
 *
 * A name with no English is left out of the chain, so it falls through and the
 * plate draws the Japanese -- what it drew before this existed. The compiler
 * has no switch and no map, so the lookup is the same chain of compares the
 * game's own naming functions are written as.
 */
export const renderEnemyPartyNamesJaf = async () => {
    const names = await readEnemyPartyNames();
    const glossary = await readEnemyPartyGlossary();
    const checkNames = await createNameChecker();

    const cases = [];
    const overlong = [];
    const misnamed = [];
    let untranslated = 0;
    for (const {japanese} of names) {
        const english = glossary.get(japanese);
        if (!english) {
            ++untranslated;
            continue;
        }
        if (namePixels(english) > BAR_PIXELS) {
            overlong.push(english);
        }
        misnamed.push(...checkNames(japanese, english));
        cases.push(`\tif (name == ${literal(japanese)}) return ${literal(english)};`);
    }

    const known = new Set(names.map(name => name.japanese));
    const stale = [...glossary.keys()].filter(japanese => !known.has(japanese));

    const text = [
        "/*",
        " * The name over an enemy's HP bar, in English.",
        " *",
        " * GENERATED by the build from glossaries/enemy_party_glossary.tsv -- edit that, not",
        " * this. modules/EnemyPartyNames.js says why this is an override rather than 231",
        " * translated strings, and docs/enemy-party-names.md has the whole of it.",
        " */",
        "",
        "/*",
        ` * The table: the Japanese exactly as ${ENEMY_PARTY_FUNCTION}'s ${ENEMY_PARTY_VARIABLE} holds it, and`,
        " * the name itself back where the glossary has nothing -- so an enemy this patch",
        " * does not know is the Japanese the plate drew before, never a blank plate.",
        " */",
        "string EnemyPartyName(string name)",
        "{",
        ...cases,
        "\treturn name;",
        "}",
        "",
        "/*",
        " * One name as the player sees it, suffixes and all.",
        " *",
        " * ▲名前 reaches Enemy@Id with whatever 難易度調整 appended to it: (25匹) if the",
        " * enemy is a group, and + or v, up to twice, if the difficulty pass rebalanced",
        " * the fight. Those come off before the lookup and go back on after it -- except",
        " * the counter word, which English has nothing to put in place of: a count reads",
        " * ×25 here rather than (25匹).",
        " *",
        " * A name of the game's own can end in a bracket too -- 魔人ケイブリス(猛撃) is five",
        " * different fights -- which is why a count is recognised by its counter word",
        " * rather than by the bracket alone.",
        " */",
        "string EnemyPartyEnglish(string raw)",
        "{",
        "\tstring name = raw;",
        '\tstring count = "";',
        '\tstring marks = "";',
        `\tif (${endsWithAny(COUNTER_WORDS.map(word => word + ")"))}) {`,
        '\t\tint bracket = name.FindLast("(");',
        "\t\tif (bracket >= 0) {",
        "\t\t\tcount = name;",
        "\t\t\tcount.Erase(0, bracket + 1);",
        "\t\t\tcount.Erase(count.Length() - 2, 2);",
        '\t\t\tcount = " ×" + count;',
        "\t\t\tname.Erase(bracket, name.Length() - bracket);",
        "\t\t}",
        "\t}",
        `\twhile (${endsWithAny(REBALANCE_MARKS)}) {`,
        "\t\tstring mark = name;",
        "\t\tmark.Erase(0, mark.Length() - 1);",
        "\t\tmarks = mark + marks;",
        "\t\tname.PopBack();",
        "\t}",
        "\treturn EnemyPartyName(name) + marks + count;",
        "}",
        "",
        "/*",
        " * The plate above the HP bar, the battle log, and the two battle info screens all",
        " * read the name through this one accessor, and nothing else reads it at all.",
        " */",
        `override string ${ENEMY_ID_ACCESSOR}(void)`,
        "{",
        "\treturn EnemyPartyEnglish(super());",
        "}",
        "",
    ].join("\n");

    return {
        text,
        report: `${cases.length} of ${names.length} enemy names`
            + (untranslated ? `, ${untranslated} still Japanese` : "")
            + (overlong.length ? `, ${overlong.length} wider than the HP bar` : "")
            + (misnamed.length ? `, ${misnamed.length} spelling a name their own way` : "")
            + (stale.length ? `, ${stale.length} glossary entries the game no longer has` : ""),
        overlong,
        misnamed,
        stale,
    };
};
