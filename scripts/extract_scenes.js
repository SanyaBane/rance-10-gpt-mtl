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
import {readGalleryScenes} from "../modules/CgGallery.js";
import {readCorpus} from "../modules/Corpus.js";
import {BUILD, ensureBuild, ROOT} from "../modules/Env.js";
import {loadLineNumbers} from "../modules/LineNumbers.js";
import {createNameplateResolver} from "../modules/Nameplates.js";
import {readPortraitGenders, unreachedRows} from "../modules/PortraitGenders.js";
import {escapeCell, parseSceneFile, renderSceneFile, sceneFileName} from "../modules/SceneFile.js";
import {readScenes} from "../modules/SceneScript.js";
import {isTranslated, textLangDir, textLangName} from "../modules/TextLanguages.js";

/** Where every text language's scenes go, and the one file shared across them. */
const SCENES = path.join(BUILD, "scenes");

/** build/scenes/<lang>: one folder per text language, one file per scene. */
const sceneDir = (lang) => path.join(BUILD, "scenes", lang);

/**
 * Pin the line endings for anybody keeping these under version control.
 *
 * Written with LF, and a checkout with core.autocrlf=true -- the Windows
 * default -- hands them back as CRLF, which appends a \r to the English of
 * every row. Nothing notices: the Japanese is the third column of four, so a
 * check that reads it passes while the whole last column has grown a
 * character. Cheaper to say eol=lf once than to find that later.
 */
const GITATTRIBUTES = "*.tsv text eol=lf\n";

/**
 * Scenes the CG recollection gallery replays, flagged on the header line.
 *
 * A translator may decline these, and a pipeline is better off knowing which
 * before it asks than discovering it from a half-translated answer. The flag is
 * a routing hint and nothing more -- see modules/CgGallery.js for what it does
 * not cover, and modules/SceneAcceptance.js for the half that does not guess.
 */
const CG_FLAG = "cg";


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

    const {genders, malformed} = await readCharacterGenders();
    const {genders: portraitGenders, malformed: portraitMalformed} = await readPortraitGenders();
    const resolveNameplate = await createNameplateResolver();
    const gallery = await readGalleryScenes();
    const {scenes, dumped} = await readScenes();
    if (dumped) {
        console.log("Dumped the game's code to build/ -- delete build/ to take it again.");
    }

    await fs.mkdir(SCENES, {recursive: true});
    await fs.writeFile(path.join(SCENES, ".gitattributes"), GITATTRIBUTES, "utf-8");

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
    let flagged = 0;
    let flaggedLines = 0;
    const manifest = [];
    const unnamed = new Map();
    const genderless = new Set();
    /** lineNumber -> the Japanese written, to read back below. */
    const written = new Map();

    for (const scene of scenes) {
        // Keyed by the portrait as well as the name, because the plate does not
        // always tell two people apart. 汎用ゼス男魔法兵 and 汎用ゼス女魔法兵 are
        // both "Zeth Mage Soldier", and 25 scenes have both on stage; the same
        // goes for 汎用男武士兵 against 汎用女武士兵 and for the four ポピンズ. A
        // cast line per name would have to pick one of the two and would be
        // telling a translator the wrong pronoun for half the lines.
        const cast = new Map();
        for (const line of scene.lines) {
            if (!line.speaker) {
                continue;
            }
            const stand = line.stand.split("／")[0];
            const key = `${line.speaker}\t${stand}`;
            if (!cast.has(key)) {
                cast.set(key, {speaker: line.speaker, stand});
            }
        }

        const flags = gallery.has(scene.name) ? [CG_FLAG] : [];
        const laidOut = {
            functionId: scene.functionId,
            name: scene.name,
            flags,
            cast: [],
            rows: [],
        };
        for (const {speaker, stand} of cast.values()) {
            // The character table first, because it is the one that answers a
            // person; the portrait table is for the costumes it has no row for.
            // A portrait in both would never reach the second, which is what
            // unreachedRows below reports.
            const gender = genders.get(speaker) ?? portraitGenders.get(stand);
            if (!gender) {
                genderless.add(stand);
            }
            laidOut.cast.push({speaker, stand, gender: gender ?? "?"});
        }

        let previous = null;
        for (const line of scene.lines) {
            const japanese = japaneseByLineNumber.get(line.lineNumber) ?? "";
            const english = englishByLineNumber.get(line.lineNumber) ?? "";
            written.set(line.lineNumber, japanese);
            laidOut.rows.push({
                lineNumber: line.lineNumber,
                speaker: sameAsAbove(line, previous) ? "+" : speakerCell(line),
                japanese,
                english,
                startsUtterance: !line.continues,
            });
            previous = line;

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

        const fileName = sceneFileName(scene.functionId);
        await fs.writeFile(path.join(outputDir, fileName), renderSceneFile(laidOut), "utf-8");
        manifest.push([fileName, flags.join(","), scene.lines.length, escapeCell(scene.name)].join("\t"));
        if (flags.length) {
            ++flagged;
            flaggedLines += scene.lines.length;
        }
        ++files;
    }

    // What a driver reads to decide the order and the routing, so that deciding
    // does not mean opening 5433 files.
    await fs.writeFile(path.join(outputDir, "index.tsv"),
        "# file\tflags\tlines\tscene\n" + manifest.join("\n") + "\n", "utf-8");

    /*
     * Read every file back and hold its Japanese against the dump.
     *
     * Through parseSceneFile, which is what the acceptance module and any
     * driver will read these with: a check that parses differently from the
     * consumer checks the wrong thing. It is also what makes this notice a CRLF
     * checkout -- reading the Japanese alone would not, because the \r lands on
     * the English at the end of the row.
     *
     * The whole format rests on the escaping, and the escaping is only ever
     * exercised by the twenty-odd lines that need it. A check that runs over
     * all of them costs a second and is the only thing standing between a
     * mis-split column and a translation delivered against the wrong line.
     */
    let checked = 0;
    for (const fileName of await fs.readdir(outputDir)) {
        if (fileName === "index.tsv") {
            continue;
        }
        const text = await fs.readFile(path.join(outputDir, fileName), "utf-8");
        const scene = parseSceneFile(text);
        // The one comparison that fails when the reader and the writer drift
        // apart rather than when the data does: escaping, column count, blank
        // lines and line endings, all at once.
        if (renderSceneFile(scene) !== text) {
            throw new Error(`${fileName}: reading it and writing it back does not reproduce the file`);
        }
        for (const row of scene.rows) {
            if (row.japanese !== written.get(row.lineNumber)) {
                throw new Error(`${fileName}: line ${row.lineNumber} reads back as`
                    + ` ${JSON.stringify(row.japanese)}, not ${JSON.stringify(written.get(row.lineNumber))}`);
            }
            if (row.english !== (englishByLineNumber.get(row.lineNumber) ?? "")) {
                throw new Error(`${fileName}: line ${row.lineNumber} lost its English on the way back`
                    + ` -- ${JSON.stringify(row.english)}`);
            }
            ++checked;
        }
    }

    console.log(`Wrote ${files} scenes of the "${lang}" dialogue`
        + ` into ${path.relative(ROOT, outputDir)}, ${lines} lines`);
    console.log(`  ${named} lines name their speaker (${(named / lines * 100).toFixed(1)}%)`);
    console.log(`  ${uncovered} lines no corpus record covers, ${blank} whose record is empty`);
    console.log(`  ${flagged} scenes flagged "${CG_FLAG}" by the recollection gallery,`
        + ` ${flaggedLines} lines (${(flaggedLines / lines * 100).toFixed(1)}%)`);
    console.log(`  read ${checked} rows back against the game's own dump, all agreed`);
    if (genderless.size) {
        console.warn(`  ${genderless.size} portraits neither gender table answers`
            + " -- node scripts/find_gender_gaps.js lists them");
    }
    // A row that answers neither Male nor Female is dropped, and a dropped row
    // nothing complains about is how the next one goes unnoticed.
    for (const complaint of malformed) {
        console.warn(`  character_genders.md row cannot be read: ${complaint}`);
    }
    for (const complaint of portraitMalformed) {
        console.warn(`  portrait_genders.tsv row cannot be read: ${complaint}`);
    }
    const used = new Set(scenes.flatMap(scene =>
        scene.lines.map(line => line.stand?.split("／")[0]).filter(Boolean)));
    for (const complaint of unreachedRows(portraitGenders, genders, resolveNameplate, used)) {
        console.warn(`  ${complaint}`);
    }
    const worst = [...unnamed.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    for (const [stand, count] of worst) {
        console.warn(`  ${count} lines behind a portrait the plate table does not name: ${stand}`);
    }
    return 0;
});
