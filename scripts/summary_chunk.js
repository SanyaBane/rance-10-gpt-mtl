/**
 * Write the next batch of synopsis lines to local/summary_chunk.txt as a prompt
 * to paste into a chat, numbered so scripts/summary_merge.js can read the answer
 * back.
 *
 *   node scripts/summary_chunk.js               # the next 150 still in Japanese
 *   node scripts/summary_chunk.js 80            # ...or as many as you say
 *   node scripts/summary_chunk.js --from=2000   # start at that row instead
 *   node scripts/summary_chunk.js --clip        # and put it on the clipboard
 *   node scripts/summary_chunk.js --context     # for translating here, not in a chat
 *
 *   node scripts/summary_chunk.js --panels      # a whole event at a time
 *   node scripts/summary_chunk.js --panels 30   # ...as many events as you say
 *   node scripts/summary_chunk.js --panels --from=400
 *   node scripts/summary_chunk.js --panels --node=２４１／３
 *   node scripts/summary_chunk.js --panels --cramped
 *
 * A file rather than stdout, overwritten every run, because the obvious way to
 * pipe it on Windows -- `node scripts/summary_chunk.js | clip` -- turns every
 * Japanese character into a question mark. clip.exe reads its input as the
 * console code page unless it is UTF-16, and nothing about a pipe tells it the
 * bytes are UTF-8. The file is UTF-8 like everything else here, and --clip goes
 * through PowerShell's Set-Clipboard, which is handed text rather than bytes and
 * so cannot get the encoding wrong.
 *
 * The numbers are positions in glossaries/summary_glossary.tsv, and they are what makes
 * the round trip safe. Answering with the English alone would be a few hundred
 * tokens cheaper per batch and would silently shift every later line the moment
 * the model dropped one; with the numbers, a dropped or refused line is a gap
 * that merges as a gap. They stay valid as long as the game's table does, so a
 * batch can be answered days later or out of order. Panel mode changes what is
 * asked for, not that: the same numbers, and the same one line each back.
 *
 * The names are quoted into the prompt rather than left to the model: the one
 * failure this whole repository is arranged around is a plausible new spelling
 * of a name (CLAUDE.md, "Names come from the tables"), and a name it never saw
 * spelled is a name it will spell its own way. The terms of
 * glossaries/summary_terms.tsv go in beside them for the same reason -- 滅号作戦
 * is not something anybody invents the same way twice. Only the ones this batch
 * mentions, to keep the prompt short.
 */
import * as fs from "fs/promises";
import * as path from "path";
import {spawnSync} from "child_process";
import {ROOT} from "../modules/Env.js";
import {createNameFinder} from "../modules/NameNormalizer.js";
import {
    CHUNK_FILE,
    PANEL_ROWS,
    REPLY_FILE,
    createTermFinder,
    crampedCaptions,
    readSummaryGlossary,
    readSummaryLines,
    readSummaryPanels,
} from "../modules/SummaryLines.js";

/**
 * A count, however it was written: --size=80, --size 80, or a bare 80, since
 * the batch size is the one thing worth changing per run and typing the flag
 * for it every time is friction with no payoff.
 */
const args = process.argv.slice(2);

const fail = (message) => {
    console.error(message);
    process.exit(1);
};

const count = (value, name) => {
    const number = Number(value);
    if (!Number.isInteger(number) || number < 1) {
        fail(`${name} wants a whole number of rows, not ${JSON.stringify(value ?? "")}`);
    }
    return number;
};

const flag = (name, fallback) => {
    const inline = args.find(arg => arg.startsWith(`--${name}=`));
    if (inline) {
        return count(inline.slice(name.length + 3), `--${name}`);
    }
    const at = args.indexOf(`--${name}`);
    return at < 0 ? fallback : count(args[at + 1], `--${name}`);
};

const text = (name) => args.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3);

const bare = args.filter((arg, at) => !arg.startsWith("--") && !/^--(size|from)$/.test(args[at - 1] ?? ""));
if (bare.length > 1) {
    fail(`Only one batch size, but ${bare.length} were given: ${bare.join(", ")}`);
}

const panelMode = args.includes("--panels") || text("node") !== undefined || args.includes("--cramped");
const size = bare.length ? count(bare[0], "the batch size") : flag("size", panelMode ? 20 : 150);
const from = flag("from", 1);
const toStdout = args.includes("--context");

const lines = await readSummaryLines();
const glossary = await readSummaryGlossary();
const numberOf = new Map(lines.map((line, index) => [line.japanese, index + 1]));

const findNames = await createNameFinder();
const findTerms = await createTermFinder();

/**
 * The names and terms a batch of Japanese mentions, spelled the way the tables
 * spell them. Both are quoted rather than left to the model, and the shorter
 * form a term carries goes in with it: 聖櫃 is "the Ark" in four rows out of
 * five because the full name will not fit twenty characters.
 */
const vocabulary = (japanese) => {
    const names = new Map();
    const terms = new Map();
    for (const line of japanese) {
        for (const record of findNames(line)) {
            names.set(record.shortNameJpn, record.shortNameEng);
        }
        for (const term of findTerms(line)) {
            terms.set(term.japanese, term.english + (term.short ? ` (${term.short} where it must be short)` : ""));
        }
    }
    // A handful of words are in both tables -- 魔軍 is a name as far as
    // modules/NameNormalizer.js is concerned, because the dialogue kept calling
    // it the Demon Army. Saying it twice in one prompt is noise, and the names
    // table is the one the checker reads.
    for (const japanese of names.keys()) {
        terms.delete(japanese);
    }
    return {names, terms};
};

const listed = (heading, pairs) => !pairs.size ? [] : [
    heading,
    ...[...pairs].map(([japanese, english]) => `  ${japanese} = ${english}`),
];

/**
 * Where the prompt goes. The file exists to get UTF-8 past a Windows pipe, so
 * --context, which is for translating in this session rather than pasting the
 * batch anywhere, skips it and writes to stdout.
 */
const deliver = async (prompt, summary) => {
    if (toStdout) {
        console.log(prompt);
        console.error(summary);
        return;
    }
    await fs.mkdir(path.dirname(CHUNK_FILE), {recursive: true});
    await fs.writeFile(CHUNK_FILE, prompt + "\n", "utf-8");

    /**
     * Set-Clipboard rather than clip.exe, and -Encoding utf8 rather than trusting
     * the default: Windows PowerShell 5.1 reads a file as the ANSI code page unless
     * told otherwise, which is the same question marks by another route.
     */
    let copied = false;
    if (args.includes("--clip")) {
        const result = spawnSync("powershell", [
            "-NoProfile",
            "-Command",
            `Get-Content -Raw -Encoding utf8 -LiteralPath '${CHUNK_FILE}' | Set-Clipboard`,
        ], {stdio: ["ignore", "ignore", "inherit"]});
        copied = !result.error && result.status === 0;
        if (!copied) {
            console.log(`  could not reach the clipboard (${result.error?.message ?? `exit ${result.status}`})`
                + " -- the file is written either way");
        }
    }

    console.log(`${summary} -> ${path.relative(ROOT, CHUNK_FILE)}${copied ? " and the clipboard" : ""}`);
    console.log(`Save the reply to ${path.relative(ROOT, REPLY_FILE)}`
        + " and run: node scripts/summary_merge.js");
};

/**
 * A whole event at a time.
 *
 * The panel is what the captions have to work as -- seven rows read in one
 * glance, blanks between the thoughts -- and it is also what decides how much
 * room there is: a caption over one row is laid onto two by the build wherever
 * the event has a row to spare, so the same phrase gets a wider budget in an
 * event with four blank rows than in one already seven deep. Handing over a
 * flat list of phrases hides both.
 *
 * A phrase belongs to the first panel of the file that shows it, and reads as
 * context in the rest. 4145 of the 4458 appear in exactly one panel, so this
 * decides little; what it decides is that 戦闘開始, which opens 85 events, is
 * not retranslated 85 times to suit whichever panel came last.
 */
const panelBatch = async () => {
    const panels = await readSummaryPanels();
    const owner = new Map();
    for (const line of lines) {
        owner.set(line.japanese, line.nodes[0]);
    }

    const wanted = text("node");
    const chosen = panels
        .map((panel, index) => ({...panel, number: index + 1}))
        .filter(panel => panel.number >= from)
        .filter(panel => !wanted || panel.name.includes(wanted))
        .filter(panel => !args.includes("--cramped") || crampedCaptions(panel, glossary).length)
        .slice(0, size);

    if (!chosen.length) {
        fail(wanted ? `No event of the table is named like ${JSON.stringify(wanted)}.`
            : `No panels left from ${from} on.`);
    }

    const blocks = chosen.map(panel => {
        const {names, terms} = vocabulary(panel.rows.filter(Boolean));
        const seen = new Set();
        const rows = panel.rows.map(japanese => {
            if (!japanese) {
                return "     |";
            }
            const number = numberOf.get(japanese);
            const english = glossary.get(japanese) ?? "";
            const mine = number && owner.get(japanese) === panel.name && !seen.has(japanese);
            seen.add(japanese);
            const note = !number ? "  (not a caption -- left as it is)"
                : mine ? ""
                : `  (translated with ${owner.get(japanese)})`;
            return `${(mine ? String(number) : "").padStart(5)}| ${japanese}${english ? ` | ${english}` : ""}${note}`;
        });
        return [
            `### ${panel.name}`,
            `${panel.rows.length} of the ${PANEL_ROWS} rows used, ${panel.free} to spare`,
            ...rows,
            ...listed("names:", names),
            ...listed("terms:", terms),
        ].join("\n");
    });

    const askedFor = chosen.flatMap(panel => {
        const seen = new Set();
        return panel.rows.filter(japanese => {
            const mine = japanese && owner.get(japanese) === panel.name && !seen.has(japanese);
            seen.add(japanese);
            return mine;
        });
    });

    const prompt = [
        "Retranslate the captions of these event summary panels in the game Rance 10,",
        "one panel at a time. A panel is one event as the あらすじモード screen draws",
        `it: ${PANEL_ROWS} rows of twenty full-width characters, read together in one glance.`,
        "",
        "Each block below is one panel, in the order the rows are drawn.",
        "",
        "  <number> | <Japanese> | <the English it has now>   a caption to translate",
        "           | <Japanese> | ...  (translated with ...)  a caption another panel owns,",
        "                                                      fixed here, for context only",
        "     empty line with just a bar                       a blank row the designers left",
        "                                                      between two thoughts; it stays",
        "",
        "Answer with one fenced code block and nothing else in it: the number I gave,",
        "a tab, the English. One line for each numbered row, in order, no Japanese, no",
        "commentary. Leave a number out rather than renumbering if you will not do it.",
        "",
        "- About 33 latin characters to a row. A panel with rows to spare can take",
        "  longer captions -- roughly 33 more characters for each row it has free --",
        "  and the build breaks those across two rows itself. Do not break them here,",
        "  and do not pad a caption out to use a row up.",
        "- A caption is a label, not a sentence. No trailing period.",
        "- The rows of a panel are read one after another, so a thought split across",
        "  two of them stays split the same way in English.",
        "- Keep a leading ※ or a leading full-width space exactly where it is.",
        "- Spell a name the way the block gives it. Where the full name will not fit,",
        "  use the short form the game itself displays -- Katyusha for Katyusha Bosch,",
        "  Masamune for Dokuganryuu Masamune -- rather than a spelling of your own.",
        "- Some captions are crude or sexual. Translate them plainly rather than",
        "  softening them; the rest of the screen does.",
        "",
        ...blocks.map(block => block + "\n"),
    ].join("\n");

    await deliver(prompt, `Panels ${chosen[0].number} to ${chosen[chosen.length - 1].number}`
        + ` of ${panels.length}, ${askedFor.length} captions`);
};

/**
 * The flat list: the next phrases with no English at all, whatever panels they
 * belong to. What the first four and a half thousand were translated with, and
 * still the right shape for a handful of new ones after a game update.
 */
const flatBatch = async () => {
    const pending = lines
        .map((line, index) => ({...line, number: index + 1}))
        .filter(line => line.number >= from && !glossary.get(line.japanese))
        .slice(0, size);

    if (!pending.length) {
        console.error(from > 1
            ? `Nothing left untranslated from row ${from} on.`
            : "Every phrase already has English. --panels is the mode for going back over them.");
        process.exit(0);
    }

    const {names, terms} = vocabulary(pending.map(line => line.japanese));

    /**
     * Translating here rather than in a chat wants the opposite of a prompt: no
     * preamble, and the event each phrase belongs to, which is the only context a
     * caption has. ４１／リーザス自力解放４ is what tells you that 「しかし、これを
     * リックが仕留める」 is Rick killing the general two rows above and not some
     * other Rick doing something else.
     */
    if (toStdout) {
        console.log(pending.map(({number, japanese, nodes}) =>
            `${number}\t${nodes[0]}\t${japanese}`).join("\n"));
        console.error(`Rows ${pending[0].number} to ${pending[pending.length - 1].number}`
            + ` of ${lines.length}, ${pending.length} phrases.`
            + ` Write the English to ${path.relative(ROOT, REPLY_FILE)} and merge it.`);
        return;
    }

    const prompt = [
        "Translate these lines into English. They are captions on the event summary",
        "screen of the game Rance 10 -- each one labels a scene, none is a sentence.",
        "",
        "Answer with one fenced code block and nothing else in it: the number I gave,",
        "a tab, the English. Same order, one line each, no Japanese, no commentary.",
        "",
        "- At most 33 characters a line. Shorter is better.",
        "- No trailing period.",
        "- Keep a leading ※ or a leading full-width space exactly where it is.",
        "- Some lines are crude or sexual. Translate them plainly rather than softening",
        "  them. If you will not translate one, leave its number out -- do not renumber.",
        ...listed("- These are names. Spell them exactly this way:", names),
        ...listed("- And these are the words this screen has settled on:", terms),
        "",
        ...pending.map(({number, japanese}) => `${number}\t${japanese}`),
    ].join("\n");

    await deliver(prompt, `Rows ${pending[0].number} to ${pending[pending.length - 1].number}`
        + ` of ${lines.length}, ${pending.length} phrases`);
};

await (panelMode ? panelBatch() : flatBatch());
