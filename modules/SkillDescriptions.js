/**
 * The skill descriptions -- the lines the game prints under a skill's name.
 *
 * They are the 説明 column of archives/Rance10EX_v1_04/11_スキルデータ.x, one
 * string per skill carrying its own line breaks:
 *
 *     { 1072,"Shuriken",1,2,"手裏剣",1,100,1,50,54,70,0,0,"",0,0,
 *       "Attack (Ranged) (0.5x)\rAction Prevention 70%" },
 *
 * The break is the two characters \r rather than a real one, which is the form
 * the table has to carry and the form an `alice ex dump` does not give back --
 * the top of CLAUDE.md says why. Splitting on it is the whole of the parsing
 * here; everything else in the row belongs to the numbers.
 *
 * Nothing wraps and nothing clips, so a line too wide for its panel runs out
 * over the frame. Two views draw these strings and only one of them states how
 * wide it is:
 *
 *   Game/Battle/SkillDescriptionView.pactex.x   the panel in battle, whose Desc
 *                                               part carries a placeholder of
 *                                               fifteen full-width characters
 *                                               at フォントサイズ 28, 字間隔 -2
 *   Game/Party/PlayerDetailSkillView.pactex.x   the character sheet, which
 *                                               draws the same text one size
 *                                               larger against a CG background
 *                                               whose width is not in the layout
 *
 * So the measure below is the battle panel's, and the second one is why this
 * reports a band as well as a hard overflow: a line that only just fits the
 * panel that states its width has nowhere to hide in the panel that does not.
 *
 * docs/text-width.md has the font, the units and how to measure a panel that
 * nobody has settled yet.
 */
import * as fs from "fs/promises";
import * as path from "path";
import {ROOT} from "./Env.js";
import {gameTextWidth, trackingFor} from "./GameFont.js";

/** The game's own table, with the English written into it. Edited by hand. */
export const SKILL_DATA = path.join(ROOT, "archives", "Rance10EX_v1_04", "11_スキルデータ.x");

/**
 * The tracking the battle panel declares for its Desc part: 字間隔 -2 at
 * フォントサイズ 28. Negative, where the synopsis panel's is positive -- so
 * measuring these lines with the default would overstate a twenty-character
 * line by three and a half full-width glyphs.
 */
const panelTracking = () => trackingFor(-2, 28);

/**
 * What one line fits: the placeholder Game/Battle/SkillDescriptionView.pactex.x
 * carries for its Desc part, which is three rows of
 * スキル説明スキル説明スキル説明 -- fifteen full-width characters.
 *
 * Three rows is the placeholder rather than the limit -- the game's own table
 * has rows of four lines, and the panel is 160 tall against a Desc that starts
 * at 56 and steps 25 a line. So this counts nothing but width.
 */
export const LONGEST_LINE = "１２３４５６７８９０１２３４５";

/**
 * The widest line the game itself prints: skill 1317's 　相手側も軍師効果がある際,
 * thirteen full-width characters, which is 87% of the placeholder. Nothing in
 * the untranslated table passes it -- 2039 lines measured against an
 * `alice ex dump` of an original v1.04 Rance10EX.ex.
 *
 * Written out rather than computed because the original .ex is not in this
 * repository and should not be: the point of the number is that it does not
 * change between runs.
 */
export const WIDEST_JAPANESE = "　相手側も軍師効果がある際";

/** The rows of the table: an id, a name, and the columns between them. */
const ROW = /^\s*\{ (\d+),"([^"]*)"/;

/** The 説明, which is the last column, and the last row carries no comma. */
const DESCRIPTION = /"([^"]*)" \},?\s*$/;

let panel = null;
let japanese = null;

const panelWidth = () => (panel ??= gameTextWidth(LONGEST_LINE, panelTracking()));
const japaneseWidth = () => (japanese ??= gameTextWidth(WIDEST_JAPANESE, panelTracking()));

/** How wide the panel draws this line, in the units of modules/GameFont.js. */
export const panelTextWidth = (text) => gameTextWidth(text, panelTracking());

/** Whether the game can draw this line inside the panel that states its width. */
export const fitsPanel = (text) => panelTextWidth(text) <= panelWidth();

/** Whether it is wider than any line the untranslated table asks the panel for. */
export const widerThanJapanese = (text) => panelTextWidth(text) > japaneseWidth();

/**
 * Every skill in the table, in the order it sits there: the id, the name, and
 * the description as the lines the game will break it into.
 */
export const readSkillDescriptions = async () => {
    const rows = [];
    for (const row of (await fs.readFile(SKILL_DATA, "utf-8")).split(/\r?\n/)) {
        const columns = ROW.exec(row);
        const description = DESCRIPTION.exec(row);
        if (!columns || !description) {
            continue;
        }
        rows.push({
            id: Number(columns[1]),
            name: columns[2],
            lines: description[1].split(/\\r/),
        });
    }
    if (!rows.length) {
        throw new Error(`No skill rows in ${path.relative(ROOT, SKILL_DATA)}.`
            + " Its shape must have changed; see ROW and DESCRIPTION here.");
    }
    return rows;
};

const asPercent = (text) => `${Math.round(panelTextWidth(text) / panelWidth() * 100)}%`;

const listing = (found) => found
    .map(({skill, line}) => `  ${asPercent(line).padStart(5)}  ${skill.id} ${skill.name}: ${line}`);

/**
 * What the widths came to, as lines to print.
 *
 * Two lists, because the two panels know different amounts about themselves.
 * The first is text the battle panel cannot draw and is a defect. The second is
 * text it can draw and the game's own writers never asked it to, which is as
 * much as can be said about the character sheet without measuring it.
 */
export const reportSkillWidths = (skills) => {
    const all = skills.flatMap(skill => skill.lines.map(line => ({skill, line})));
    const over = all.filter(({line}) => !fitsPanel(line));
    const band = all.filter(({line}) => fitsPanel(line) && widerThanJapanese(line));
    const widest = (rows) => rows.sort((a, b) => panelTextWidth(b.line) - panelTextWidth(a.line));
    return [
        `${all.length} lines in ${skills.length} skills, measured against the fifteen`,
        "full-width characters Game/Battle/SkillDescriptionView.pactex.x carries.",
        "",
        `${over.length} wider than the panel. The game draws these out over the frame:`,
        ...listing(widest(over)),
        "",
        `${band.length} inside the panel, but wider than anything the untranslated table`,
        `asks it for (${asPercent(WIDEST_JAPANESE)}). Worth a look rather than a defect: the character`,
        "sheet draws the same text one size larger and does not say how wide it is.",
        ...listing(widest(band)),
    ];
};
