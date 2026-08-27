/**
 * Render one text language's dialogue into the ain.txt patch alice-tools applies.
 *
 * Which text language is the only thing this takes from the command line;
 * see modules/TextLanguages.js. Everything else here -- the line mapping between the
 * two game versions, the cherry-picked system strings, the wrapping -- is the
 * same whichever translation is being built.
 */
import * as fs from "fs/promises";
import * as fsSync from "fs";
import * as path from "path";
import {CHERRY_PICKS, checkCherryPickNames} from "../modules/CherryPicks.js";
import {readCorpus, readSceneDialogue} from "../modules/Corpus.js";
import {ensureBuild, ROOT} from "../modules/Env.js";
import {loadLineNumbers, UNMAPPED} from "../modules/LineNumbers.js";
import {LONGEST_DIALOGUE_LINE, replaceUnicode, wrapAt} from "../modules/TextNormalization.js";
import {renderEnemyInfo} from "../modules/EnemyInfo.js";
import {checkSubstitutionsAreNotMisspellings, createNameNormalizer} from "../modules/NameNormalizer.js";
import {checkPlayerNamePlate} from "../modules/Nameplates.js";
import {SUBSTITUTIONS} from "../modules/SceneAcceptance.js";
import {DEFAULT_TEXT_LANG, hasPatch, hasScenes, isTranslated, regeneratedTxt, textLangDir, textLangName,
    textLangPatch} from "../modules/TextLanguages.js";

ensureBuild();

// Naming a text language that is not there is a typo to fix, not a stack trace to
// read -- the same courtesy scripts/ain.js gets from AliceTools' run().
let textLang;
try {
    textLang = textLangName();
    /*
     * jp is a text language with no text: what it selects is the absence of a
     * translation, and scripts/ain.js skips this whole step for it. Said here
     * as well, because reached directly this would otherwise go looking for
     * chunk folders that were never there.
     */
    if (!isTranslated(textLang)) {
        throw new Error(`The "${textLang}" text language has no dialogue to render:`
            + " it is the game's own Japanese. There is nothing for this script to do.");
    }
    /*
     * A language with none of the three shapes has nothing to render, and
     * saying so beats the ENOENT about a folder that was never going to be
     * there. Scenes first: that is what a language keeps its dialogue in now,
     * and the corpus of chunk files is what they were rendered out of.
     */
    if (!hasScenes(textLang) && !hasPatch(textLang)
        && !fsSync.existsSync(path.join(textLangDir(textLang), "gpt_outputs"))) {
        throw new Error(`text_languages/${textLang} holds no dialogue this script can read: no scenes/,`
            + " no dialogue.ain.txt and no gpt_outputs/. modules/Corpus.js is what the shapes are.");
    }
} catch (error) {
    console.error(error.message);
    process.exit(1);
}

const langRoot = textLangDir(textLang);
const {normalizeNames, contested} = await createNameNormalizer(langRoot);

const {v100ToV104, unmapped, japaneseByLineNumber} = await loadLineNumbers();

const cherryPicksTxt = await fs.readFile(CHERRY_PICKS, "utf-8");

// Generated rather than cherry-picked: which string slots these are was found
// in the code by scripts/extract_enemy_info.js, and the English is keyed by the
// Japanese in glossaries/enemy_info_glossary.tsv. See modules/EnemyInfo.js.
const enemyInfo = await renderEnemyInfo();

await fs.writeFile(UNMAPPED, JSON.stringify(unmapped, null, 4), "utf-8");

/**
 * alice-tools escapes an ain.txt the way JSON does, except that it also lets a
 * lone backslash through -- there was one "「--No,\」" in the patch the grok
 * text language was imported from. An escape nothing recognises gives up the
 * backslash and keeps the character rather than failing a whole build over one
 * line.
 */
const unescapePatch = (body) => body.replaceAll(/\\(.)/g, (_, char) =>
    char === "n" ? "\n" : char === "t" ? "\t" : char === "r" ? "\r" : char);

/**
 * A text language written as a finished patch. Its numbers are the game's already,
 * so nothing is mapped; what it does need is the Japanese each number stands
 * for, which the name repairs read to decide whether a line names a character.
 *
 * The line breaks in it are dropped on the way in. They are where the fork's
 * own build decided to wrap, measured against a font and a margin this
 * repository does not share, and leaving them would keep the ones that
 * overshoot our message window -- so the text goes through the same wrapping
 * every other line does.
 */
const readPatch = async (filePath) => {
    const text = await fs.readFile(filePath, "utf-8");
    const records = new Map();
    let undescribed = 0;
    for (const line of text.split(/\r?\n/)) {
        const match = line.match(/^m\[(\d+)]\s*=\s*"(.*)"$/);
        if (!match) {
            continue;
        }
        const lineNumber = Number(match[1]);
        // The dumps here hold the dialogue rather than every message the game
        // has -- there was a line in the imported grok patch they do not
        // describe, and the game does have that slot. So the line goes through
        // with nothing to say what it translates, which only costs it the name
        // repairs, and alice-tools stays the one that decides a slot does not
        // exist.
        const originalJapaneseLine = japaneseByLineNumber.get(lineNumber);
        if (originalJapaneseLine === undefined) {
            ++undescribed;
        }
        records.set(lineNumber, {
            lineNumber,
            originalJapaneseLine: originalJapaneseLine ?? "",
            translatedEnglishLine: unescapePatch(match[2]).replaceAll(/ *\n */g, " "),
        });
    }
    return [records, undescribed];
};

const byLineNumber = (a, b) => +a.lineNumber - +b.lineNumber;

/**
 * What one language says on its own, keyed by line number, in whichever of the
 * three shapes it keeps its dialogue.
 *
 * Scenes first, because that is where a translation is written and read now;
 * modules/Corpus.js is what each shape is and what reading one costs. The
 * chunk-file shape keys by number here rather than handing back its records in
 * file order, which drops the 5676 duplicate assignments the overlapping chunk
 * ranges used to put in the patch -- the same line, twice, resolved by
 * alice-tools taking the last. The built .ain never noticed; the patch was just
 * longer than the script.
 */
const own = async (name) => {
    if (hasScenes(name)) {
        const {records, scenes, skipped} = await readSceneDialogue(name);
        return [
            new Map(records.map(record => [+record.lineNumber, record])),
            `${records.length} lines from ${scenes} scenes`
            + (skipped ? `, ${skipped} rows of speeches nobody has translated left in Japanese` : ""),
        ];
    }
    if (hasPatch(name)) {
        const [patched, undescribed] = await readPatch(textLangPatch(name));
        return [patched, `${patched.size} lines of its own`
            + (undescribed ? `, ${undescribed} the v1.04 dump does not describe` : "")];
    }
    const corpus = await readCorpus(textLangDir(name), v100ToV104);
    return [new Map(corpus.map(record => [+record.lineNumber, record])),
        `${corpus.length} chunk records`];
};

/**
 * A language names the lines it has an opinion about and no others, and a line
 * it skips plays in the game's own Japanese -- the patch en_grok was imported
 * from missed a scene of 300 lines that way, and a retranslation is partial by
 * definition until the last scene lands. So every language but the default is
 * rendered over the default, which shows through the gaps.
 */
const readTextLang = async (name) => {
    const [mine, howMine] = await own(name);
    if (name === DEFAULT_TEXT_LANG) {
        return [[...mine.values()].sort(byLineNumber), howMine];
    }
    const [beneath] = await own(DEFAULT_TEXT_LANG);
    const filledIn = [...beneath.keys()].filter(lineNumber => !mine.has(lineNumber)).length;
    return [
        [...new Map([...beneath, ...mine]).values()].sort(byLineNumber),
        howMine + (filledIn ? `, ${filledIn} left to "${DEFAULT_TEXT_LANG}"` : ""),
    ];
};

const [allLineRecords, howItWasBuilt] = await readTextLang(textLang);

const LONGEST_LINE = LONGEST_DIALOGUE_LINE;

const output = allLineRecords
    .flatMap(lr => {
        let text = normalizeNames(lr);
        text = replaceUnicode(text, SUBSTITUTIONS);
        // if (text.match(/[^\x00-\x7F♪☆○Σ]/)) {
        //     throw new Error("Got unicode characters, please remove: " + text + " at " + lr.lineNumber);
        // }
        text = wrapAt(text, LONGEST_LINE);
        return [`m[${lr.lineNumber}] = ${JSON.stringify(text)}`];
    })
    // The cherry-picks are a file of their own and start on a line of their
    // own. Without the break they land on the end of the last assignment --
    // m[269677] = "..."; note: "r" character is apparently interpreted... --
    // which has only ever worked because the line they open with is a comment.
    .join("\n") + "\n" + cherryPicksTxt + "\n" + enemyInfo.text + "\n";

await fs.writeFile(regeneratedTxt(textLang), output, "utf-8");

console.log(`Rendered the "${textLang}" dialogue into ${path.relative(ROOT, regeneratedTxt(textLang))}`
    + (howItWasBuilt ? ` -- ${howItWasBuilt}` : ""));
console.log(`Translated ${enemyInfo.report}`);
// Worth saying out loud, not worth stopping for: the panel does not wrap, so an
// overlong line runs off it rather than folding, and a glossary entry the game
// no longer has is text nothing will ever show.
for (const english of enemyInfo.overlong) {
    console.warn(`  too wide for the enemy status panel: ${JSON.stringify(english)}`);
}
for (const complaint of enemyInfo.misnamed) {
    console.warn(`  ${complaint}`);
}
for (const japanese of enemyInfo.stale) {
    console.warn(`  no enemy status line says ${JSON.stringify(japanese)} any more`);
}

/*
 * The cherry-picks held to the name table. Here rather than in scripts/ain.js
 * because this is what reads that file, and it runs only for a text language
 * that has English in it -- which is the only kind where the question means
 * anything. modules/CherryPicks.js carries the complaints it answers on
 * purpose, so what prints is a new one.
 */
const cherryPicks = await checkCherryPickNames();
console.log(`Checked ${cherryPicks.report}`);
for (const complaint of cherryPicks.misnamed) {
    console.warn(`  ${complaint}`);
}
for (const complaint of cherryPicks.stale) {
    console.warn(`  ${complaint}`);
}
// The one cherry-picked string whose correctness is not a matter of English:
// the game compares it against a row of the nameplate table, and the two are
// edited in different archives for different reasons.
const playerPlate = await checkPlayerNamePlate(cherryPicksTxt);
console.log(`Checked ${playerPlate.report}`);
for (const complaint of playerPlate.complaints) {
    console.warn(`  ${complaint}`);
}
/*
 * A token the game substitutes at runtime, listed in the name table as
 * somebody's misspelling. ＜エール＞ was, and the repair pass resolved the
 * player's name to "El" on the way out -- past the acceptance check that
 * refuses a translation for doing the same thing. A hard stop rather than a
 * warning: there is no line of dialogue this could be right about, and the
 * damage is invisible in the English afterwards.
 */
const substitutions = await checkSubstitutionsAreNotMisspellings(SUBSTITUTIONS, langRoot);
if (substitutions.length) {
    for (const complaint of substitutions) {
        console.error(`  ${complaint}`);
    }
    process.exit(1);
}

// The name repairs the table cannot decide, because two names of the same
// length want the same word. Whichever is written first in the file takes it,
// which is right for some of these lines and wrong for the others, so they are
// listed for somebody to fix in the corpus. See modules/NameNormalizer.js.
if (contested.length) {
    console.warn(`  ${contested.length} lines where two names claim the same word:`);
    for (const complaint of contested) {
        console.warn(`    ${complaint}`);
    }
}
