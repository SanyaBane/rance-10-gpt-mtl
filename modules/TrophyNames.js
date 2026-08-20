/**
 * The name of an achievement on the 実績 screen.
 *
 * The screen draws one string per row and that string is the trophy's Id --
 * TrophyPage@InitButtons sets the button's text to it, SceneTrophyDetail writes
 * it into the Name label of the panel shown when one is earned. The same string
 * is also, at the same time:
 *
 *   the ex-tree key       実績情報.<Id>.種類 and .ボーナス and .値 and .説明,
 *                         which is how the trophy is defined at all
 *   the scenario's handle Ｐ実績確認 and Ｐ実績ＯＮ take it as a string, from
 *                         some two hundred places in the script
 *   the save key          CompletedTrophy@Add stores a TrophyInfo carrying it
 *                         and calls CollectionSaveData::Save; IsExist compares
 *                         the stored strings
 *
 * So translating it where it sits reads every earned trophy in every existing
 * save back as unearned, and takes the clear points, the stat bonuses and the
 * route unlocks with it. The Id stays Japanese, and the English goes in beside
 * it under 英名 -- the same shape patches/card_names.jaf uses for a card's Id,
 * for the same reason. patches/trophy_names.jaf reads it back.
 *
 * Which leaves the layout, and the layout is the interesting part. A row is not
 * one label but two columns drawn as one string: the name on the left, and the
 * ★ or ● bonus flag pinned to a fixed column by a run of full-width spaces.
 * Fifty-seven of the hundred and nine ids carry such a tail, and all fifty-seven
 * put the marker at the eighteenth full-width character -- the padding is one
 * space in one row and eleven in another, chosen to land there. On a page of
 * twenty-six rows that column is what makes the bonuses readable down the page
 * rather than one per line to hunt for.
 *
 * English is proportional, so the column cannot be reproduced by counting
 * characters. It is measured: the name's width against eighteen full-width
 * characters, and the gap filled with ASCII spaces, which are about four tenths
 * of a full-width character and so land within half a character of the mark.
 *
 * docs/trophy-names.md has the widths, what the tail column costs, and the two
 * things in this table that must not be translated.
 */
import * as fs from "fs/promises";
import * as path from "path";
import {ROOT} from "./Env.js";
import {gameTextWidth, SPACE, TRACKING} from "./GameFont.js";
import {createNameChecker} from "./NameNormalizer.js";

/** The game's own table, translated in place except for the two key columns. */
export const TROPHY_DATA = path.join(ROOT, "archives", "Rance10EX_v1_04", "40_実績情報.x");

export const TROPHY_GLOSSARY = path.join(ROOT, "glossaries", "trophy_name_glossary.tsv");
export const TROPHY_BONUS_GLOSSARY = path.join(ROOT, "glossaries", "trophy_bonus_glossary.tsv");

/**
 * The tracking the 実績 row charges, in the units of
 * game/extracted/font_advances.v1.04.tsv, where a full-width glyph is 45.
 *
 * gameTextWidth charges the synopsis panel's, which is a different layout: 字間隔
 * is +4 at フォントサイズ 48 there and -1 at 34 here. Converting -1 pixel into these
 * units needs the pixel size of a full-width glyph, which is not the フォントサイズ
 * -- read off a screenshot of this screen it is about 25 pixels at 34, so a
 * pixel is about 1.8 units.
 *
 * The number matters because English spends far more characters on the same
 * width than Japanese does, so a per-character charge is not a scale. It is not
 * worth measuring harder: at 0 instead of -1.8 a thirty-character name moves by
 * about one and a quarter full-width characters out of eighteen, which is why
 * the report below says how close to the edge a name lands rather than only
 * whether it crossed.
 */
const TRACK = -1.8;

/** How wide this row draws a string, in those units. */
const width = (text) => gameTextWidth(text) + (TRACK - TRACKING) * text.length;

/** One full-width character, and the space the padding is built out of. */
const FULL_WIDTH = 45 + TRACK;
const SPACE_WIDTH = SPACE + TRACK;

/**
 * Where the bonus flag goes, and how much line there is, both in full-width
 * characters and both read off the Japanese rather than off the plate.
 *
 * The plate is 792 pixels wide and the text starts 68 in, but nothing here
 * clips and nothing shrinks to fit -- TextButton@SetText scales text down only
 * when TextMaxWidth is set, and it is initialised to -1 and never assigned. So
 * the honest budget is the one the game's own strings state: the marker column
 * they all share, and the widest line they draw.
 */
const COLUMN = 18;
const LINE = 28;

const readTsv = async (filePath) => {
    const text = await fs.readFile(filePath, "utf-8");
    return text.split(/\r?\n/)
        .filter(line => line.trim() && !line.startsWith("#"))
        .map(line => line.split("\t"));
};

const readGlossary = async (filePath) => new Map(
    (await readTsv(filePath)).map(([japanese, english]) => [japanese, (english ?? "").trim()]));

/** Where the ★ or ● tail of an Id starts, or -1 for the fifty-two without one. */
const markerAt = (id) => id.search(/[★●]/);

/**
 * The Id split into the two columns the row draws: the name, with the padding
 * that positions the tail dropped, and the tail itself.
 */
const columnsOf = (id) => {
    const marker = markerAt(id);
    return marker < 0
        ? [id.trim(), ""]
        : [id.slice(0, marker).replace(/[　 ]+$/, ""), id.slice(marker)];
};

/**
 * The English row: the name, then enough spaces to put the tail where the
 * Japanese puts it.
 *
 * A name already at or past the column gets a single space instead, so the tail
 * still reads as a separate thing rather than running into the last word. That
 * row is reported rather than cut -- as everywhere else here, a line too wide
 * runs out over the plate and stays legible, and shortening it is a decision
 * for whoever writes the glossary.
 */
const compose = (name, tail) => {
    if (!tail) {
        return name;
    }
    const gap = COLUMN * FULL_WIDTH - width(name);
    if (gap <= 0) {
        return name + " " + tail;
    }
    /*
     * Most of the gap in full-width spaces and the remainder in ASCII ones.
     * Full-width is what the Japanese rows are padded with, so it is the part
     * that cannot behave unexpectedly; ASCII is two fifths as wide and takes
     * the landing to within a fifth of a character, where full-width alone
     * would leave half a character of jitter down the page.
     */
    const wide = Math.floor(gap / FULL_WIDTH);
    const fine = Math.round((gap - wide * FULL_WIDTH) / SPACE_WIDTH);
    const padding = "　".repeat(wide) + " ".repeat(fine);
    return name + (padding || " ") + tail;
};

/** As the .x quotes a string. Nothing here has either, but nothing says so. */
const quote = (text) => `"${text.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

/**
 * The table with an 英名 written into every entry the glossary names, and what
 * to say about it.
 *
 * Rendered rather than written into the file for the reason the synopsis table
 * is (modules/SummaryLines.js): the key is the Japanese, so a table with the
 * English over it would match nothing the next time. scripts/ex.js hands
 * alice-tools a copy of the tree with this in it.
 */
export const renderTrophyTable = async () => {
    const source = await fs.readFile(TROPHY_DATA, "utf-8");
    const names = await readGlossary(TROPHY_GLOSSARY);
    const bonuses = await readGlossary(TROPHY_BONUS_GLOSSARY);
    const checkNames = await createNameChecker();

    const lines = source.split(/\r?\n/);
    const rendered = [];
    const ids = [];
    const overlong = [];
    const misnamed = [];
    const missingBonus = new Set();
    let current = null;
    let untranslated = 0;

    for (const line of lines) {
        const opening = line.match(/^\t(.*) = \{$/);
        if (opening) {
            current = opening[1].replace(/^"(.*)"$/, "$1");
            ids.push(current);
        }
        if (line === "\t}," && current !== null) {
            const [, japaneseTail] = columnsOf(current);
            const name = names.get(current);
            const tail = japaneseTail ? bonuses.get(japaneseTail) : "";
            if (!name) {
                ++untranslated;
            } else if (japaneseTail && tail === undefined) {
                missingBonus.add(japaneseTail);
                ++untranslated;
            } else {
                const english = compose(name, tail);
                /*
                 * Two ways to be too wide, and they are worth telling apart:
                 * a name past the column pushes its own tail out of line, and
                 * a tail past what the column leaves runs off the plate. The
                 * first is one glossary row to shorten, the second is one term
                 * that is too long on every row that uses it.
                 */
                if (width(name) > (japaneseTail ? COLUMN : LINE) * FULL_WIDTH) {
                    overlong.push({english, over: "name", was: width(name) / FULL_WIDTH,
                        budget: japaneseTail ? COLUMN : LINE});
                } else if (width(english) > LINE * FULL_WIDTH) {
                    overlong.push({english, over: "tail", was: width(tail) / FULL_WIDTH,
                        budget: LINE - COLUMN});
                }
                misnamed.push(...checkNames(current, english));
                rendered.push(`\t\t英名 = ${quote(english)},`);
            }
            current = null;
        }
        rendered.push(line);
    }

    const known = new Set(ids);
    const stale = [...names.keys()].filter(japanese => !known.has(japanese));
    const translated = ids.length - untranslated;

    return {
        text: rendered.join("\n"),
        report: `${translated} of ${ids.length} achievement names`
            + (untranslated ? `, ${untranslated} still Japanese` : "")
            + (overlong.length ? `, ${overlong.length} past the column` : "")
            + (misnamed.length ? `, ${misnamed.length} spelling a name their own way` : "")
            + (stale.length ? `, ${stale.length} glossary entries the game no longer has` : ""),
        overlong: overlong
            .sort((first, second) => second.was - first.was)
            .map(({english, over, was, budget}) =>
                `${over} is ${was.toFixed(1)} of ${budget} full-width characters:`
                + ` ${JSON.stringify(english)}`),
        misnamed,
        stale,
        missingBonus: [...missingBonus],
    };
};
