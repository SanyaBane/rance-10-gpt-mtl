/**
 * The synopsis lines -- the rows あらすじモード prints for one event.
 *
 * They live in archives/Rance10EX_v1_04/37_あらすじデータ.x as a tree of one node per
 * event, each node holding numbered fields:
 *
 *     ２２１／２／ラングバウ到着 = {
 *         ００ = "｜−−−−−−−−｜−−−−−−−−−｜",
 *         ０１ = "ラング・バウに到着",
 *         ０２ = "",
 *         ０３ = "まずは寝る",
 *         ...
 *
 * The node name is a key -- SceneSummary looks the event up by it, and
 * SummaryData@Desc::get then reads あらすじデータ.<node>.%02D -- so it stays
 * Japanese whatever happens to the text. The fields are display-only: their
 * only reader is the TextDesc part of Game/Adv/SceneSummary.pactex.
 *
 * Two files hold the translation between them, the way the enemy status lines
 * do (see modules/EnemyInfo.js):
 *
 *   37_あらすじデータ.x    the game's own table, which the English is written into
 *   glossaries/summary_glossary.tsv   the English, written against the Japanese
 *
 * Keyed by the Japanese rather than by node and field: 6414 filled fields are
 * 4465 distinct phrases, "戦闘開始" alone appearing 85 times, and a phrase the
 * game repeats should be translated once rather than once per event.
 *
 * What the fields are *not* is one caption apiece for the English to slot into.
 * The panel is seven rows of twenty full-width characters and nothing in it
 * wraps, so an English caption too wide for a row has to be laid across two
 * fields -- which the panel has the room for far more often than not. That is
 * why renderSummaryTable below rebuilds each node rather than substituting
 * field by field. docs/synopsis-screen.md has the screen, docs/text-width.md
 * the measure.
 */
import * as fs from "fs/promises";
import * as path from "path";
import {ROOT} from "./Env.js";
import {gameTextWidth} from "./GameFont.js";
import {createNameChecker, mentions} from "./NameNormalizer.js";

/** The game's own table. Written into by the build, never by hand. */
export const SUMMARY_DATA = path.join(ROOT, "archives", "Rance10EX_v1_04", "37_あらすじデータ.x");

/** The English for it. Hand-written; this is the file to edit. */
export const SUMMARY_GLOSSARY = path.join(ROOT, "glossaries", "summary_glossary.tsv");

/**
 * The terms the panel has settled on -- the operations, the fortresses, the
 * map. Hand-written, and read into a prompt beside the names.
 */
export const SUMMARY_TERMS = path.join(ROOT, "glossaries", "summary_terms.tsv");

/**
 * The two scratch files a batch passes through: the prompt scripts/summary_chunk.js
 * writes, and the reply scripts/summary_merge.js reads back if given no path.
 *
 * In local/, which is gitignored, because a batch in flight is nobody else's
 * business and the glossary is where the result belongs.
 */
export const CHUNK_FILE = path.join(ROOT, "local", "summary_chunk.txt");
export const REPLY_FILE = path.join(ROOT, "local", "summary_reply.txt");

/**
 * What one row fits: the placeholder the layout carries for TextDesc in
 * archives/Rance10Pact_v1_04/Game/Adv/SceneSummary.pactex.x, which is seven lines of
 * twenty full-width characters.
 *
 * The designers left the same measure in the data itself -- field ００ of most
 * nodes is a ruler, "｜−−−−−−−−｜−−−−−−−−−｜", with its marks at 1, 10 and 20.
 * Do not measure that one, though: it is drawn with U+2212, which is narrower
 * than a full-width glyph. This is the measure; ００ is the picture of it.
 */
export const LONGEST_LINE = "１２３４５６７８９０１２３４５６７８９０";

/**
 * How many rows the panel draws. The base CG, entry 0 of Rance10CG4.afa, has
 * seven dotted rules on it, and no event in the table is taller than seven.
 *
 * Fields ０８ to １０ are read by the game as well, and they do print -- onto
 * the ornamental frame under the box, beside the Play Event button, which is a
 * bug rather than a row. Every one of them is empty in the table and this
 * leaves them that way.
 */
export const PANEL_ROWS = 7;

/** The fields the panel draws, ０１ to ０７, by their number. */
const PANEL_FIELD = /^0[1-7]$/;

const toAscii = (fullWidth) => fullWidth.replace(/[０-９]/g, char =>
    String.fromCharCode(char.charCodeAt(0) - "０".charCodeAt(0) + "0".charCodeAt(0)));

const toFullWidth = (ascii) => ascii.replace(/[0-9]/g, char =>
    String.fromCharCode(char.charCodeAt(0) - "0".charCodeAt(0) + "０".charCodeAt(0)));

/** The name of the nth row's field: 1 is ０１. */
const fieldName = (row) => toFullWidth(String(row).padStart(2, "0"));

/** Kana or kanji: what is left is separators and text already in English. */
const JAPANESE = /[぀-ヿ㐀-䶿一-鿿]/;

let box = null;

/** The width of one row, in the units modules/GameFont.js measures in. */
const panelWidth = () => (box ??= gameTextWidth(LONGEST_LINE));

/** Whether the game can draw this caption inside one row of the panel. */
export const fitsPanel = (text) => gameTextWidth(text) <= panelWidth();

/**
 * Words a row should not end on: the reader needs the next one to know what
 * they were told, and the panel's rows are spaced far enough apart that a row
 * ending in "and" reads as a caption that lost its tail rather than as a line
 * that carries on. Preferred against rather than forbidden -- some captions
 * have nowhere better to break.
 */
const DANGLING = new Set(("a an and are as at be but by for from her his in into is it its no not of on"
    + " or that the their this to was were with").split(" "));

/**
 * And a row should not begin with one of these, which is the same rule seen
 * from the other side: "※Best friend =" carries on, where "= Sushinu the
 * Gandhi" starts nowhere.
 */
const LEADING = /^[=:-]+$/;

/**
 * A caption broken across as many rows as it needs, on spaces.
 *
 * Fewest rows first, then the evenest split of them, and a word that should not
 * end a row costs a break the same as being a quarter of the panel short. A
 * caption that has to take two rows reads better halved than
 * filled-then-dribbled, because the panel's dotted rules space every row the
 * same: "The satellite weapon / comes into view" reads as one caption where
 * "The satellite weapon comes / into view" reads as two.
 *
 * That is as far as a rule goes. Whether the second row stands up as a caption
 * of its own is the translator's to hear, and the way to fix one that does is
 * to phrase the caption so it breaks where they want it to.
 *
 * A single word wider than the row is left to run off it. There is nothing else
 * to do with one, and the caller reports it.
 */
export const wrapToPanel = (text) => {
    if (fitsPanel(text)) {
        return [text];
    }
    const words = text.split(" ");
    const width = (from, to) => gameTextWidth(words.slice(from, to).join(" "));

    // From the end backwards: the best way to set words[at..] is one row of
    // words[at..to) plus the best way to set the rest. Fewest rows decides it,
    // and squared slack -- which is smallest when the rows come out even --
    // breaks the ties.
    const best = Array(words.length + 1);
    best[words.length] = {rows: 0, cost: 0, next: words.length};
    const dangling = (panelWidth() / 4) ** 2;
    for (let at = words.length - 1; at >= 0; at--) {
        for (let to = at + 1; to <= words.length; to++) {
            const slack = panelWidth() - width(at, to);
            if (slack < 0 && to > at + 1) {
                break;
            }
            const rows = 1 + best[to].rows;
            const awkward = to < words.length
                && (DANGLING.has(words[to - 1].toLowerCase()) || LEADING.test(words[to]));
            const cost = slack * slack + best[to].cost + (awkward ? dangling : 0);
            if (!best[at] || rows < best[at].rows || (rows === best[at].rows && cost < best[at].cost)) {
                best[at] = {rows, cost, next: to};
            }
        }
    }

    const wrapped = [];
    for (let at = 0; at < words.length; at = best[at].next) {
        wrapped.push(words.slice(at, best[at].next).join(" "));
    }
    return wrapped;
};

/**
 * One event's captions laid into the rows the panel draws.
 *
 * Takes the captions in field order -- "" where the designers left a blank
 * between two thoughts -- and gives back the rows to write, blanks in place and
 * padded out to however many fields the node had.
 *
 * A blank is a separator and not a spare row, so it is kept where it is; the
 * blanks trailing the last caption are the padding and are the room a wrapped
 * caption goes into. Where there is not enough of that room, the captions that
 * overflow least are put back onto one row and left to run off the panel, which
 * is what they do today and what the report says out loud. Nothing is dropped
 * and nothing is truncated: an eighth row would print on the frame under the
 * box, and a cut caption would read as a finished one.
 */
export const layOutPanel = (captions) => {
    const body = [...captions];
    while (body.length && body[body.length - 1] === "") {
        body.pop();
    }

    const laid = body.map(caption => ({caption, rows: caption === "" ? [""] : wrapToPanel(caption)}));
    const height = () => laid.reduce((rows, item) => rows + item.rows.length, 0);

    // Narrowest first: a caption at 101% of the row barely leaves it, one at
    // 150% is halfway over the OK button, so the wrapping to give up first is
    // the one that was buying the least.
    const straightened = [];
    const byOverflow = laid
        .filter(item => item.rows.length > 1)
        .sort((a, b) => gameTextWidth(a.caption) - gameTextWidth(b.caption));
    for (const item of byOverflow) {
        if (height() <= PANEL_ROWS) {
            break;
        }
        item.rows = [item.caption];
        straightened.push(item.caption);
    }
    if (height() > PANEL_ROWS) {
        throw new Error(`${body.length} captions will not go into ${PANEL_ROWS} rows even unwrapped:`
            + ` ${JSON.stringify(body)}`);
    }

    const rows = laid.flatMap(item => item.rows);
    const wrapped = laid.filter(item => item.rows.length > 1).map(item => item.caption);
    while (rows.length < captions.length) {
        rows.push("");
    }
    return {rows, wrapped, straightened};
};

/**
 * The table read as lines, nodes and fields, keeping every line as it was.
 *
 * Split on "\n" alone so a CRLF file keeps its "\r" on the end of each line and
 * comes back out byte for byte, whatever the checkout did to the endings.
 */
const parseSummaryTable = (source) => {
    const lines = source.split("\n");
    const nodes = [];
    let node = null;
    for (const [at, raw] of lines.entries()) {
        const line = raw.endsWith("\r") ? raw.slice(0, -1) : raw;
        const opened = line.match(/^\t(\S.*?) = \{$/);
        if (opened) {
            node = {name: opened[1], fields: []};
            nodes.push(node);
            continue;
        }
        if (line === "\t},") {
            node = null;
            continue;
        }
        const field = line.match(/^\t\t(\S+) = "([^"]*)",$/);
        if (field && node) {
            node.fields.push({at, name: field[1], value: field[2], ending: raw.endsWith("\r") ? "\r" : ""});
        }
    }
    if (!nodes.length) {
        throw new Error(`No events in ${SUMMARY_DATA}. Either the file is not the tree of nodes`
            + " of numbered fields it used to be, or it is not there at all.");
    }
    return {lines, nodes};
};

/** The ０１ to ０７ fields of one node, trailing blanks and all. */
const panelFields = (node) => node.fields.filter(field => PANEL_FIELD.test(toAscii(field.name)));

/**
 * Every event as the panel shows it: its captions in row order, with the
 * trailing blanks dropped, so what is left is the height the panel is drawn to
 * and the room a longer caption could go into.
 */
export const readSummaryPanels = async () => {
    const {nodes} = parseSummaryTable(await fs.readFile(SUMMARY_DATA, "utf-8"));
    return nodes.map(node => {
        const rows = panelFields(node).map(field => field.value);
        while (rows.length && rows[rows.length - 1] === "") {
            rows.pop();
        }
        return {name: node.name, rows, free: PANEL_ROWS - rows.length};
    });
};

/**
 * The captions of one panel the build cannot fit, as the glossary stands.
 *
 * Asked of the panel rather than of the phrase, because the room a caption has
 * is not its own: three captions each wanting a second row in an event that has
 * two to spare means one of them goes without, and which one is decided by
 * layOutPanel and nothing else. A phrase-by-phrase guess at the same question
 * counted 26 where the layout finds 54.
 */
export const crampedCaptions = (panel, glossary) => {
    const laid = layOutPanel(panel.rows.map(japanese => glossary.get(japanese) || japanese));
    return laid.rows.filter(row => row && !fitsPanel(row));
};

/**
 * Every displayed phrase in the table, in the order the file has them, with the
 * events each one appears in.
 *
 * File order is narrative order, which is the order to translate in: "まずは寝る"
 * means something once you have read the line above it.
 */
export const readSummaryLines = async () => {
    const panels = await readSummaryPanels();
    const lines = new Map();
    for (const panel of panels) {
        for (const japanese of panel.rows) {
            if (!japanese || !JAPANESE.test(japanese)) {
                continue;
            }
            if (!lines.has(japanese)) {
                lines.set(japanese, {japanese, nodes: []});
            }
            lines.get(japanese).nodes.push(panel.name);
        }
    }
    if (!lines.size) {
        throw new Error(`No synopsis lines in ${SUMMARY_DATA}. Either the file is not the tree`
            + " of numbered fields it used to be, or it is not there at all.");
    }
    return [...lines.values()];
};

/** The English by the Japanese, blank second column included. */
export const readSummaryGlossary = async () => {
    let text;
    try {
        text = await fs.readFile(SUMMARY_GLOSSARY, "utf-8");
    } catch (error) {
        if (error.code === "ENOENT") {
            return new Map();
        }
        throw error;
    }
    return new Map(text.split(/\r?\n/)
        .filter(line => line.trim() && !line.startsWith("#"))
        .map(line => line.split("\t"))
        .map(([japanese, english]) => [japanese, (english ?? "").trim()]));
};

/**
 * The terms this screen has settled on, longest first so a match is the most
 * specific one -- 聖魔教団の遺産 rather than the 聖魔教団 inside it.
 *
 * Hand-written, and its own file rather than a paragraph of docs/synopsis-screen.md,
 * which is where these used to live: prose no script can read is prose the next
 * batch decides for itself, and 滅号作戦 is not something anybody invents the
 * same way twice.
 */
export const readSummaryTerms = async () => {
    let text;
    try {
        text = await fs.readFile(SUMMARY_TERMS, "utf-8");
    } catch (error) {
        if (error.code === "ENOENT") {
            return [];
        }
        throw error;
    }
    return text.split(/\r?\n/)
        .filter(line => line.trim() && !line.startsWith("#"))
        .map(line => line.split("\t"))
        .filter(([japanese, english]) => japanese && english)
        .map(([japanese, english, short]) => ({
            japanese,
            english: english.trim(),
            short: (short ?? "").trim(),
        }))
        .sort((a, b) => b.japanese.length - a.japanese.length);
};

/**
 * Which of those terms a caption uses, most specific first -- 聖魔教団の遺産
 * before the 聖魔教団 inside it, so a prompt reads the whole phrase before the
 * part of it.
 */
export const createTermFinder = async () => {
    const terms = await readSummaryTerms();
    return (japanese) => terms.filter(term => mentions(japanese, term.japanese));
};

const HEADER = [
    "# The English for the synopsis lines -- the rows あらすじモード prints when you",
    "# pick an event you have already seen. Hand-written; this is the file to edit.",
    "#",
    "# Columns: the Japanese <TAB> the English.",
    "#",
    "# The Japanese column is filled in by scripts/extract_summary_lines.js, which",
    "# reads archives/Rance10EX_v1_04/37_あらすじデータ.x and keeps whatever English is",
    "# already here. A line left blank stays Japanese in game.",
    "#",
    "# Keyed by the Japanese rather than by event, because the same phrase serves",
    "# many events -- 戦闘開始 opens 85 of them -- and should be translated once.",
    "# The order is the order the game's own table has, which is the order the",
    "# story happens in: a line reads differently once you have read the one above.",
    "#",
    `# One row of the panel fits twenty full-width characters (${LONGEST_LINE}),`,
    "# measured with the game's own font -- modules/GameFont.js, and docs/text-width.md",
    "# for why Meiryo is not it. Around 33 latin letters, and a caption over that is",
    "# not an error: the build lays it across two of the panel's seven rows wherever",
    "# the event has a row to spare. What has to be shortened is a caption in an",
    "# event that has not, and the scripts below report those separately.",
    "#",
    "# Translating a chunk at a time: scripts/summary_chunk.js prints the next rows",
    "# as a prompt -- --panels for a whole event at a time, which is what the room",
    "# for a second row is decided by -- and scripts/summary_merge.js reads the reply",
    "# back in. npm run regenerate-ex writes the result into the game's table.",
    "",
].join("\n");

const STALE_HEADING = [
    "",
    "# --- Phrases the game's table no longer has ---------------------------------",
    "# Kept because somebody wrote the English, not because anything reads them.",
    "# Delete a row once you are sure the phrase is gone for good rather than",
    "# reworded upstream.",
    "",
].join("\n");

/**
 * Write the glossary back, and say what is in it.
 *
 * Every row of the game's table, in its order, plus -- under a heading -- the
 * translated phrases the table no longer has. Nothing typed by hand is dropped
 * by a rewrite, which is what makes it safe to run either script as often as
 * you like.
 *
 * Two width reports rather than one, because they are two different jobs. A
 * caption over one row is ordinary now -- the build lays it onto a second one.
 * A caption over one row that appears in an event with no free row is the one
 * somebody has to shorten, and there are two orders of magnitude fewer of them.
 */
export const writeSummaryGlossary = async (lines, glossary) => {
    const checkNames = await createNameChecker();

    const rows = [];
    const overlong = [];
    const misnamed = [];
    let translated = 0;
    for (const {japanese} of lines) {
        const english = glossary.get(japanese) ?? "";
        if (english) {
            ++translated;
            if (!fitsPanel(english)) {
                overlong.push(`${japanese} -> ${english}`);
            }
            misnamed.push(...checkNames(japanese, english));
        }
        rows.push(`${japanese}\t${english}`);
    }

    // What the build will actually not fit, panel by panel, which is the same
    // list scripts/ex.js prints and a shorter one than "wider than a row".
    const cramped = (await readSummaryPanels())
        .flatMap(panel => crampedCaptions(panel, glossary).map(caption => `${panel.name}: ${caption}`));

    const known = new Set(lines.map(line => line.japanese));
    const stale = [...glossary].filter(([japanese, english]) => english && !known.has(japanese));

    await fs.writeFile(SUMMARY_GLOSSARY, HEADER + rows.join("\n") + "\n"
        + (stale.length ? STALE_HEADING + stale.map(row => row.join("\t")).join("\n") + "\n" : ""),
        "utf-8");

    return {translated, overlong, cramped, misnamed, stale};
};

/**
 * The game's table with the English laid into it, as text to build from.
 *
 * Returned rather than written back over 37_あらすじデータ.x, and that is the
 * whole design: the glossary is keyed by the Japanese, so a table that had its
 * Japanese replaced would match nothing on the next build. Writing in place
 * would work exactly once, and the second run would quietly produce a table
 * with no English in it at all. scripts/ex.js builds from a copy instead, and
 * the file under version control stays as the game shipped it.
 *
 * Node by node rather than field by field, because a caption may need two of
 * the panel's rows and the fields below it then have to move down. Everything
 * that is not a ０１ to ０７ field comes through untouched -- the node names,
 * the ００ ruler the designers worked against, the empty ０８ to １０ -- so the
 * only difference between what goes in and what comes out is the captions.
 */
export const renderSummaryTable = async () => {
    const source = await fs.readFile(SUMMARY_DATA, "utf-8");
    const {lines, nodes} = parseSummaryTable(source);
    const glossary = await readSummaryGlossary();

    const overlong = [];
    let translated = 0;
    let untranslated = 0;
    let wrapped = 0;

    // Where each node's rows go, by the line the first of them was on. Rebuilt
    // whole rather than edited in place: a wrapped caption needs a row the node
    // may not have had a field for.
    const replacements = new Map();
    for (const node of nodes) {
        const fields = panelFields(node);
        if (!fields.length) {
            continue;
        }
        const captions = fields.map(({value}) => {
            if (!value) {
                return "";
            }
            const english = glossary.get(value);
            if (!english) {
                untranslated += JAPANESE.test(value) ? 1 : 0;
                return value;
            }
            ++translated;
            return english;
        });

        const laid = layOutPanel(captions);
        wrapped += laid.wrapped.length - laid.straightened.length;
        // Whatever is still over one row after the layout: the captions put
        // back onto one row for want of a spare, and the occasional single word
        // that is wider than the panel and cannot be broken at all.
        overlong.push(...laid.rows.filter(row => row && !fitsPanel(row))
            .map(caption => `${node.name}: ${caption}`));

        const quoted = laid.rows.find(row => row.includes('"'));
        if (quoted !== undefined) {
            throw new Error(`A caption of ${node.name} has a double quote in it, which the table`
                + ` has no way to write: ${JSON.stringify(quoted)}`);
        }
        replacements.set(fields[0].at, {
            through: fields[fields.length - 1].at,
            lines: laid.rows.map((row, at) =>
                `\t\t${fieldName(at + 1)} = "${row}",${fields[0].ending}`),
        });
    }

    const out = [];
    for (let at = 0; at < lines.length; at++) {
        const replacement = replacements.get(at);
        if (!replacement) {
            out.push(lines[at]);
            continue;
        }
        out.push(...replacement.lines);
        at = replacement.through;
    }

    return {
        text: out.join("\n"),
        overlong,
        report: `${translated} synopsis fields`
            + (wrapped ? `, ${wrapped} laid across two rows` : "")
            + (untranslated ? `, ${untranslated} still Japanese` : "")
            + (overlong.length ? `, ${overlong.length} too wide with no row to spare` : ""),
    };
};

/** What writeSummaryGlossary found, as lines to print. */
export const reportSummaryGlossary = ({translated, overlong, cramped, misnamed, stale}, lines) => {
    const report = [`${translated} of ${lines.length} phrases have English`
        + ` -> ${path.relative(ROOT, SUMMARY_GLOSSARY)}`];
    if (misnamed.length) {
        report.push(`  ${misnamed.length} rows name somebody the tables spell another way`
            + " -- listed at the end");
    }
    if (overlong.length) {
        report.push(`  ${overlong.length} over one row, which the build lays onto a second`);
    }
    if (cramped.length) {
        report.push(`  ${cramped.length} over one row in an event with no row to spare --`
            + " these have to be shortened:");
        report.push(...cramped.slice(0, 5).map(row => `    ${row}`));
    }
    if (stale.length) {
        report.push(`  ${stale.length} translated phrases the game's table no longer has,`
            + " kept at the end of the file");
    }
    return report;
};

/**
 * The name complaints, which go last wherever they are printed.
 *
 * Noisy by design: around 308 of the 4458 rows trip it, nearly all because a
 * caption twenty characters wide cannot hold "Agireda Kosabusshi Zonna Abona"
 * and says "Agireda". What it is for is the other kind of hit -- a *different*
 * spelling of the same name -- and there is no way to tell the two apart from
 * here, so every one is printed and none of them is allowed to sit in front of
 * the reports somebody has to act on.
 */
export const reportSummaryNames = ({misnamed}) => misnamed.map(complaint => `  ${complaint}`);
