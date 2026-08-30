/**
 * The honorific goes after the whole name, and the whole name is not one word.
 *
 *   node scripts/fix_honorifics_multiword.js            # what it would do
 *   node scripts/fix_honorifics_multiword.js --write    # do it
 *
 * `followed-by-name` is the bucket scripts/fix_honorifics.js refuses on purpose:
 * its pattern matches one capitalised word and the English name is two or three,
 * so firing would write "Thunder-sama Emperor" and "Fiend-sama Warg". Where the
 * name ends is a fact about the sentence, and no rule this repository could
 * write would find it -- 「魔人ワーグ様」 is "Fiend Warg-sama" and 「テラ様」 is
 * "Terra-sama" even though "I'll" is capitalised behind it.
 *
 * So the decisions are carried here, one row apiece, the way
 * scripts/fix_honorifics_untabled.js carries its two names: a table read for
 * this would be a table the pass should have read instead. Each row was looked
 * at, and each carries the Japanese that licenses it -- checked against the
 * speech before anything is written, so a line number that moves stops the pass
 * rather than rewriting whatever now sits at it.
 *
 * **Four of them answered the wrong syllable.** The Japanese stretches the
 * honorific and the English stretched the name, so the pattern matched a word
 * no table could ever hold: 「ミトさまーーー！」 read "Lord Mitoooo",
 * 「アリス様ぁぁあああああ！」 read "Lady Aliceeeeee", and Kaybwan's growled
 * 「ケイブリズさま゛ぁぁ゛ぁ゛〜〜〜！」 read "Lord Kayblissss". The decoration
 * changes place and keeps its length -- three o's become three a's, five e's
 * five, three s's three -- because how long a stretch runs is the translation's
 * own and only where it sits is wrong. Two of the three agree with the Japanese
 * on the count as well; アリス's seven kana against five is left as written.
 *
 * The fourth breaks rather than stretches. A dying Flame Scrivener says
 * 「――ハウ、ゼ……さま、っ……にげ、っ……」, snapping the name in half around the
 * pause, and the English broke it the same way and spelled the first half from
 * the sound: "Lady Hau... zel". ハウゼル is Hawzel in five tables, so the break
 * stays where the Japanese put it and the halves are spelled from the name.
 *
 * **Two of them romanise the title rather than translating it.** 雷帝 is the
 * Thunder Emperor -- glossaries/summary_terms.tsv settles it and the corpus
 * writes it that way on fourteen rows -- so 「雷帝様」 as "Lord Raitei" was in
 * `unknown-name` rather than here only because "Raitei" is one word and no
 * table spells it. The fix is the one this script already makes three rows
 * above. The second of the two is licensed by a slur rather than by the word:
 * a dying Alex Valse says 「らいてい、様……」 in hiragana, in a list where every
 * name is broken the same way -- 「ウス、ピラ……さん」, 「さいあす、さん」 -- so the
 * string that licenses it is the break. Those two names are still romanised on
 * that row and the repair pass cannot reach them either, for the same reason
 * the break gives; a different class, and left.
 *
 * **One of them asks this file's question of the Japanese instead.** A design
 * note in 033813 runs two names together with nothing between them --
 * 「＜＝魔物将軍、イメージ＝ポルポトケイブリス様は」 -- so `mentions` glues the ト of
 * ポルポト to the ケ of ケイブリス and refuses a 様 that is plainly there, which
 * is the katakana-run guard being right about the rule and wrong about the row.
 * Where ポルポト ends and ケイブリス begins is a fact about the sentence in
 * exactly the way "Fiend Warg" is, so it is a row here rather than a loosening
 * of the guard: nothing else in the corpus would survive that loosening.
 *
 * **Three of the twenty-five are not honorifics at all** and are left where they
 * are. 前四天王パパイア・サーバー, 四天王チョチョマン・パブリ and 魔王ランス carry no
 * 様 anywhere near them: "Lord" there is the translation of 四天王 and 魔王, which
 * are ranks. Dropping it is a reading rather than a substitution, and it belongs
 * with the rest of `unpaired`.
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
 * The `japanese` column is the check rather than the reason. Two of them are
 * worth reading twice: 「魔剣カオスさん」 is さん and not 様, which is the only
 * -san in the list and would have been -sama under any rule that assumed the
 * bucket; and 「あ、あ、カチューシャ、さ、ま……」 stutters the honorific itself
 * across two commas, so the string licensing it is the stutter.
 */
const ROWS = [
    {file: "030339.tsv", line: 1191, was: "Lady Teru Mouri", is: "Teru Mouri-sama", japanese: "毛利てる様"},
    {file: "030395.tsv", line: 4876, was: "Lord Toshiba", is: "Toshiba-sama", japanese: "東芝様"},
    {file: "030616.tsv", line: 18767, was: "Lady Katyusha Bosch", is: "Katyusha Bosch-sama", japanese: "カチューシャ、さ、ま"},
    {file: "030616.tsv", line: 18772, was: "Lady Katyusha Bosch", is: "Katyusha Bosch-sama", japanese: "カチューシャさま"},
    {file: "031008.tsv", line: 45365, was: "Lord Raitei", is: "Thunder Emperor-sama", japanese: "雷帝様"},
    {file: "031011.tsv", line: 45623, was: "Lord Thunder Emperor's", is: "Thunder Emperor-sama's", japanese: "雷帝様"},
    {file: "031017.tsv", line: 45965, was: "Lord Thunder Emperor", is: "Thunder Emperor-sama", japanese: "雷帝様"},
    {file: "031081.tsv", line: 49792, was: "Lord Thunder Emperor", is: "Thunder Emperor-sama", japanese: "雷帝様"},
    {file: "031084.tsv", line: 49863, was: "Lord Guan Yu", is: "Guan Yu-sama", japanese: "関羽さま"},
    {file: "031109.tsv", line: 51702, was: "Lady Raitei", is: "Thunder Emperor-sama", japanese: "らいてい、様"},
    {file: "031927.tsv", line: 111496, was: "Lady Terra", is: "Terra-sama", japanese: "テラ様"},
    {file: "032200.tsv", line: 129219, was: "Lady Time Serachrolas", is: "Time Serachrolas-sama", japanese: "時のセラクロラス様"},
    {file: "032200.tsv", line: 129265, was: "Lady Time Serachrolas", is: "Time Serachrolas-sama", japanese: "時のセラクロラス様"},
    {file: "032200.tsv", line: 129275, was: "Lady Time Serachrolas", is: "Time Serachrolas-sama", japanese: "時のセラクロラス様"},
    {file: "032533.tsv", line: 157361, was: "Lord Flame Scrivener", is: "Flame Scrivener-sama", japanese: "火炎書士様"},
    {file: "032670.tsv", line: 168120, was: "Lady Fiend Lexington", is: "Fiend Lexington-sama", japanese: "魔人レキシントン様"},
    {file: "033360.tsv", line: 230910, was: "Lady Lelikov Helman", is: "Lelikov Helman-sama", japanese: "レリコフ様"},
    {file: "033387.tsv", line: 234347, was: "Lord Dogi Magi", is: "Dogi Magi-sama", japanese: "ドギ様"},
    {file: "033387.tsv", line: 234355, was: "Lord Dogi Magi", is: "Dogi Magi-sama", japanese: "ドギ様"},
    {file: "033420.tsv", line: 238815, was: "Lord Demon Sword Chaos", is: "Demon Sword Chaos-sama", japanese: "魔剣カオス様"},
    {file: "033420.tsv", line: 238831, was: "Lord Demon Sword Chaos", is: "Demon Sword Chaos-san", japanese: "魔剣カオスさん"},
    {file: "033503.tsv", line: 247250, was: "Lady Fiend Warg", is: "Fiend Warg-sama", japanese: "魔人ワーグ様"},
    {file: "033503.tsv", line: 247284, was: "Lady Fiend Warg", is: "Fiend Warg-sama", japanese: "魔人ワーグ様"},
    {file: "033666.tsv", line: 251824, was: "Lord Fiend Galtia", is: "Fiend Galtia-sama", japanese: "魔人ガルティア様"},
    {file: "030488.tsv", line: 10245, was: "Lord Mitoooo", is: "Mito-samaaa", japanese: "ミトさまーーー"},
    {file: "030653.tsv", line: 21518, was: "Lady Hau... zel", is: "Haw... zel-sama", japanese: "ハウ、ゼ……さま"},
    {file: "031619.tsv", line: 92053, was: "Lady Aliceeeeee", is: "Alice-samaaaaa", japanese: "アリス様ぁぁ"},
    {file: "032749.tsv", line: 173726, was: "Lord Kayblissss", is: "Kayblis-samaaa", japanese: "ケイブリズさま"},
    {file: "033813.tsv", line: 253075, was: "Lord Kayblis", is: "Kayblis-sama", japanese: "ケイブリス様"},
];

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
            if (bracketsOf(after) !== bracketsOf(row.english) || after.includes("\t")
                || !after.startsWith(row.english.match(/^[\s　]*/)[0])) {
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
