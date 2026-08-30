/**
 * The names the honorific pass could not see, and why each was invisible.
 *
 *   node scripts/fix_honorifics_untabled.js            # what it would do
 *   node scripts/fix_honorifics_untabled.js --write    # do it
 *
 * scripts/fix_honorifics.js pairs an English name to its Japanese through
 * glossaries/mistranslated_names.json and glossaries/card_name_glossary.tsv,
 * and files everything it cannot pair under `unknown-name` rather than
 * guessing. Four of those are not guesses at all, for three reasons:
 *
 * **パイアール is Pi-R**, and the hyphen is the whole reason it was missed:
 * `readNameIndex` admits a name matching `/^[A-Z][A-Za-z]*$/` and the ADDRESS
 * pattern matches the same shape, so "Lord Pi-R" was read as a name called
 * "Pi" that no table holds.
 *
 * **メディウサ is Medusa**, and it has no short-name row in either table --
 * only `メディウサメダル → Medusa Medallion`, which is a medal. The name is
 * spelled out in glossaries/character_genders.md and in
 * glossaries/enemy_party_glossary.tsv as `魔人メディウサ → Fiend Medusa`, so it
 * is settled; it is just settled somewhere the pass does not read.
 *
 * **香 is Kou and 香姫 is Kouhime**, and the two languages cross them. Neither
 * name is missing -- glossaries/mistranslated_names.json holds `Kou | 香` and
 * `Kouhime | 香姫` -- so what is missing is the pairing: these speeches say
 * 香様 and answer it "Lady Kouhime", or say 香姫様 and answer it "Lady Kou".
 * The index looks the English up, gets the other form's Japanese, and files
 * all 14 under `unpaired`, which means "the speech carries no honorific at
 * all" and here was never true of one of them.
 *
 * **モドカタ is Modokata**, and the table spells it in katakana while the one
 * speech that bows to him is in hiragana throughout. Mud Princess Byranrose
 * sings 「わたしのだんなさまのもどかたさまが♪」, with no kanji and no katakana in
 * the whole line, so `readNameIndex` looked up モドカタ, found none, and filed
 * "Lord Modokata" as a speech carrying no honorific. もどかた is one speech in
 * the corpus and this is it, so the pair reaches exactly the row it was written
 * for; the sixteen モドカタ speeches all render the name plain and carry no
 * title for it to touch.
 *
 * **The name form is left exactly where it is.** 香様 reads "Kou-sama" 25
 * times elsewhere in the corpus and 香姫様 reads "Kouhime-sama" 11, so these 14
 * disagree about which of the two forms to use as well -- and that is a
 * finding for scripts/find_term_drift.js rather than for this, which has never
 * done anything but drop the title and write the honorific after the name the
 * row already carries.
 *
 * Leaving them cost more than a missing substitution. Four rows name two
 * characters who both carry 様 in the same sentence, and only one of them came
 * out with the honorific: 「レイ様、パイアール様！」 reads "Lei-sama, Lord Pi-R!"
 * and 「メディウサ様がここを襲ってデスココ様を殺して」 reads "Lady Medusa
 * attacked here, killed Descoco-sama". **A pass that converts half of one
 * sentence is worse than one that converts neither**, which is why this closes
 * the two names rather than only the four rows where the split shows.
 *
 * The rule is the one fix_honorifics.js uses, for the same reasons: the
 * question is asked of the **speech**, because the two languages break lines in
 * different places and the 様 can sit in a row other than the one carrying the
 * English name; the answer is written to the **row**, because re-laying-out a
 * speech to change five characters rewrites what is not broken. "Lord " is 155
 * units of the message window's 1194 and "-sama" is 166.75, so a row that
 * fitted before still fits.
 */
import * as fs from "fs/promises";
import * as path from "path";
import {hasFlag} from "../modules/Argv.js";
import {run} from "../modules/AliceTools.js";
import {parseSceneFile, renderSceneFile, speechesOf} from "../modules/SceneFile.js";
import {translatedScenesDir} from "../modules/SceneTranslations.js";
import {textLangName} from "../modules/TextLanguages.js";

/**
 * English name to Japanese, for the pairings `readNameIndex` cannot make.
 *
 * None of them is a reading. Pi-R and Medusa are written down in
 * glossaries/character_genders.md -- at パイアール and メディウサ -- and again in
 * glossaries/enemy_party_glossary.tsv as 魔人パイアール and 魔人メディウサ. The
 * other two are in glossaries/mistranslated_names.json already and are here the
 * other way round, because that is the way round these speeches use them.
 *
 * 香 is one common kanji, so the Japanese half of the guard is the weak half:
 * what keeps the pair honest is the English half, which matches the whole name
 * and refuses a longer one, so `Lady Kou` cannot match "Lady Kouhime". The
 * corpus has no 志津香様 for the other end to be wrong about, and nothing here
 * depends on that staying true.
 */
const PAIRS = [
    {english: "Pi-R", japanese: "パイアール"},
    {english: "Medusa", japanese: "メディウサ"},
    {english: "Kouhime", japanese: "香"},
    {english: "Kou", japanese: "香姫"},
    {english: "Modokata", japanese: "もどかた"},
];

const escapeForRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&");

/**
 * "Lord Pi-R", "Lady Medusa" -- the title and this one whole name.
 *
 * Anchored on the entire name rather than on `[A-Z][A-Za-z]*`, which is the
 * pattern that could not see the hyphen in the first place, and closed with a
 * negative lookahead so that a longer name starting with this one cannot match.
 * Built fresh per call, because a `g` regex carries `lastIndex` between uses
 * and a shared one would skip rows depending on what the previous row matched.
 */
const addressOf = (name) =>
    new RegExp(`\\b(?:Lord|Lady)\\s+${escapeForRegExp(name)}(?![A-Za-z])`, "g");

/** The quotes and parentheses of a row, in the order they are written. */
const bracketsOf = (text) =>
    [...text].filter(character => "「」『』（）〈〉《》()".includes(character)).join("");

/**
 * What has to be true of the rewritten row, asked of the row rather than of
 * the rule that made it.
 *
 * The length is the arithmetic of the substitutions, so a stray character
 * anywhere else in the row fails it; the brackets are compared **in order**,
 * because 「」 and 」「 hold the same two characters and only one of them is a
 * speech; the leading whitespace is compared as bytes, because the
 * continuation indent is a full-width space that belongs to the row and a tab
 * is what the scene format escapes on purpose.
 */
const holds = (before, after, name, hits) => {
    const grown = hits * (`${name}-sama`.length - `Lord ${name}`.length);
    return after.length === before.length + grown
        && addressOf(name).test(after) === false
        && !after.includes("-sama-sama")
        && !after.includes("\t")
        && after.startsWith(before.match(/^[\s　]*/)[0])
        && bracketsOf(after) === bracketsOf(before);
};

await run(async () => {
    const write = hasFlag("write");
    const dir = translatedScenesDir(textLangName());
    const files = (await fs.readdir(dir)).filter(name => name.endsWith(".tsv"));

    let rowsWritten = 0;
    let occurrences = 0;
    let filesWritten = 0;
    const rowsLeft = [];
    const filesLeft = [];

    for (const file of files) {
        const on = path.join(dir, file);
        const text = await fs.readFile(on, "utf-8");
        const scene = parseSceneFile(text);
        if (renderSceneFile(scene) !== text) {
            filesLeft.push(file);
            continue;
        }
        const rows = new Map(scene.rows.map(row => [row.lineNumber, row]));
        const english = new Map();

        for (const speech of speechesOf(scene)) {
            for (const {english: name, japanese} of PAIRS) {
                if (!speech.japanese.includes(`${japanese}様`)
                    && !speech.japanese.includes(`${japanese}さま`)) {
                    continue;
                }
                for (const number of speech.rows) {
                    const before = english.get(number) ?? rows.get(number).english;
                    const hits = [...before.matchAll(addressOf(name))].length;
                    if (!hits) {
                        continue;
                    }
                    const after = before.replace(addressOf(name), `${name}-sama`);
                    if (!holds(before, after, name, hits)) {
                        rowsLeft.push(`${file} m[${number}]`);
                        continue;
                    }
                    console.log(`  ${file} m[${number}]`);
                    console.log(`    JP ${rows.get(number).japanese.trim()}`);
                    console.log(`    -  ${before.trim()}`);
                    console.log(`    +  ${after.trim()}`);
                    if (!english.has(number)) {
                        rowsWritten++;
                    }
                    english.set(number, after);
                    occurrences += hits;
                }
            }
        }

        if (!english.size) {
            continue;
        }
        filesWritten++;
        if (write) {
            await fs.writeFile(on, renderSceneFile(scene, english), "utf-8");
        }
    }

    console.log(`\n${occurrences} occurrences${write ? " written" : " ready"}`
        + `, on ${rowsWritten} rows in ${filesWritten} scenes`);
    if (rowsLeft.length) {
        console.log(`\n${rowsLeft.length} rows left alone -- the fix did not verify:`);
        for (const row of rowsLeft) {
            console.log(`  ${row}`);
        }
    }
    if (filesLeft.length) {
        console.log(`\n${filesLeft.length} scenes left alone -- the file does not reproduce itself:`);
        for (const file of filesLeft) {
            console.log(`  ${file}`);
        }
    }
    if (!write) {
        console.log(`\nNothing written. Add --write.`);
    }
    return 0;
});
