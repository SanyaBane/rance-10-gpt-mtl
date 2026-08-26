/**
 * The faction on the back of a card -- the word after "Belong".
 *
 * An enemy's race gets modules/RaceNames.js and a card's faction gets this, and
 * the two are the same shape for the same reason: the word is chosen by an int
 * and the strings it is chosen from are keys somewhere else. What is different
 * here is how narrow the escape is.
 *
 * getOrganizationNameFromId (FUNC 28857) turns 所属 1..10 into one of 主人公,
 * リーザス, ヘルマン, ゼス, 自由都市, ＪＡＰＡＮ, その他, 亜人, モンスター, 神魔. Nineteen
 * places call it, and in eighteen of them the result is not shown to anybody --
 * it is pasted into a CG name:
 *
 *   シス／カード／下地／%s所属          the card's background, and its 枠 frame
 *   シス／カード／名札／%s所属          the plate the card's name sits on
 *   シス／キャラ詳細／所属旗／%s所属     the flag on the character detail screen
 *   シス／デッキ編成／タブ／%s所属       the deck screen's faction tabs
 *   シス／クエスト／有利所属／%s所属     the quest screen's advantage panel
 *
 * Those pictures are where the player actually reads the faction, and the ones
 * worth translating are translated already, as images, under
 * archives/Rance10CG2_v1_04/. So the function cannot return English: nine of the
 * ten words are half of a file name, and changing them would leave the card
 * with no background at all.
 *
 * The nineteenth call is the one BlendText on the back of the card, in
 * CardConstructProcessCacheBackCard@Create, and it is the only place in the
 * whole game where the faction is drawn as *text*. That call is what this
 * renders a replacement for: a new function, called instead of the local the
 * CG names are built from, so every one of those names keeps its Japanese and
 * only the drawn word changes. patches/card_back_names.jam is the call site,
 * and docs/organization-names.md is the whole of it.
 *
 * Rendered for every build that applies anything, not only a translated one.
 * The .jam that calls it is the same file in a Japanese build, so the function
 * has to exist there too -- and in a Japanese build it returns the game's own
 * words, which makes that build's card back byte-for-byte what it always was.
 */
import * as fs from "fs/promises";
import * as path from "path";
import {BUILD, ROOT} from "./Env.js";
import {createNameChecker} from "./NameNormalizer.js";

export const ORGANIZATION_GLOSSARY = path.join(ROOT, "glossaries", "organization_name_glossary.tsv");

/** Generated, so it goes to build/ beside the other two generated .jaf. */
export const ORGANIZATION_JAF = path.join(BUILD, "organization_names.jaf");

/** The name the two .jam call. Nothing in the game has it; this file defines it. */
export const ORGANIZATION_FUNCTION = "OrganizationEnglishName";

/**
 * The game's own table, from getOrganizationNameFromId (FUNC 28857) -- a switch
 * of ten S_PUSH, in this order.
 *
 * Written here rather than dumped into game/extracted/ like the four tables
 * there: those are hundreds to thousands of rows and each has a regenerate
 * script, and this is ten literals in one function. To check it against another
 * version of the game:
 *
 *   alice ain dump -c -o code.jam game/ain/Rance10.v1.04.ain
 *   then read the switch under "; getOrganizationNameFromId".
 *
 * Party::OrganizationIdFromString (FUNC 27830) names the same ten in the same
 * order, which is the second reading of it.
 */
export const ORGANIZATIONS = [
    [1, "主人公"],
    [2, "リーザス"],
    [3, "ヘルマン"],
    [4, "ゼス"],
    [5, "自由都市"],
    [6, "ＪＡＰＡＮ"],
    [7, "その他"],
    [8, "亜人"],
    [9, "モンスター"],
    [10, "神魔"],
];

/*
 * THERE IS NO WIDTH CHECK HERE, AND THAT IS DELIBERATE.
 *
 * There was one. It measured with modules/GameFont.js against the 131 pixels
 * between the "Belong" label and the right-align point, and it was wrong: it
 * called 神魔 "Gods/Demons" seven pixels too wide, and the card in the game
 * has room to spare. Everything the line draws was then read off the screen
 * one by one, so what a check has left to catch here is a faction nobody
 * looked at -- and there are ten of them, all looked at.
 *
 * What it was wrong *about* is worth writing down, because the same measure is
 * used elsewhere. game/extracted/font_advances.v1.04.tsv is the first of the
 * forty-one blocks in Rance10Font.fnl, and GameFont scales it to any font size
 * by treating its full-width advance -- 45 -- as one em. The blocks are a
 * ladder of raster sizes, full-width 45, 73, 101, 129, 157, 184, 212, and the
 * proportions inside them are not constant: M is 0.98 of a full-width glyph in
 * the block we took, 0.84 five blocks up, 0.79 ten, 0.72 twenty. 0.98 is what
 * the smallest raster does when every advance rounds up to a whole pixel, not
 * what the face looks like. Scaling that block down to font size 20 overstates
 * a small line by something like half again.
 *
 * Which means GameFont overstates elsewhere too, docs/synopsis-screen.md's 597
 * two-row captions included, and it is not a constant to nudge inside a
 * faction glossary. docs/text-width.md is where that belongs; it already has a
 * "Measuring it again" section for exactly this.
 *
 * The line is drawn at font size 20 rather than the game's 25, which is what
 * the check was for. patches/card_back_names.jam sets it and says why; a
 * faction long enough to be a problem there is a thing to look at on the card,
 * which is the only instrument that has been right about it so far.
 */

const readTsv = async (filePath) => {
    const text = await fs.readFile(filePath, "utf-8");
    return text.split(/\r?\n/)
        .filter(line => line.trim() && !line.startsWith("#"))
        .map(line => line.split("\t"));
};

export const readOrganizationGlossary = async () => {
    const rows = await readTsv(ORGANIZATION_GLOSSARY);
    return new Map(rows.map(([japanese, english]) => [japanese.trim(), (english ?? "").trim()]));
};

/**
 * The .jaf to hand alice-tools, and what to say about it.
 *
 * `japanese` renders the game's own words instead of the English, which is what
 * --text-lang=jp asks for: the same .jam calls the same function, and the card
 * back comes out exactly as the game drew it. A row left out of the glossary
 * falls through the same way, per faction rather than per build.
 *
 * The compiler takes if/return over strings and not much else -- see
 * features/base-stats-on-card/base_stats_on_card.jam for what it refused -- so
 * this is the chain of compares the game's own function is a switch of.
 */
export const renderOrganizationNamesJaf = async ({japanese = false} = {}) => {
    const glossary = japanese ? new Map() : await readOrganizationGlossary();
    const checkNames = japanese ? () => [] : await createNameChecker();

    const cases = [];
    const misnamed = [];
    let untranslated = 0;
    for (const [id, own] of ORGANIZATIONS) {
        const english = glossary.get(own);
        if (!english) {
            ++untranslated;
            cases.push([`\tif (id == ${id}) return ${JSON.stringify(own)};`, own]);
            continue;
        }
        misnamed.push(...checkNames(own, english));
        cases.push([`\tif (id == ${id}) return ${JSON.stringify(english)};`, own]);
    }

    // The Japanese each line answers to, in a column, so that reading the
    // generated file against the glossary is reading down rather than across.
    // Not against a line that is already returning it -- an untranslated
    // faction, or the whole of a Japanese build -- where it would only be the
    // same word twice.
    const column = Math.max(0, ...cases.map(([code]) => code.length)) + 2;
    const body = cases.map(([code, own]) => code.includes(JSON.stringify(own))
        ? code
        : code.padEnd(column) + `// ${own}`);

    const known = new Set(ORGANIZATIONS.map(([, own]) => own));
    const stale = [...glossary.keys()].filter(own => !known.has(own));

    const text = [
        "/*",
        " * The faction on the back of a card, for the one BlendText that draws it.",
        " *",
        " * GENERATED by the build from glossaries/organization_name_glossary.tsv -- edit",
        " * that, not this. modules/OrganizationNames.js says why this is a new function",
        " * rather than a translated string or an override of the game's own, and",
        " * docs/organization-names.md has the whole of it.",
        " *",
        " * A faction with no English returns the game's own word, so the card back falls",
        " * back to what it always drew rather than to a blank.",
        " */",
        `string ${ORGANIZATION_FUNCTION}(int id)`,
        "{",
        ...body,
        "\treturn \"\";",
        "}",
        "",
    ].join("\n");

    return {
        text,
        /* The whole line, verb and all, because the Japanese one is not a translation. */
        report: japanese
            ? `Left the card back's ${ORGANIZATIONS.length} factions in Japanese`
            : `Translated ${ORGANIZATIONS.length - untranslated} of ${ORGANIZATIONS.length} factions`
                + (untranslated ? `, ${untranslated} still Japanese` : "")
                + (misnamed.length ? `, ${misnamed.length} spelling a name their own way` : "")
                + (stale.length ? `, ${stale.length} glossary entries the game no longer has` : ""),
        misnamed,
        stale,
    };
};
