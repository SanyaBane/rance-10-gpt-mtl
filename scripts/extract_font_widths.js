/**
 * Read the glyph advances out of the game's own font into a small committed
 * table, so a width check can measure the way the game draws.
 *
 *   npm run regenerate-font-widths
 *   node scripts/extract_font_widths.js --font=<some other Rance10Font.fnl>
 *
 * Rance10Font.fnl is 133 MB of glyph atlas with the advances in its index, and
 * a build may never read GAME_DIR -- that is what makes --out safe (CLAUDE.md,
 * and outputDir in modules/AliceTools.js). So the advances are extracted once,
 * here, into game/extracted/font_advances.v1.04.tsv, the way the two tables
 * beside it are extracted out of the .ain. A few kilobytes against 133 MB.
 *
 * The file, as far as this needs it:
 *
 *     0x00  "FNA\0"
 *     0x14  u32  the first character code, 33 -- '!'
 *     0x20  u32  glyphs in a block
 *     0x26       the first block: that many {u32 offset, u32 size, u16 advance}
 *
 * Each offset is the previous one plus its size, which is what the reading is
 * checked against below. There are 41 blocks -- one per size, of two faces --
 * and this takes the first: the advances go out as ratios to a full-width
 * glyph, so what is wanted is the face's proportions and not any one size.
 * docs/text-width.md has the rest of the format and where the two numbers that
 * are *not* in the file come from.
 *
 * What goes in the table is the printable ASCII, which is the English, plus one
 * full-width glyph to stand for every character that is not ASCII: 8819 of the
 * block's 8994 glyphs share one advance, and they are the CJK ones. Their order
 * past ASCII is the game's own character order rather than Unicode's, so naming
 * them individually would mean guessing at an encoding to buy nothing -- they
 * are all one em wide.
 */
import * as fs from "fs/promises";
import * as path from "path";
import {ROOT, required} from "../modules/Env.js";
import {run} from "../modules/AliceTools.js";
import {FONT_ADVANCES, FULL_WIDTH_SAMPLE} from "../modules/GameFont.js";

const MAGIC = "FNA\0";
const FIRST_CODE_AT = 0x14;
const GLYPH_COUNT_AT = 0x20;
const BLOCK_AT = 0x26;
const RECORD = 10;

/** '!' through '~': every character the English of a caption can be made of. */
const FIRST_ASCII = 0x21;
const LAST_ASCII = 0x7e;

const argument = (name) => {
    const flag = process.argv.slice(2).find(arg => arg.startsWith(`--${name}=`));
    return flag?.slice(name.length + 3);
};

/**
 * The first block's advances, checked rather than trusted: the offsets chain,
 * so a header that has moved shows up as a broken chain on the first record
 * instead of as a table of plausible nonsense.
 */
const readBlock = (font) => {
    const magic = font.subarray(0, MAGIC.length).toString("latin1");
    if (magic !== MAGIC) {
        throw new Error(`Not a font: ${JSON.stringify(magic)} where ${JSON.stringify(MAGIC)} should be.`);
    }
    const firstCode = font.readUInt32LE(FIRST_CODE_AT);
    const glyphs = font.readUInt32LE(GLYPH_COUNT_AT);
    if (firstCode !== FIRST_ASCII || glyphs < LAST_ASCII - FIRST_ASCII + 1) {
        throw new Error(`The index starts at character ${firstCode} and holds ${glyphs} glyphs,`
            + ` which is not the ${FIRST_ASCII}-and-up this knows how to read.`);
    }
    if (BLOCK_AT + glyphs * RECORD > font.length) {
        throw new Error(`${glyphs} records do not fit in the ${font.length} bytes read.`);
    }

    const advances = [];
    let expected = font.readUInt32LE(BLOCK_AT);
    for (let at = 0; at < glyphs; at++) {
        const record = BLOCK_AT + at * RECORD;
        const offset = font.readUInt32LE(record);
        if (offset !== expected) {
            throw new Error(`Glyph ${at} of the first block says its bitmap is at ${offset},`
                + ` where the one before it ends at ${expected}. The index is not`
                + " {offset, size, advance} records any more.");
        }
        expected = offset + font.readUInt32LE(record + 4);
        advances.push(font.readUInt16LE(record + 8));
    }
    return {firstCode, advances};
};

/** The advance 8819 of the 8994 glyphs share: one em, and every CJK glyph. */
const fullWidth = (advances) => {
    const seen = new Map();
    for (const advance of advances) {
        seen.set(advance, (seen.get(advance) ?? 0) + 1);
    }
    const [[advance, count]] = [...seen].sort((a, b) => b[1] - a[1]);
    if (count < advances.length / 2) {
        throw new Error(`The commonest advance in the block, ${advance}, is only ${count} of`
            + ` ${advances.length} glyphs. A full-width glyph should be nearly all of them.`);
    }
    return advance;
};

run(async () => {
    const font = Buffer.alloc(256 * 1024);
    const fontPath = argument("font") ?? path.join(required("GAME_DIR"), "Rance10Font.fnl");
    const handle = await fs.open(fontPath, "r");
    try {
        await handle.read(font, 0, font.length, 0);
    } finally {
        await handle.close();
    }

    const {firstCode, advances} = readBlock(font);
    const em = fullWidth(advances);

    // The ten digits are one advance in the game's font as they are in every
    // other, so they land together if the glyphs really do run in code order --
    // which is the one thing about this reading that a wrong header would not
    // trip over on its own.
    const digits = new Set("0123456789".split("").map(digit => advances[digit.charCodeAt(0) - firstCode]));
    if (digits.size !== 1) {
        throw new Error(`The ten digits come out ${[...digits].join(", ")} wide. The glyphs are not`
            + " in code order from '!', so nothing below is the character it claims to be.");
    }

    const rows = [];
    for (let code = FIRST_ASCII; code <= LAST_ASCII; code++) {
        rows.push(`${JSON.stringify(String.fromCharCode(code))}\t${advances[code - firstCode]}`);
    }
    rows.push(`${JSON.stringify(FULL_WIDTH_SAMPLE)}\t${em}`);

    const header = [
        "# How wide each character is in the game's own font, from the index of",
        `# Rance10Font.fnl. Generated by scripts/extract_font_widths.js -- nothing here`,
        "# is edited by hand, and modules/GameFont.js is what reads it.",
        "#",
        "# Columns: the character, JSON-quoted <TAB> its advance.",
        "#",
        `# The units are the first block's, where a full-width glyph is ${em}; only the`,
        "# ratios matter, since the panel a string is measured against is given in",
        "# full-width characters too. The advance is the glyph alone -- the tracking",
        "# the layout adds per character, and the space, which has no glyph at all,",
        "# were measured in the game and live in modules/GameFont.js.",
        "#",
        `# ${JSON.stringify(FULL_WIDTH_SAMPLE)} stands for every character that is not ASCII: 8819 of the block's`,
        "# 8994 glyphs share that one advance and they are the CJK ones. docs/text-width.md",
        "# has the format and the measurements.",
        "",
    ].join("\n");
    await fs.writeFile(FONT_ADVANCES, header + rows.join("\n") + "\n", "utf-8");

    console.log(`${rows.length} advances from ${fontPath}, a full-width glyph being ${em}`
        + ` -> ${path.relative(ROOT, FONT_ADVANCES)}`);
    return 0;
});
