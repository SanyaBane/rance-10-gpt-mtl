/**
 * Where the English drops a word the tables had already settled.
 *
 *   node scripts/find_dropped_terms.js                 # the hand-written glossaries
 *   node scripts/find_dropped_terms.js --corpus        # the dialogue behind them too
 *   node scripts/find_dropped_terms.js --samples=8     # more lines per corpus term
 *
 * The terms in glossaries/summary_terms.tsv reach a translator as a suggestion --
 * scripts/summary_chunk.js quotes the ones a caption uses into the prompt -- and
 * until now nothing asked afterwards whether the suggestion was taken. 魔王 has
 * been "Demon King" in that file since it was written, and the synopsis panel
 * ０８／魔王の噂 still shipped "The Monster Army hunts the King", which in this
 * world is a different person entirely.
 *
 * createTermChecker in modules/SummaryLines.js is that question asked, and
 * scripts/ex.js now asks it of glossaries/summary_glossary.tsv at every build.
 * This script asks it of everything else: the other six hand-written glossaries,
 * and -- with --corpus -- the dialogue itself.
 *
 * The terms are the synopsis screen's, applied to files that are not the
 * synopsis, and that is the point rather than an overreach. A word is one word
 * per game or it is two names for one thing: 聖骸闘将 is a boss whose HP bar and
 * whose synopsis caption should not disagree, and they did, one calling it a
 * Holy Skeletal Tousho and the other a Holy Corpse Fighting General.
 *
 * Nothing here is a verdict. A caption fits twenty full-width characters and a
 * panel is often full, so "the enemy" for 魔軍 is the panel's doing rather than a
 * disagreement -- the check cannot tell those apart and is not meant to. What it
 * is for is finding the second name for something, which no amount of reading
 * the files one at a time will turn up.
 */
import * as fs from "fs/promises";
import * as path from "path";
import {readSceneRows} from "../modules/Corpus.js";
import {ENEMY_INFO_GLOSSARY} from "../modules/EnemyInfo.js";
import {ENEMY_PARTY_GLOSSARY} from "../modules/EnemyPartyNames.js";
import {ROOT} from "../modules/Env.js";
import {CARD_GLOSSARY} from "../modules/Nameplates.js";
import {RACE_GLOSSARY} from "../modules/RaceNames.js";
import {SUMMARY_GLOSSARY, createTermChecker} from "../modules/SummaryLines.js";
import {textLangName} from "../modules/TextLanguages.js";
import {TROPHY_BONUS_GLOSSARY, TROPHY_GLOSSARY} from "../modules/TrophyNames.js";

const args = process.argv.slice(2);
const wantsCorpus = args.includes("--corpus");
const samplesFlag = args.find(arg => arg.startsWith("--samples="));
const samples = samplesFlag ? Number(samplesFlag.slice("--samples=".length)) : 3;

const checkTerms = await createTermChecker();

/**
 * Every glossary keyed by the Japanese, which is all of them but the names.
 *
 * glossaries/mistranslated_names.json is not here because it is the other table:
 * createNameChecker reads it, and createTermChecker leaves the nine words the two
 * tables share to that check rather than reporting them twice.
 */
const GLOSSARIES = [
    SUMMARY_GLOSSARY,
    ENEMY_INFO_GLOSSARY,
    ENEMY_PARTY_GLOSSARY,
    RACE_GLOSSARY,
    TROPHY_GLOSSARY,
    TROPHY_BONUS_GLOSSARY,
    CARD_GLOSSARY,
];

/** A two-column glossary as rows, with the line numbers the complaints cite. */
const readGlossary = async (file) => (await fs.readFile(file, "utf-8"))
    .split(/\r?\n/)
    .map((line, at) => ({line, number: at + 1}))
    .filter(({line}) => line.trim() && !line.startsWith("#"))
    .map(({line, number}) => {
        const [japanese, english] = line.split("\t");
        return {japanese, english: (english ?? "").trim(), number};
    })
    .filter(row => row.japanese && row.english);

let found = 0;
for (const file of GLOSSARIES) {
    const rows = await readGlossary(file);
    const complaints = rows.flatMap(row =>
        checkTerms(row.japanese, row.english).map(complaint => `  ${row.number}: ${complaint}`));
    found += complaints.length;
    console.log(`${complaints.length} of ${rows.length} rows -> ${path.relative(ROOT, file)}`);
    complaints.forEach(complaint => console.log(complaint));
}

/**
 * The dialogue counted rather than listed. It is 5433 scenes and a term they
 * never took is a thousand rows of them, so what is worth printing is which
 * term and how often, with a few lines to see what it says instead.
 *
 * Named by the scene file rather than by the line number alone, because the
 * point of reading one of these is opening it.
 */
const readDialogue = async () => (await readSceneRows(textLangName())).map(row => ({
    where: `${row.scene}#${row.lineNumber}`,
    japanese: row.japanese,
    english: row.english,
}));

if (wantsCorpus) {
    const lines = (await readDialogue()).filter(line => line.japanese && line.english);
    const missed = new Map();
    for (const line of lines) {
        for (const complaint of checkTerms(line.japanese, line.english)) {
            const term = complaint.slice(complaint.indexOf(" says ") + " says ".length,
                complaint.indexOf(", which the screens call"));
            const record = missed.get(term) ?? {count: 0, shown: []};
            ++record.count;
            if (record.shown.length < samples) {
                record.shown.push(`    ${line.where} ${line.japanese} -> ${line.english}`);
            }
            missed.set(term, record);
        }
    }
    const worst = [...missed].sort((a, b) => b[1].count - a[1].count);
    console.log(`\n${worst.reduce((sum, [, record]) => sum + record.count, 0)} of ${lines.length}`
        + ` lines -> the ${textLangName()} corpus`);
    for (const [term, record] of worst) {
        console.log(`  ${term}: ${record.count}`);
        record.shown.forEach(line => console.log(line));
    }
} else if (found) {
    console.log(`\n--corpus asks the same of the dialogue, which is where most of them are.`);
}
