/**
 * The same word is a name and a common noun, so no table can hold it.
 *
 *   node scripts/fix_honorifics_ambiguous.js            # what it would do
 *   node scripts/fix_honorifics_ambiguous.js --write    # do it
 *
 * リス is a squirrel. It is also the back half of ケイブリス, and it is what
 * Kaybwan and Kaybnyan call him: 「ケイブ、リス様……？」 breaks the name at that
 * seam three times in the corpus. Both readings are live in the same scenes --
 * ケイブリス was a squirrel before he was a Fiend, so 「小さく弱いリスだった頃の
 * 自分」 is the animal and 「リス様の使徒にゃん」 is the person, and Rance's
 * 「リス野郎」 is the animal used as an insult for the person.
 *
 * **So there is no row to write.** A glossaries/mistranslated_names.json entry
 * for リス would make `mentions` true on some thirty rows the corpus rightly
 * renders "squirrel", and the name check would report every one of them --
 * which is the 魔人-listing-"demon" trap docs/baked-name-repairs.md names,
 * arriving from the other side. `readNameIndex` therefore cannot pair the
 * address, and the five titled occurrences sat in `unknown-name` with no table
 * that could ever free them.
 *
 * What decides each one is its own sentence, so each row is carried here with
 * the Japanese that licenses it, the way scripts/fix_honorifics_multiword.js
 * carries where a name ends. The check runs against the speech before anything
 * is written, so a line number that moves stops the pass instead of rewriting
 * whatever now sits at it.
 *
 * **One of the five is a reading and not only a title.** 030855 m[34878] is
 * 「うーっ、大変にゃ、大変にゃあ……！リス様ーーーーーーー！」 -- Kaybnyan calling
 * for her master -- and it came back "Lord Squirrel". The four rows around it
 * in the same run of scenes already say Lis, so the name is decided by its own
 * neighbours rather than by this pass.
 *
 * **The form is left alone, and the drift is somebody else's.** The corpus
 * answers the address リス様 nine ways over thirty rows -- Ris-sama 7,
 * Lis-sama 6, Risu-sama 6, Master 3, and one apiece of Cavebris-sama and
 * Kayblis-sama besides the titles here. Deciding among those is a
 * scripts/find_term_drift.js question about a name rather than an honorific
 * question, so this writes the form the row already carries.
 *
 * **The sixth row is that rule proving it means what it says.** Kaybwan's
 * 「ニャンもリス様、嫌いになっちゃったの？」 reads "hates Lord Kayblis now?" -- the same
 * address as the five above and the other end of the name in the English, and
 * the corpus already writes Kayblis-sama for リス様 once elsewhere. Writing
 * Lis-sama here to match its neighbours would be deciding the drift under
 * cover of an honorific pass, which is the one thing this file does not do.
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
 * リス様 rather than リス in the licence column, and checked with nothing
 * katakana in front of it, because ケイブリス様 holds リス様 and the check has
 * to be able to tell those apart -- which is the question `mentions` asks and
 * the one the report asked before it filed these five.
 */
const ROWS = [
    {file: "030855.tsv", line: 34878, was: "Lord Squirrel", is: "Lis-sama", japanese: "リス様"},
    {file: "030857.tsv", line: 35189, was: "Lord Lis", is: "Lis-sama", japanese: "リス様"},
    {file: "030862.tsv", line: 35536, was: "Lord Lis", is: "Lis-sama", japanese: "リス様"},
    {file: "030863.tsv", line: 35568, was: "Lord Lis", is: "Lis-sama", japanese: "リス様"},
    {file: "030863.tsv", line: 35571, was: "Lord Lis's", is: "Lis-sama's", japanese: "リス様"},
    {file: "032749.tsv", line: 173713, was: "Lord Kayblis", is: "Kayblis-sama", japanese: "リス様"},
];

/** The quotes and parentheses of a row, in the order they are written. */
const bracketsOf = (text) =>
    [...text].filter(character => "「」『』〈〉《》（）()".includes(character)).join("");

/** Whether the speech says the word with no katakana glued to the front of it. */
const saysAlone = (japanese, word) => {
    for (let at = japanese.indexOf(word); at >= 0; at = japanese.indexOf(word, at + 1)) {
        if (!/[゠-ヿ]/.test(japanese[at - 1] ?? "")) {
            return true;
        }
    }
    return false;
};

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
            if (!saysAlone(speech.japanese, japanese)) {
                refused.push(`${at} -- its speech does not say ${JSON.stringify(japanese)} on its own`);
                continue;
            }
            const occurrences = row.english.split(was).length - 1;
            if (occurrences !== 1) {
                refused.push(`${at} -- ${JSON.stringify(was)} appears ${occurrences} times, not once`);
                continue;
            }
            const after = row.english.replace(was, is);
            const titled = (text) => /\b(?:Lord|Lady)\b/.test(text);
            if (bracketsOf(after) !== bracketsOf(row.english) || after.includes("\t")
                || !after.startsWith(row.english.match(/^[\s　]*/)[0])
                || (titled(after) && !titled(row.english.replace(was, "")))) {
                refused.push(`${at} -- the rewritten row does not verify`);
                continue;
            }
            english.set(line, after);
        }

        // Whether any speech this touched went over the window it fitted before.
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
