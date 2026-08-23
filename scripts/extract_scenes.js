/**
 * Lay one text language's dialogue out scene by scene, with the speaker on
 * every line, for a translation pass that can see what it is translating.
 *
 *   node scripts/extract_scenes.js [--text-lang=en_grok]
 *
 * Writes build/scenes/<lang>/<function id>.tsv, one file per scene, 5433 of
 * them. Nothing reads these -- they are what a translator reads, and what comes
 * back goes into text_languages/<lang>/ as usual -- so they are a build
 * by-product like everything else under build/, regenerated rather than kept.
 *
 * Four columns. The m[] number, which is the join key and the only thing the
 * game gets back. Then the speaker: their canonical English name, "+" for
 * another row of the speech above, "-" for narration, "?" for a message with no
 * speaker that is not narration either, and a trailing "~" for a thought. Then
 * the Japanese, and then the English the corpus has now.
 *
 * The Japanese comes from the game's own dump rather than from the corpus
 * record beside the English. Those disagree on 5081 records -- see the header
 * of modules/LineNumbers.js -- because the corpus was written by a model that
 * re-typed the Japanese instead of copying it, and a retranslation should not
 * be shown a lossy copy of what it is retranslating.
 *
 * The speaker column carries the name spelled out rather than an index into the
 * cast header, which is the one place here that spends tokens on purpose. A
 * translator writing English prose has to spell these names, and this
 * repository's expensive lesson is that a name recalled rather than read comes
 * out as "Kanteru": the canonical spelling belongs in front of them on the line
 * they are writing, not two screens up.
 */
import * as fs from "fs/promises";
import * as path from "path";
import {run} from "../modules/AliceTools.js";
import {readCharacterGenders} from "../modules/CharacterGenders.js";
import {readCorpus} from "../modules/Corpus.js";
import {BUILD, ensureBuild, ROOT} from "../modules/Env.js";
import {loadLineNumbers} from "../modules/LineNumbers.js";
import {readScenes} from "../modules/SceneScript.js";
import {isTranslated, textLangDir, textLangName} from "../modules/TextLanguages.js";

/** build/scenes/<lang>: one folder per text language, one file per scene. */
const sceneDir = (lang) => path.join(BUILD, "scenes", lang);

/**
 * A tab inside a cell would silently move every column after it.
 *
 * 2929 of the game's messages hold one -- almost all of them leading
 * indentation in a scenario draft, but 17 have a tab in the middle of the line,
 * and those are the ones that would go wrong. No message and no translation
 * holds a backslash today, so the escape is unambiguous the moment it is
 * written; it is doubled anyway, because a new translation is exactly the thing
 * that could bring the first one.
 */
const escape = (text) => text.replaceAll("\\", "\\\\").replaceAll("\t", "\\t");

const unescape = (text) => text.replaceAll(/\\(.)/g, (_, char) => char === "t" ? "\t" : char);

/**
 * Who the line is, before "+" gets a say: a name, or the marker standing in for
 * one.
 */
const speakerCell = (line) => {
    // A portrait the plate table does not name is still worth printing: 汎用男性
    // is a passer-by and ハウゼルとサイゼル is two people, and either says more
    // than "?" does.
    const who = line.speaker ?? line.stand;
    if (who) {
        return line.kind === "thought" ? who + "~" : who;
    }
    return line.kind === "narration" ? "-" : "?";
};

/**
 * "+" means the row above, not merely the bubble above.
 *
 * A speech is closed by CALLFUNC A, and 894 rows carry on past a change of
 * speaker without one -- a character's thought running straight into the
 * narration that answers it, most of them. Writing "+" on those because the
 * bubble had not closed would tell a translator the narration is still that
 * character talking, which is the one thing this column exists to prevent.
 */
const sameAsAbove = (line, previous) => line.continues
    && previous !== null
    && speakerCell(line) === speakerCell(previous);

await run(async () => {
    ensureBuild();

    const lang = textLangName();
    if (!isTranslated(lang)) {
        throw new Error(`The "${lang}" text language has no dialogue to lay out:`
            + " it is the game's own Japanese, and every English column would be empty.");
    }

    const {v100ToV104, japaneseByLineNumber} = await loadLineNumbers();
    const corpus = await readCorpus(textLangDir(lang), v100ToV104);
    // Last wins, the way rendering the patch resolves a line named twice.
    const englishByLineNumber = new Map(corpus.map(record => [+record.lineNumber, record.translatedEnglishLine]));

    const genders = await readCharacterGenders();
    const {scenes, dumped} = await readScenes();
    if (dumped) {
        console.log("Dumped the game's code to build/ -- delete build/ to take it again.");
    }

    const outputDir = sceneDir(lang);
    // Stale scenes would otherwise outlive the run that stopped writing them.
    // Under BUILD by construction, and BUILD is gitignored whole.
    await fs.rm(outputDir, {recursive: true, force: true});
    await fs.mkdir(outputDir, {recursive: true});

    let files = 0;
    let lines = 0;
    let named = 0;
    /** No corpus record at all, against a record whose English is empty. */
    let uncovered = 0;
    let blank = 0;
    const unnamed = new Map();
    const genderless = new Set();
    /** lineNumber -> the Japanese written, to read back below. */
    const written = new Map();

    for (const scene of scenes) {
        const cast = new Map();
        for (const line of scene.lines) {
            if (line.speaker && !cast.has(line.speaker)) {
                cast.set(line.speaker, line.stand);
            }
        }

        const body = [`# ${scene.functionId}\t${escape(scene.name)}`];
        for (const [speaker, stand] of cast) {
            const gender = genders.get(speaker);
            if (!gender) {
                genderless.add(speaker);
            }
            body.push(`* ${speaker}\t${escape(stand.split("／")[0])}\t${gender ?? "?"}`);
        }

        let previous = null;
        for (const line of scene.lines) {
            if (!line.continues) {
                body.push("");
            }
            const japanese = japaneseByLineNumber.get(line.lineNumber) ?? "";
            const english = englishByLineNumber.get(line.lineNumber) ?? "";
            written.set(line.lineNumber, japanese);
            const who = sameAsAbove(line, previous) ? "+" : speakerCell(line);
            previous = line;
            body.push([line.lineNumber, who, escape(japanese), escape(english)].join("\t"));

            ++lines;
            if (line.speaker) {
                ++named;
            } else if (line.stand) {
                unnamed.set(line.stand, (unnamed.get(line.stand) ?? 0) + 1);
            }
            if (!englishByLineNumber.has(line.lineNumber)) {
                ++uncovered;
            } else if (!english) {
                ++blank;
            }
        }

        const fileName = String(scene.functionId).padStart(6, "0") + ".tsv";
        await fs.writeFile(path.join(outputDir, fileName), body.join("\n") + "\n", "utf-8");
        ++files;
    }

    /*
     * Read every file back and hold its Japanese against the dump.
     *
     * The whole format rests on the escaping, and the escaping is only ever
     * exercised by the twenty-odd lines that need it. A check that runs over
     * all of them costs a second and is the only thing standing between a
     * mis-split column and a translation delivered against the wrong line.
     */
    let checked = 0;
    for (const fileName of await fs.readdir(outputDir)) {
        const text = await fs.readFile(path.join(outputDir, fileName), "utf-8");
        for (const row of text.split("\n")) {
            if (!row || row.startsWith("#") || row.startsWith("* ")) {
                continue;
            }
            const cells = row.split("\t");
            if (cells.length !== 4) {
                throw new Error(`${fileName}: ${cells.length} columns, not 4, in ${JSON.stringify(row)}`);
            }
            const expected = written.get(Number(cells[0]));
            if (unescape(cells[2]) !== expected) {
                throw new Error(`${fileName}: line ${cells[0]} reads back as`
                    + ` ${JSON.stringify(unescape(cells[2]))}, not ${JSON.stringify(expected)}`);
            }
            ++checked;
        }
    }

    console.log(`Wrote ${files} scenes of the "${lang}" dialogue`
        + ` into ${path.relative(ROOT, outputDir)}, ${lines} lines`);
    console.log(`  ${named} lines name their speaker (${(named / lines * 100).toFixed(1)}%)`);
    console.log(`  ${uncovered} lines no corpus record covers, ${blank} whose record is empty`);
    console.log(`  read ${checked} rows back against the game's own dump, all agreed`);
    if (genderless.size) {
        console.warn(`  ${genderless.size} speakers glossaries/character_genders.md does not list`);
    }
    const worst = [...unnamed.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    for (const [stand, count] of worst) {
        console.warn(`  ${count} lines behind a portrait the plate table does not name: ${stand}`);
    }
    return 0;
});
