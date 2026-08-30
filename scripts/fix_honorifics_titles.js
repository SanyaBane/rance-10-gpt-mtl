/**
 * The honorific is a title, so English gets the word rather than the suffix.
 *
 *   node scripts/fix_honorifics_titles.js            # what it would do
 *   node scripts/fix_honorifics_titles.js --write    # do it
 *
 * `unpaired` means the speech carries no honorific at all, and reading all 48
 * of it found that only five did. Seventeen were a 様 the pairing could not
 * see and are closed elsewhere; the rest carry a *different* honorific, and
 * that half splits again. さん and はん are particles English keeps, so they are
 * a bucket and a sweep -- `modules/HonorificDrift.js`. 閣下, 主君, 女史, 嬢 and
 * 女王 are words English translates, and every one of them is a decision that a
 * substitution rule would get wrong. They are here, one row apiece with the
 * Japanese that licenses each.
 *
 * **女王 and 嬢 the corpus had already settled**, and only these rows disagreed.
 * リア女王 is "Queen Lia" on 41 speeches and 031667 m[95794] was the one "Lady
 * Lia"; リセット嬢 is Pespo Tontone's, and Pespo writes "Miss Eleanor" and "Miss
 * Copandon" himself two scenes later.
 *
 * **女史 nothing had settled** -- マルチナ女史 is the only 女史 in the corpus and
 * both of its speeches are these. It is the formal title for an accomplished
 * woman rather than a mark of rank, so "Ms." is the word and "Lady" was reading
 * a noblewoman into a compliment about her cooking.
 *
 * **閣下 is five of eight, and the three left out are the point.** The corpus
 * renders 閣下 by what stands in front of it: after a rank it is absorbed
 * (総統閣下 is "Supreme Leader" 275 times, 大将軍閣下 is "Great General"), alone
 * it is "Your Excellency" 50 times, and after a *name* it drifts four ways --
 * "General Pizarro" three times, "His Excellency Pizarro" once, "General
 * Zedong" once, against "Lord ‹Name›" eight. Two of those eight contradict
 * themselves inside one line: 「閣下！　ツォトン閣下！」 read "Your Excellency!
 * Lord Zedong!", the same word twice, rendered two ways.
 *
 * So the five whose man is a general read "General ‹Name›", which is what the
 * corpus already calls Pizarro and Zedong when it is not calling them Lord.
 * The other three are not generals and no rendering here would be a
 * substitution: コルドバ閣下's own sentence already says "Blue General of
 * Leazas", ランス閣下 is 総統 and reads "Supreme Leader Rance" elsewhere, and
 * ケイブリス閣下 is a Fiend whom the rest of the corpus calls Kayblis-sama.
 * Those three are `scripts/find_term_drift.js`'s question about 閣下, not this
 * pass's about a title standing where an honorific was.
 *
 * 主君 is left whole and is not in this file at all: it *means* one's lord, so
 * "Lord Zance" already translates the word rather than replacing it, and the
 * seven rows are not drift. docs/honorifics.md carries the reasoning.
 */
import * as fs from "fs/promises";
import * as path from "path";
import {hasFlag} from "../modules/Argv.js";
import {run} from "../modules/AliceTools.js";
import {parseSceneFile, renderSceneFile, speechesOf} from "../modules/SceneFile.js";
import {translatedScenesDir} from "../modules/SceneTranslations.js";
import {drawnLines, rowBudget} from "../modules/SpeechRows.js";
import {textLangName} from "../modules/TextLanguages.js";

/**
 * One row apiece: where it is, what it says, what it should say, and the
 * Japanese of its own speech that decides it.
 *
 * The `japanese` column is the titled address itself rather than the bare name,
 * because what licenses "Queen Lia" on this row is that this speech says
 * リア女王 -- リア alone is said all over the corpus and decides nothing.
 */
const ROWS = [
    {file: "030510.tsv", line: 12064, was: "Lady Martina's", is: "Ms. Martina's", japanese: "マルチナ女史"},
    {file: "030510.tsv", line: 12070, was: "Lady Martina's", is: "Ms. Martina's", japanese: "マルチナ女史"},
    {file: "030635.tsv", line: 20047, was: "Lady Reset", is: "Miss Reset", japanese: "リセット嬢"},
    {file: "030670.tsv", line: 23981, was: "Lord LeMay", is: "General LeMay", japanese: "ルメイ閣下"},
    {file: "031111.tsv", line: 52088, was: "Lord Zedong", is: "General Zedong", japanese: "ツォトン閣下"},
    {file: "031111.tsv", line: 52115, was: "Lord Zedong", is: "General Zedong", japanese: "ツォトン閣下"},
    {file: "031323.tsv", line: 66831, was: "Lord Pizarro", is: "General Pizarro", japanese: "ピサロ閣下"},
    {file: "031349.tsv", line: 68774, was: "Lord Pizarro", is: "General Pizarro", japanese: "ピサロ閣下"},
    {file: "031667.tsv", line: 95794, was: "Lady Lia", is: "Queen Lia", japanese: "リア女王"},
];

/** The quotes and parentheses of a row, in the order they are written. */
const bracketsOf = (text) =>
    [...text].filter(character => "「」『』（）〈〉《》()".includes(character)).join("");

await run(async () => {
    const write = hasFlag("write");
    const dir = translatedScenesDir(textLangName());
    const byFile = new Map();
    for (const row of ROWS) {
        byFile.set(row.file, [...byFile.get(row.file) ?? [], row]);
    }

    let written = 0;
    const refused = [];

    for (const [file, wanted] of byFile) {
        const on = path.join(dir, file);
        const text = await fs.readFile(on, "utf-8");
        const scene = parseSceneFile(text);
        if (renderSceneFile(scene) !== text) {
            refused.push(`${file} -- the file does not reproduce itself`);
            continue;
        }
        const rows = new Map(scene.rows.map(row => [row.lineNumber, row]));
        const speeches = speechesOf(scene);
        const english = new Map();

        for (const {line, was, is, japanese} of wanted) {
            const at = `${file} m[${line}]`;
            const row = rows.get(line);
            if (!row) {
                refused.push(`${at} -- no such row`);
                continue;
            }
            const speech = speeches.find(one => one.rows.includes(line));
            if (!speech.japanese.includes(japanese)) {
                refused.push(`${at} -- its speech does not say ${JSON.stringify(japanese)}`);
                continue;
            }
            const occurrences = row.english.split(was).length - 1;
            if (occurrences !== 1) {
                refused.push(`${at} -- ${JSON.stringify(was)} appears ${occurrences} times, not once`);
                continue;
            }
            const after = row.english.replace(was, is);
            // Exactly this one title goes and every other stays: 「ピサロ閣下！
            // 大将軍閣下！」 hails two officers and only one of them is named.
            const titles = (one) => (one.match(/\b(?:Lord|Lady)\b/g) ?? []).length;
            if (bracketsOf(after) !== bracketsOf(row.english) || after.includes("\t")
                || !after.startsWith(row.english.match(/^[\s　]*/)[0])
                || titles(after) !== titles(row.english) - 1) {
                refused.push(`${at} -- the rewritten row does not verify`);
                continue;
            }
            english.set(line, after);
        }

        // Whether any speech this touched went over the window it fitted before.
        // Worth asking here more than anywhere else in this pass: "General " is
        // three characters longer than "Lord " rather than shorter.
        for (const speech of speeches) {
            if (!speech.rows.some(number => english.has(number))) {
                continue;
            }
            const before = speech.rows.map(number => rows.get(number).english);
            const now = speech.rows.map(number => english.get(number) ?? rows.get(number).english);
            const budget = rowBudget(speech.rows.length);
            if (drawnLines(before) <= budget && drawnLines(now) > budget) {
                for (const number of speech.rows) {
                    english.delete(number);
                }
                refused.push(`${file} m[${speech.lineNumber}] -- the speech fitted the window and would not after`);
            }
        }

        for (const [line, after] of english) {
            console.log(`${file} m[${line}]`);
            console.log(`    ${JSON.stringify(rows.get(line).english)}`);
            console.log(` -> ${JSON.stringify(after)}`);
            written++;
        }
        if (english.size && write) {
            await fs.writeFile(on, renderSceneFile(scene, english), "utf-8");
        }
    }

    console.log(`\n${written} of ${ROWS.length} rows${write ? " written" : " ready"}`);
    if (refused.length) {
        console.log(`\n${refused.length} refused:`);
        for (const one of refused) {
            console.log(`  ${one}`);
        }
    }
    if (!write) {
        console.log(`\nNothing written. Add --write.`);
    }
    return 0;
});
