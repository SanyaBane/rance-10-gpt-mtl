/**
 * How wide a string is when the game draws it.
 *
 * Not how wide Meiryo draws it, which is what getTextWidth in
 * modules/TextNormalization.js answers and what this repository measured
 * panels with for a long time. The game ships its own font and its
 * proportions are not Meiryo's -- a capital M is 0.98 of a full-width glyph
 * here against Meiryo's 0.83 -- so the error is not a scale that a multiplier
 * could take out. On the synopsis panel it is the difference between "no
 * caption is too wide" and around 570 of them.
 *
 * getTextWidth stays where it is: the dialogue wrapping hangs on it, and the
 * dialogue window is a different measure that nobody has settled the same way.
 *
 * Three numbers make a width, and only the first is in the font file:
 *
 *   the advance of each glyph   game/extracted/font_advances.v1.04.tsv
 *   the tracking per character  measured in the game -- TRACKING below
 *   the width of a space        measured in the game -- SPACE below
 *
 * The last two are not in the file at all: the layout charges 字間隔 on top of
 * every character, and the glyph index starts at '!', so a space has no glyph
 * to have an advance. Both were read off screenshots of rulers built into a
 * real panel, and docs/text-width.md has the readings, the range they leave and
 * how to take them again for a panel nobody has settled yet.
 */
import * as fs from "fs";
import * as path from "path";
import {ROOT} from "./Env.js";

/** The advances, extracted from Rance10Font.fnl by scripts/extract_font_widths.js. */
export const FONT_ADVANCES = path.join(ROOT, "game", "extracted", "font_advances.v1.04.tsv");

/**
 * The character the table carries the full-width advance against, and what
 * every character outside printable ASCII is measured as.
 *
 * One row rather than 8894: past ASCII the glyphs run in the game's own
 * character order rather than Unicode's, and 8819 of the block's 8994 share
 * this one advance because they are the CJK ones. Naming them individually
 * would mean guessing an encoding to learn nothing.
 */
export const FULL_WIDTH_SAMPLE = "１";

/**
 * Tracking and space, in the units of the table -- where a full-width glyph is
 * 45 -- as measured in the game.
 *
 * Eleven readings over two screenshots leave a range rather than a point:
 * tracking 3.05 to 5.80, space 13.25 to 21.50. These are the middle of it, and
 * they are what the ２４１／３ panels were laid out with and then checked on
 * the screen. The layout's own 字間隔 = 4 at フォントサイズ 48 is 3.75 in these
 * units, which lands inside the measured range without having been fitted to
 * it.
 *
 * What the width of the range does not move is the part that gets used: every
 * caption of thirty characters or fewer fits a synopsis row at any point in it,
 * and thirty-four crosses at every point.
 */
export const TRACKING = 4.75;
export const SPACE = 18.25;

/**
 * Read on first use rather than at import, because scripts/extract_font_widths.js
 * imports this module for the path it writes to and a fresh clone of a version
 * whose table has not been generated yet would otherwise fail to load it.
 */
let advances = null;

const readAdvances = () => {
    let text;
    try {
        text = fs.readFileSync(FONT_ADVANCES, "utf-8");
    } catch (error) {
        if (error.code !== "ENOENT") {
            throw error;
        }
        throw new Error(`No font table at ${path.relative(ROOT, FONT_ADVANCES)}.`
            + " Run: npm run regenerate-font-widths");
    }
    const table = new Map(text.split(/\r?\n/)
        .filter(line => line.trim() && !line.startsWith("#"))
        .map(line => line.split("\t"))
        .map(([character, advance]) => [JSON.parse(character), Number(advance)]));
    if (!table.has(FULL_WIDTH_SAMPLE) || !table.has("M")) {
        throw new Error(`${path.relative(ROOT, FONT_ADVANCES)} has no row for`
            + ` ${JSON.stringify(FULL_WIDTH_SAMPLE)} or none for "M", so it is not the table`
            + " scripts/extract_font_widths.js writes.");
    }
    return table;
};

/** One em: what a full-width character costs, and the unit everything is in. */
export const em = () => (advances ??= readAdvances()).get(FULL_WIDTH_SAMPLE);

/**
 * The advance of one character, before tracking.
 *
 * Anything the table does not name is full-width. That covers the kana and
 * kanji of an untranslated caption, and the full-width punctuation an English
 * one is allowed to keep -- a leading ※, a leading full-width space.
 */
const advanceOf = (character) => {
    advances ??= readAdvances();
    return character === " " ? SPACE
        : advances.get(character) ?? advances.get(FULL_WIDTH_SAMPLE);
};

/**
 * How wide the game draws this string, in the table's units.
 *
 * Compare it against a string of the full-width characters the panel is
 * measured in -- LONGEST_LINE in modules/SummaryLines.js is twenty of them --
 * rather than against a number, so the units never have to be thought about.
 */
export const gameTextWidth = (text) => text.split("")
    .reduce((width, character) => width + advanceOf(character) + TRACKING, 0);
