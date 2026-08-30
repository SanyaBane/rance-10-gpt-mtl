/**
 * The Japanese broke the address, and the English moved the break.
 *
 *   node scripts/fix_honorifics_broken.js            # what it would do
 *   node scripts/fix_honorifics_broken.js --write    # do it
 *
 * A frightened, dying or aroused character does not say a name and its
 * honorific in one breath: 「魔人……カミーラ、様」, 「あ、あ、アム、様……」,
 * 「リアさ、ま……」, 「ヨシフ、さま……」, 「ケイブリス、様？」. The comma is the
 * Japanese's own and the 様 still belongs to the name in front of it, so these
 * are not speeches that carry no honorific -- which is what `unpaired` means,
 * and where five of them sat.
 *
 * **The pairing was not widened to see them, and the measurement is why.**
 * Stepping over the pause marks between a name and a 様 finds 66 places in the
 * corpus, and two of them are 「かなみ、様子はどうだ？」 and 「シィル、様子を見て
 * こい」 -- 様子 is "the situation" and the rule would have answered both with an
 * honorific nobody said. A rule wide enough to reach these is wide enough to
 * invent two, and it still misses 「リアさ、ま」, where the break is inside the
 * honorific rather than in front of it. So the eight decisions are carried
 * here, one row apiece with the Japanese that licenses it, the way
 * scripts/fix_honorifics_multiword.js carries where a name ends.
 *
 * **Three of the eight are in no bucket at all**, and finding them is the
 * reason this class is worth a script rather than five more rows somewhere
 * else. `ADDRESS` in modules/HonorificDrift.js joins the title to the name with
 * `\s+`, so a row that copied the Japanese's pause into the English -- and put
 * it in the wrong place, between the title and the name instead of between the
 * name and the honorific -- is invisible to the whole report:
 *
 *     JP 「っ、え、ぁ…………ガンジー、様……」   EN 「Ah, e-erm...... Lord... Gandhi......」
 *     JP 「あ、ケッセルリンク……様」            EN 「Ah, Lord... Kesselring.」
 *     JP 「よろしくお願いします。ケイブリス、様？」 EN 「Please treat me well. Lord... Kayblis?」
 *
 * `ADDRESS` was not widened for those either, and this time the cost would have
 * landed in the patch rather than in the report. Allowing dots between the
 * title and the name adds five matches to the corpus, three of them these and
 * two of them noise -- and one piece of that noise is 「元四天王……パパイア様だ」
 * as "a former Lord...... Papaya-sama", where "Lord" is 四天王 and the name
 * already carries its honorific. The trailing `-sama` would file it under
 * `already`, whose sweep drops the title, and 元四天王 would have lost its rank
 * to a pass nobody would think to check. **A widening that reaches a fixable
 * bucket has to be measured against that bucket, not against the report.**
 *
 * What each row becomes is the corpus's own answer where it has one. 030519
 * m[12682] renders these same words -- 「ガンジー、様……」 -- as "Gandhi-sama......",
 * and 「リアさ、ま」 is written whole rather than broken because
 * 「あ、あ、カチューシャ、さ、ま……」 already is, in fix_honorifics_multiword.js.
 * The pause the English holds is the pause the English keeps; only the place
 * the address breaks at moves back to where the Japanese breaks it.
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
 * The `japanese` column is the broken address itself, which is the evidence
 * rather than merely a check: what licenses "Camilla-sama" on this row is that
 * this speech says 「カミーラ、様」 and not that a table spells Camilla.
 */
const ROWS = [
    {file: "030488.tsv", line: 10238, was: "Lord... Gandhi", is: "Gandhi-sama", japanese: "ガンジー、様"},
    {file: "031109.tsv", line: 51450, was: "Lady Camilla", is: "Camilla-sama", japanese: "カミーラ、様"},
    {file: "031615.tsv", line: 91638, was: "Lady Am", is: "Am-sama", japanese: "アム、様"},
    {file: "031667.tsv", line: 95678, was: "Lady Lia", is: "Lia-sama", japanese: "リアさ、ま"},
    {file: "032466.tsv", line: 151805, was: "Lord... Kesselring", is: "Kesselring-sama", japanese: "ケッセルリンク……様"},
    {file: "032697.tsv", line: 170300, was: "Lord Joseph", is: "Joseph-sama", japanese: "ヨシフ、さま"},
    {file: "032797.tsv", line: 177010, was: "Lord Kayblis", is: "Kayblis-sama", japanese: "ケイブリス、様"},
    {file: "033532.tsv", line: 249465, was: "Lord... Kayblis", is: "Kayblis-sama", japanese: "ケイブリス、様"},
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
            // The speech has to lose exactly this one title and keep every
            // other, which is the half-converted-sentence guard: 「ドッス殿と
            // ワッス殿」 is the row that taught it.
            const titles = (one) => (one.match(/\b(?:Lord|Lady)\b/g) ?? []).length;
            if (bracketsOf(after) !== bracketsOf(row.english) || after.includes("\t")
                || !after.startsWith(row.english.match(/^[\s　]*/)[0])
                || titles(after) !== titles(row.english) - 1
                || after.includes("-sama-sama")) {
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
