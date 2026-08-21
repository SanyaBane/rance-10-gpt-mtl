/**
 * The name on the Location plate -- the banner across the top of the quest map
 * that reads スルメ山 while the party is climbing it.
 *
 * The plate is two things and only one of them was ever translated. The frame,
 * with the word Location on the left, is a picture: シス／クエスト／地名 in
 * Rance10CG2, redrawn by hand from the 地名 the game shipped, and
 * docs/image-archives.md says how it gets packed. The yellow name inside it is
 * data, and this is where that comes from:
 *
 *   SceneQuestMap@UpdateMusicAndView      on entering a quest and on every step
 *     QuestInformationPanel@PlaceName::set    writes the Place label of
 *                                             Game/Quest/QuestInformationpanel2
 *       QuestMapParamAccessor@PlaceName::get  reads the 地名 of the map param
 *
 * and a map param's 地名 is the `地名 = "..."` of 5_クエストデータ.x -- 655 rows
 * carrying 254 distinct names, at the quest, at a step inside it, and inside a
 * 選択分岐 branch. Nothing else in the game reads the field: the code has two
 * S_PUSH "地名" and both are the getter above. So this is display text, and it
 * can be translated where it sits -- with one exception, below.
 *
 * It had not been. The tables under archives/Rance10EX_v1_04/ are translated by
 * editing them, and whoever went through this one did the 説明 -- 1957 of 1961
 * -- and walked past the 地名, of which three were English and 652 were not. The
 * three were the ホルスの宇宙戦艦 quest, translated to match its own name in
 * 6_クエスト情報.x, and they were English *in place of* the Japanese: the key
 * they were keyed by was gone. Restoring 巨大戦艦遺跡 to those rows is the first
 * half of this; the glossary is the second.
 *
 * ## ランス城 is a sentinel, not a name
 *
 * PlaceName::get does not simply return the field:
 *
 *     place = param.地名;
 *     if (place == "ランス城") return RanceCastlePositionString;
 *     return place;
 *
 * and RanceCastlePositionString switches on TadaFlagFunc::Get(1) between
 * ランス城空中, ＪＡＰＡＮ城, ランス砦 and ランス城 -- where the castle is at that
 * point in the game. So the 25 rows saying ランス城 are asking for whichever of
 * the four applies, and English in them would answer that question once and for
 * the rest of the game. The row is left Japanese here and the four literals are
 * a .ain job, because two of them are shared string slots that must not be
 * translated: s[2915] ランス城 is pushed 157 times and s[2966] ランス砦 19,
 * both as CG and quest keys. docs/place-names.md has what that job is.
 *
 * ## The plate is 458 pixels and the name is centred in it
 *
 * Place in QuestInformationpanel2.pactex.x sits at x=230 of a 458-wide frame with
 * 原点座標モード 5, which is the middle of the nine, so the name grows both ways
 * from the centre of the plate. It is drawn at フォントサイズ 32 with 字間隔 -1.
 * The word Location ends at x=79 of the frame -- measured off the picture -- so a
 * name wider than about 300 pixels starts to cross it, and one wider than 458
 * leaves the plate altogether.
 *
 * Neither clips. 55 of the game's own 254 names are already over the label and
 * the widest of them, a joke name 744 pixels long, is over the plate by half its
 * length again. So this reports rather than shortens, the way every other width
 * here does, and the number to act on is the one that leaves the plate.
 */
import * as fs from "fs/promises";
import * as path from "path";
import {ROOT} from "./Env.js";
import {gameTextWidth, trackingFor} from "./GameFont.js";
import {createNameChecker} from "./NameNormalizer.js";

/** The game's own table. Written into by the build, never by hand. */
export const PLACE_DATA = path.join(ROOT, "archives", "Rance10EX_v1_04", "5_クエストデータ.x");

/** The English for it. Hand-written; this is the file to edit. */
export const PLACE_GLOSSARY = path.join(ROOT, "glossaries", "place_name_glossary.tsv");

/**
 * The one value of 地名 that the code reads as a question rather than an answer.
 * The header of the glossary says what it stands for and the module comment says
 * why English in it cannot work.
 */
export const SENTINEL = "ランス城";

/** Every `地名 = "..."`, and nothing else in the file has that shape. */
const PLACE_LINE = /^(\t+地名 = ")([^"]*)(",)$/;

/** Kana or kanji: a value without any is a separator or a row of ？, not text. */
const JAPANESE = /[぀-ヿ㐀-䶿一-鿿]/;

/**
 * The plate, in its own pixels, from Game/Quest/QuestInformationpanel2.pactex.x and
 * from the picture behind it.
 *
 * CENTRE is Place's 座標, PLATE the width of シス／クエスト／地名, and LABEL the
 * last column of the word Location in it. Everything grows from CENTRE, so what
 * a name may spend before it reaches the label is twice the gap between them.
 */
const CENTRE = 230;
const PLATE = 458;
const LABEL = 80;
export const LABEL_BUDGET = 2 * (CENTRE - LABEL);

/** The label's own font size and tracking, and the units the font table is in. */
const FONT = 32;
const SPACING = -1;
const FULL_WIDTH_UNITS = 45;

/** How wide the plate draws this name, in the pixels the numbers above are in. */
export const placePixels = (text) =>
    gameTextWidth(text, trackingFor(SPACING, FONT)) / FULL_WIDTH_UNITS * FONT;

const readTsv = async (filePath) => {
    const text = await fs.readFile(filePath, "utf-8");
    return text.split(/\r?\n/)
        .filter(line => line.trim() && !line.startsWith("#"))
        .map(line => line.split("\t"));
};

export const readPlaceGlossary = async () => new Map(
    (await readTsv(PLACE_GLOSSARY)).map(([japanese, english]) => [japanese, (english ?? "").trim()]));

/**
 * The table with the English written over every 地名 the glossary names, and
 * what to say about it.
 *
 * Returned rather than written back, for the reason modules/SummaryLines.js and
 * modules/TrophyNames.js are: the glossary is keyed by the Japanese, so a table
 * with its Japanese replaced would match nothing on the second run and quietly
 * build with no English at all. scripts/ex.js hands alice-tools a copy.
 */
export const renderPlaceTable = async () => {
    const source = await fs.readFile(PLACE_DATA, "utf-8");
    const glossary = await readPlaceGlossary();
    const checkNames = await createNameChecker();

    const rendered = [];
    const counts = new Map();
    let rows = 0;

    for (const line of source.split(/\r?\n/)) {
        const match = line.match(PLACE_LINE);
        if (!match) {
            rendered.push(line);
            continue;
        }
        const [, opening, japanese, closing] = match;
        ++rows;
        counts.set(japanese, (counts.get(japanese) ?? 0) + 1);
        const english = japanese === SENTINEL ? "" : glossary.get(japanese);
        if (!english) {
            rendered.push(line);
            continue;
        }
        if (english.includes('"') || english.includes("\\")) {
            throw new Error(`The English for ${JSON.stringify(japanese)} has a quote or a backslash,`
                + ` which the table has no way to write: ${JSON.stringify(english)}`);
        }
        rendered.push(opening + english + closing);
    }

    const names = [...counts.keys()];
    const translated = names.filter(japanese =>
        japanese !== SENTINEL && glossary.get(japanese));
    const untranslated = names.filter(japanese =>
        japanese !== SENTINEL && !glossary.get(japanese) && JAPANESE.test(japanese));
    const stale = [...glossary.keys()].filter(japanese => !counts.has(japanese));

    /*
     * A name whose English crosses the Location label, and the same count for
     * the Japanese it replaces. The second number is what makes the first
     * readable: the game itself crosses that label on 55 names, so a build
     * saying 123 is saying English is wider, not that something broke.
     */
    const overLabel = translated.filter(japanese => placePixels(glossary.get(japanese)) > LABEL_BUDGET);
    const wasOverLabel = names.filter(japanese => placePixels(japanese) > LABEL_BUDGET);

    /*
     * The list to act on: a name too wide for the plate at all. Reported with
     * the width of the Japanese beside it, because a row where the Japanese was
     * wider still -- the joke name of the ｖｓホーネット quest -- is the game's
     * own doing and not something to shorten.
     */
    const offPlate = translated
        .map(japanese => ({japanese, english: glossary.get(japanese)}))
        .map(row => ({...row, now: placePixels(row.english), was: placePixels(row.japanese)}))
        .filter(row => row.now > PLATE)
        .sort((first, second) => second.now - first.now);

    const misnamed = translated.flatMap(japanese => checkNames(japanese, glossary.get(japanese)));

    return {
        text: rendered.join("\n"),
        report: `${translated.length} of ${names.length} place names, ${rows} rows`
            + (untranslated.length ? `, ${untranslated.length} still Japanese` : "")
            + `, ${overLabel.length} over the Location label where the game has ${wasOverLabel.length}`
            + (offPlate.length ? `, ${offPlate.length} wider than the plate` : "")
            + (stale.length ? `, ${stale.length} glossary entries the game no longer has` : ""),
        offPlate: offPlate.map(({english, now, was}) =>
            `${Math.round(now)} pixels of the plate's 458, against ${Math.round(was)}`
            + ` for the Japanese: ${JSON.stringify(english)}`),
        misnamed,
        stale,
        untranslated,
    };
};
