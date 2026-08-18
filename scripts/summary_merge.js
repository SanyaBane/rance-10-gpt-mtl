/**
 * Read a chat's answer to scripts/summary_chunk.js back into
 * glossaries/summary_glossary.tsv.
 *
 *   node scripts/summary_merge.js                    # local/summary_reply.txt
 *   node scripts/summary_merge.js somewhere/else.txt
 *   node scripts/summary_merge.js --force            # overwrite what is there
 *   ... | node scripts/summary_merge.js -            # stdin, if you want it
 *
 * Whatever the editor saved it as: a UTF-16 or UTF-8 file from Notepad carries
 * a byte order mark, and reading one as UTF-8 without looking would turn the
 * whole reply into a single unplaceable line, or leave an invisible character
 * in front of the first number.
 *
 * Takes the reply exactly as it comes -- code fence, stray "Here you go:",
 * "12. " instead of "12<TAB>", the Japanese echoed back before the English --
 * and reports every line it could not place rather than guessing. Rows that
 * already carry English are left alone unless --force says otherwise, so
 * re-merging an old reply cannot undo a hand correction.
 *
 * A row is matched by the number, never by position, so a refused or dropped
 * line costs that line and nothing after it.
 *
 * Every phrase of the game's table has English now, so --force is no longer the
 * exception it was: going back over a batch as panels (summary_chunk.js
 * --panels) rewrites rows rather than filling them, and a merge without it
 * applies nothing at all. What --force is there for is that it has to be typed.
 * A rewrite is printed with the English it replaced, since afterwards a hand
 * correction and a machine one look the same in the file and `git diff` is the
 * only other record of which was which.
 */
import * as fs from "fs/promises";
import * as path from "path";
import {ROOT} from "../modules/Env.js";
import {
    REPLY_FILE,
    readSummaryGlossary,
    readSummaryLines,
    reportSummaryGlossary,
    reportSummaryNames,
    writeSummaryGlossary,
} from "../modules/SummaryLines.js";

const JAPANESE = /[぀-ヿ㐀-䶿一-鿿]/;

const readStdin = async () => {
    const chunks = [];
    for await (const chunk of process.stdin) {
        chunks.push(chunk);
    }
    return Buffer.concat(chunks);
};

/** Whichever of the three encodings a Windows editor decided on. */
const decode = (bytes) => {
    if (bytes[0] === 0xff && bytes[1] === 0xfe) {
        return bytes.subarray(2).toString("utf16le");
    }
    if (bytes[0] === 0xfe && bytes[1] === 0xff) {
        return bytes.subarray(2).swap16().toString("utf16le");
    }
    const text = bytes.toString("utf-8");
    return text.startsWith("﻿") ? text.slice(1) : text;
};

const force = process.argv.includes("--force");
const given = process.argv.slice(2).find(arg => !arg.startsWith("--"));
// A path, "-" for stdin, or -- with neither -- the file summary_chunk.js told
// you to save the reply to. Defaulting to stdin instead would mean a run with
// no arguments sitting there reading a terminal nobody is going to type into,
// on whichever console reports itself as a pipe.
const file = !given ? REPLY_FILE : given === "-" ? null : given;
const reply = decode(file ? await fs.readFile(file).catch(error => {
    if (error.code !== "ENOENT") {
        throw error;
    }
    console.error(`No reply at ${path.relative(ROOT, path.resolve(file))}.`
        + " Save the chat's answer there, or pass the path to it.");
    process.exit(1);
}) : await readStdin());

const lines = await readSummaryLines();
const glossary = await readSummaryGlossary();

const applied = [];
const changed = [];
const left = [];
const skipped = [];
for (const line of reply.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith("```")) {
        continue;
    }
    // The number, then whatever the model used to part it from the text.
    const match = line.match(/^\s*(\d+)\s*[\t.):\]-]?\s*(.+)$/);
    const row = match && lines[Number(match[1]) - 1];
    if (!row) {
        skipped.push(`no row of the glossary has that number -- ${JSON.stringify(line)}`);
        continue;
    }
    // A tab inside the English would make a third column nothing reads, and the
    // Japanese echoed back in front of it is the model being helpful.
    let english = match[2].replaceAll("\t", " ").trim();
    if (english.startsWith(row.japanese)) {
        english = english.slice(row.japanese.length).trim();
    }
    if (!english) {
        skipped.push(`nothing but the Japanese back -- ${row.japanese}`);
        continue;
    }
    if (JAPANESE.test(english)) {
        skipped.push(`came back in Japanese -- ${row.japanese} -> ${english}`);
        continue;
    }
    const before = glossary.get(row.japanese);
    if (before === english) {
        continue;
    }
    if (before && !force) {
        left.push(`${row.japanese} -> ${before} (the reply says ${english})`);
        continue;
    }
    glossary.set(row.japanese, english);
    (before ? changed : applied).push(before ? `${row.japanese}\n      was ${before}\n      now ${english}`
        : row.japanese);
}

if (!applied.length && !changed.length) {
    // Every phrase of the table has English now, so a reply that changes
    // nothing is the ordinary outcome of merging one twice -- and a whole batch
    // of rewrites landing on nothing is the outcome of forgetting --force.
    console.error(left.length
        ? `Nothing applied: all ${left.length} rows of the reply are already translated,`
            + " and rewriting one takes --force."
        : skipped.length
            ? `Nothing applied: ${skipped.length} lines of the reply could not be placed.`
            : "Nothing to apply: no line of the reply looked like <number> <english>.");
    for (const complaint of skipped.slice(0, 10)) {
        console.error(`  skipped: ${complaint}`);
    }
    process.exit(1);
}

const written = await writeSummaryGlossary(lines, glossary);

console.log(`Applied ${applied.length} phrases`
    + (changed.length ? `, rewrote ${changed.length}` : "")
    + `; ${reportSummaryGlossary(written, lines).join("\n")}`);
// Every rewrite, spelled out. A hand correction and a machine one look the same
// in the glossary afterwards, and the only record of which was which is this
// and `git diff`.
for (const rewrite of changed) {
    console.log(`  rewrote ${rewrite}`);
}
if (left.length) {
    console.log(`  ${left.length} rows already translated, left alone -- pass --force to take them:`);
    for (const row of left.slice(0, 5)) {
        console.log(`    ${row}`);
    }
}
for (const complaint of skipped) {
    console.log(`  skipped: ${complaint}`);
}
// Last, because there are around 308 of them and nearly every one is a caption
// too narrow for the full name rather than a misspelling.
console.log(reportSummaryNames(written).join("\n"));
