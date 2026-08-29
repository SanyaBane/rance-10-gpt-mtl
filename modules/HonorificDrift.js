/**
 * Whether a "Lord X" in the English is an honorific the Japanese wrote.
 *
 *   node scripts/find_honorific_drift.js                    # the report
 *   node scripts/fix_honorifics.js --bucket=sama --write    # what it showed
 *
 * The rest of this patch writes -sama 3592 times and modules/ScenePrompt.js
 * tells a translator to keep it, but en_grok was translated a line at a time
 * with no speaker and no scene around it, and 1447 of its speeches answered
 * somebody's 様 with "Lord" or "Lady" instead. This is the question that
 * separates the ones the Japanese already decides from the ones a person has to.
 *
 * **The question is asked of the speech and answered on the row.** A speech is
 * where the Japanese lives -- the 様 can sit in a row other than the one
 * carrying the English name, because the two languages break lines in different
 * places -- and a row is what gets written, because re-laying-out a speech to
 * change five characters rewrites what is not broken. An occurrence no single
 * row holds is reported and never fixed: that is the wrapped-name class that
 * hides a name from every substitution pass, and the report counts it rather
 * than reaching for it.
 *
 * **Nothing here decides a name.** `<name>様` in the Japanese, `Lord <name>` in
 * the English, and the two names paired by glossaries/mistranslated_names.json:
 * three facts already written down, and a bucket for every occurrence where one
 * of them is missing. What the report cannot pair it says so about rather than
 * guessing, which is the whole difference between a pass that can be reviewed
 * and one that cannot.
 */
import * as fs from "fs/promises";
import * as path from "path";
import {mentions, readNameTable} from "./NameNormalizer.js";
import {CARD_GLOSSARY} from "./Nameplates.js";
import {parseSceneFile, speechesOf} from "./SceneFile.js";
import {translatedScenesDir} from "./SceneTranslations.js";
import {textLangDir} from "./TextLanguages.js";

/**
 * "Lord Kayblis", "Lady Reset's" -- the title, the name, the possessive.
 *
 * The possessive is part of the match because it is part of the answer:
 * "Lady Hawzel's Demonic Blood Soul" wants "Hawzel-sama's", and a pattern that
 * stopped at the apostrophe would look the name up as "Hawzel's", find no table
 * holding it, and file every possessive in the corpus as an unknown name.
 */
const ADDRESS = /\b(Lord|Lady)\s+([A-Z][A-Za-z]*)(['’]s|['’])?/g;

/**
 * Words that make "Lord" the tail of a longer title rather than an honorific.
 *
 * None of them stands in front of a paired name today, and that is not luck:
 * 魔王 carries no 様, so "Demon Lord Kayblis" fails the Japanese test on its
 * own. The list is here because the test is asked of the whole speech, and a
 * speech that says ケイブリス様 in its second sentence would otherwise licence
 * "Demon Kayblis-sama" in its first.
 */
const TITLE_WORDS = new Set([
    "Demon", "Fiend", "Great", "Grand", "Dark", "High", "Holy", "Young", "Old",
    "War", "Sea", "Over", "Dread", "Sky", "Under", "First", "Second", "Third",
]);

/** Every bucket the report files an occurrence under; only "sama" is fixable. */
export const BUCKETS = [
    "sama", "dono", "unpaired", "unknown-name", "title-word", "followed-by-name",
    "already", "wrapped",
];

/** The two the Japanese decides on its own; the rest are for a person to read. */
export const FIXABLE = ["sama", "already"];

/**
 * The English name back to the Japanese it spells.
 *
 * Two tables, in the order that settles a disagreement: mistranslated_names.json
 * is canonical and card_name_glossary.tsv fills in what it does not carry --
 * which is 215 of the 320 occurrences the canonical table alone files as a name
 * nobody has settled.
 *
 * A multi-word English name is skipped rather than split: the honorific goes
 * after the whole name and the two languages do not agree on which half comes
 * first, so 毛利てる様 as "Lady Teru Mouri" is a decision and not a substitution.
 */
export const readNameIndex = async (lang) => {
    const byEnglish = new Map();
    const add = (english, japanese) => {
        if (!/^[A-Z][A-Za-z]*$/.test(english)) {
            return;
        }
        byEnglish.set(english, [...byEnglish.get(english) ?? [], japanese]);
    };
    for (const record of await readNameTable(textLangDir(lang))) {
        add(record.shortNameEng, record.shortNameJpn);
    }
    for (const line of (await fs.readFile(CARD_GLOSSARY, "utf-8")).split(/\r?\n/)) {
        if (!line || line.startsWith("#")) {
            continue;
        }
        const [japanese, english] = line.split("\t");
        if (japanese && english) {
            add(english, japanese);
        }
    }
    return {byEnglish};
};

/** Whether the Japanese calls this name with this suffix, katakana-run aware. */
const calls = (japanese, names, suffix) =>
    names.some(name => mentions(japanese, name + suffix));

const classify = (speech, row, match, index, {byEnglish}) => {
    const [whole, title, name, possessive = ""] = match;
    const trailing = row.english.slice(index + whole.length);
    // A single space and nothing else: "Demon Lord Kayblis" is a compound title
    // and "Fiend... Lord Lei" is two sentences, and a look-back that steps over
    // the punctuation between them cannot tell those apart. It withheld four
    // fixes out of five before it was pinned to the adjacent word.
    const preceding = row.english.slice(0, index).match(/([A-Za-z]+) $/)?.[1];
    const finding = {
        lineNumber: row.lineNumber,
        speaker: speech.speaker,
        title,
        name,
        possessive,
        index,
        length: whole.length,
        before: whole,
        after: `${name}-sama${possessive}`,
        japanese: speech.japanese,
        english: row.english,
    };
    // "Lord Lis-sama" is the honorific twice over, so the fix is dropping the
    // title rather than adding what is already there.
    if (/^-(?:sama|san|dono|chan|kun)\b/.test(trailing)) {
        return {...finding, bucket: "already", after: `${name}${possessive}`};
    }
    if (preceding && TITLE_WORDS.has(preceding)) {
        return {...finding, bucket: "title-word"};
    }
    // Any capitalised word after the name, known to a table or not. 毛利てる様 is
    // "Lady Teru Mouri" here, and the honorific belongs after the surname the
    // English puts second -- which is a fact about the two name orders and not
    // one this can work out. Whether the follower is a name a table holds is
    // the wrong question: "Mouri" is in neither, and it is the one that matters.
    const follower = !possessive && trailing.match(/^\s+([A-Z][A-Za-z]*)/)?.[1];
    if (follower) {
        return {...finding, bucket: "followed-by-name"};
    }
    const names = byEnglish.get(name);
    if (!names) {
        return {...finding, bucket: "unknown-name"};
    }
    const japaneseName = names.join("/");
    if (calls(speech.japanese, names, "様") || calls(speech.japanese, names, "さま")) {
        return {...finding, bucket: "sama", japaneseName};
    }
    if (calls(speech.japanese, names, "殿")) {
        return {...finding, bucket: "dono", japaneseName};
    }
    return {...finding, bucket: "unpaired", japaneseName};
};

/**
 * Every "Lord"/"Lady" in a text language's scenes, filed under what the
 * Japanese of its own speech says about it.
 *
 * @param {string} lang
 * @return {Promise<{findings: object[], files: number}>}
 */
export const findHonorificDrift = async (lang) => {
    const dir = translatedScenesDir(lang);
    const index = await readNameIndex(lang);
    const files = (await fs.readdir(dir)).filter(name => name.endsWith(".tsv"));
    const findings = [];
    for (const file of files) {
        const scene = parseSceneFile(await fs.readFile(path.join(dir, file), "utf-8"));
        const rows = new Map(scene.rows.map(row => [row.lineNumber, row]));
        for (const speech of speechesOf(scene)) {
            if (!/\b(?:Lord|Lady)\b/.test(speech.english)) {
                continue;
            }
            let held = 0;
            for (const number of speech.rows) {
                const row = rows.get(number);
                for (const match of row.english.matchAll(ADDRESS)) {
                    held++;
                    findings.push({
                        ...classify(speech, row, match, match.index, index),
                        file,
                        functionId: scene.functionId,
                    });
                }
            }
            const whole = [...speech.english.matchAll(ADDRESS)].length;
            if (whole > held) {
                findings.push({
                    bucket: "wrapped",
                    file,
                    functionId: scene.functionId,
                    lineNumber: speech.lineNumber,
                    speaker: speech.speaker,
                    count: whole - held,
                    japanese: speech.japanese,
                    english: speech.english,
                });
            }
        }
    }
    return {findings, files: files.length};
};

/**
 * The row a finding's fix produces, with nothing else about the row moved.
 *
 * Several fixes can land on one row -- 「ケイブリス様、ケイブリス様！」 is two --
 * so they are spliced from the end backwards, which is what keeps every index
 * the report measured pointing at the character it was measured against.
 */
export const rewriteRow = (english, fixes) => {
    let text = english;
    for (const fix of [...fixes].sort((a, b) => b.index - a.index)) {
        if (text.slice(fix.index, fix.index + fix.length) !== fix.before) {
            throw new Error(`row ${fix.lineNumber}: ${JSON.stringify(fix.before)} is not at ${fix.index}`);
        }
        text = text.slice(0, fix.index) + fix.after + text.slice(fix.index + fix.length);
    }
    return text;
};

/** The quotes and parentheses of a row, in the order they are written. */
const bracketsOf = (text) =>
    [...text].filter(character => "「」『』（）〈〉《》()".includes(character)).join("");

/**
 * What has to be true of a rewritten row before it is worth writing.
 *
 * Every one of these is about the row rather than about the rule that made the
 * edit, because the rule is the thing being checked. The length is arithmetic
 * over the substitutions, so a stray character anywhere else in the row fails
 * it; the brackets are compared **in order** rather than counted, because 「」
 * and 」「 hold the same two characters and only one of them is a speech; and
 * the leading whitespace is compared as bytes, because the continuation indent
 * is a full-width space that belongs to the row and a tab is what the scene
 * format escapes on purpose.
 */
export const holds = (before, after, fixes) => {
    const grown = fixes.reduce((sum, fix) => sum + fix.after.length - fix.before.length, 0);
    const titles = (text) => (text.match(/\b(?:Lord|Lady)\b/g) ?? []).length;
    return after.length === before.length + grown
        && titles(after) === titles(before) - fixes.length
        && !after.includes("-sama-sama")
        && !after.includes("\t")
        && after.startsWith(before.match(/^[\s　]*/)[0])
        && bracketsOf(after) === bracketsOf(before)
        && fixes.every(fix => after.includes(fix.after));
};
