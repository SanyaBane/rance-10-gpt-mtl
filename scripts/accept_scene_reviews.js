/**
 * Take the answered reviews back in.
 *
 *   node scripts/accept_scene_reviews.js                # judge, and write what stands
 *   node scripts/accept_scene_reviews.js --dry-run      # judge only, write nothing
 *   node scripts/accept_scene_reviews.js --by=sonnet-5  # who read it, for the ledger
 *   node scripts/accept_scene_reviews.js --with-names   # write the name corrections too
 *
 * **A `name:` correction is collected rather than written.** A name spelled
 * wrong in one scene is spelled wrong in every scene that says it -- イラーピュ
 * is "Irapyu" in ten of them where glossaries/summary_terms.tsv settles "Ylapu"
 * -- so mending this scene's copy leaves nine and finishes nothing. Those go to
 * the report for scripts/find_term_drift.js to sweep in one commit, which is
 * CLAUDE.md's rule that a sweep is finished when the built file says so.
 * --with-names writes them anyway, for a run that is not going to be swept.
 *
 * Reads every build/scene-review/<scene>.answer.tsv, holds each correction
 * against the rows it would land on with modules/SceneReview.js, and writes the
 * ones that stand into text_languages/<lang>/scenes/.
 *
 * **A correction is refused on its own, not with the scene.** That is the one
 * place this differs from scripts/accept_scenes.js, and it is safe for a reason
 * that does not hold there: a review names the number it changes and never
 * moves a row, so a refusal leaves that speech exactly as it was and costs the
 * others nothing. A retranslation that comes back short shifts every line after
 * the gap, which is why that one lands whole or not at all.
 *
 * What is checked is in the module and deliberately not repeated here. Two
 * gates stand in front of every write, both borrowed from
 * scripts/bake_speech_rows.js, which is the other pass that edits a committed
 * translation in place:
 *
 * **The file has to round-trip.** Before anything is written the scene is
 * parsed and rendered back with no edits and compared with the bytes on disk. A
 * writer that assumes the format reformats a file to change one cell.
 *
 * **The result has to read back as what was accepted.** After the write the
 * file is parsed again: every corrected speech has to come out of its rows as
 * the words that went in, and no other row may have moved. A file that fails
 * that is put back as it was and said so -- CLAUDE.md's rule about reading the
 * result back, one step before the built `.ain`.
 *
 * build/scene-review.tsv is every correction of the run, applied or not, with
 * the line before and after and the reason given for it. That is the file to
 * read before committing: a pass that is trusted rather than read is a pass
 * that rewrites 62 261 speeches nobody asked it to.
 */
import * as fs from "fs/promises";
import * as path from "path";
import {run} from "../modules/AliceTools.js";
import {flagValue, hasFlag} from "../modules/Argv.js";
import {ROOT} from "../modules/Env.js";
import {createNameNormalizer} from "../modules/NameNormalizer.js";
import {parseSceneFile, renderSceneFile} from "../modules/SceneFile.js";
import {answerFile, appendLog, appendReviewed, applyReview, promptFile, readReview, renderReport,
    REPORT, REVIEW, verifyReview} from "../modules/SceneReview.js";
import {isTranslated, textLangDir, textLangName, textLangScenes} from "../modules/TextLanguages.js";

/** How a line reads in the run's own output: short enough to scan, long enough to judge. */
const shorten = (text, at = 96) => (text.length > at ? `${text.slice(0, at - 3)}...` : text);

await run(async () => {
    const lang = textLangName();
    if (!isTranslated(lang)) {
        throw new Error(`"${lang}" is the game's own Japanese: there is no English in it to correct.`);
    }
    const dryRun = hasFlag("dry-run");
    /* The kinds that are reported rather than written. The header says why. */
    const holds = hasFlag("with-names") ? new Set() : new Set(["name"]);
    const by = flagValue("by") ?? "unnamed";
    const dir = textLangScenes(lang);

    const answered = (await fs.readdir(REVIEW).catch(() => []))
        .map(name => /^(\d+)\.answer\.tsv$/.exec(name)?.[1])
        .filter(Boolean)
        .map(id => `${id}.tsv`)
        .sort();
    if (!answered.length) {
        console.log("Nothing has been answered. node scripts/request_scene_reviews.js hands scenes out.");
        return 0;
    }

    /*
     * The name repairs are written into the corpus rather than applied on the
     * way to the game -- CLAUDE.md's rule that a file reads the way a build of
     * it reads -- so a correction has to be a fixed point of that pass or the
     * two have drifted the moment it lands. Asked of the corrected line only:
     * the rest of the file was a fixed point before this run and is untouched.
     */
    const {normalizeNames} = await createNameNormalizer(textLangDir(lang));
    const repairs = (japanese, english) => normalizeNames({
        lineNumber: 0,
        originalJapaneseLine: japanese,
        translatedEnglishLine: english,
    });

    const outcomes = [];
    let filesChanged = 0;
    let corrections = 0;
    let broken = 0;

    for (const fileName of answered) {
        const file = path.join(dir, fileName);
        const text = await fs.readFile(file, "utf-8");
        const scene = parseSceneFile(text);
        console.log(`${fileName}  ${scene.name}`);

        if (renderSceneFile(scene) !== text) {
            console.log("    the file does not reproduce itself; left alone");
            ++broken;
            continue;
        }

        const {edits, problems, prose} = readReview(scene, await fs.readFile(answerFile(fileName), "utf-8"));
        for (const problem of problems) {
            console.log(`    refused: ${problem}`);
        }
        const {rowEdits, applied, refused, unchanged, collected, warnings} =
            applyReview(fileName, scene, edits, repairs, holds);

        for (const one of applied) {
            console.log(`    m[${one.lineNumber}] ${one.why}`);
            console.log(`      - ${shorten(one.before)}`);
            console.log(`      + ${shorten(one.english)}`);
        }
        for (const one of refused) {
            console.log(`    m[${one.lineNumber}] refused: ${one.complaint}`);
        }
        for (const one of collected) {
            console.log(`    m[${one.lineNumber}] held for the sweep (${one.kind}): ${one.why}`);
        }
        for (const one of unchanged) {
            console.log(`    m[${one.lineNumber}] came back unchanged, and was not counted a correction`);
        }
        for (const warning of warnings) {
            console.log(`    worth a look: ${warning}`);
        }
        if (!edits.size && !problems.length) {
            console.log(`    read and found sound${prose.length ? ", with a note beside it" : ""}`);
        }

        outcomes.push(...applied.map(one => ({fileName, status: "applied", one})));
        outcomes.push(...refused.map(one => ({fileName, status: "refused", one})));
        outcomes.push(...unchanged.map(one => ({fileName, status: "unchanged", one})));
        outcomes.push(...collected.map(one => ({fileName, status: "held", one})));
        corrections += applied.length;

        if (dryRun) {
            continue;
        }

        if (rowEdits.size) {
            await fs.writeFile(file, renderSceneFile(scene, rowEdits), "utf-8");
            const complaints = verifyReview(parseSceneFile(await fs.readFile(file, "utf-8")), scene, applied);
            if (complaints.length) {
                await fs.writeFile(file, text, "utf-8");
                complaints.forEach(complaint => console.log(`    put back: ${complaint}`));
                await appendLog(`reverted\t${fileName}\t${applied.length}\t${JSON.stringify(complaints[0])}`);
                ++broken;
                continue;
            }
            ++filesChanged;
        }

        await appendReviewed(lang, {
            fileName,
            date: new Date().toISOString().slice(0, 10),
            speeches: scene.rows.length,
            applied: applied.length,
            refused: refused.length + problems.length,
            held: collected.length,
            by,
        });
        await appendLog(`reviewed\t${fileName}\t${applied.length}\t${refused.length + problems.length}`
            + `\t${collected.length}\t${by}`);
        await fs.rm(answerFile(fileName), {force: true});
        await fs.rm(promptFile(fileName), {force: true});
    }

    await fs.writeFile(REPORT, renderReport(outcomes), "utf-8");

    const of = (status) => outcomes.filter(outcome => outcome.status === status).length;
    console.log(`\n${answered.length} scenes read: ${corrections} corrections in ${filesChanged} files,`
        + ` ${of("held")} held for the sweep, ${of("refused")} refused, ${of("unchanged")} unchanged`
        + (broken ? `, ${broken} left alone` : "") + ".");
    console.log(`${path.relative(ROOT, REPORT).replaceAll("\\", "/")} is every one of them, with the line`
        + " before and after. Read it before committing.");
    if (dryRun) {
        console.log("A dry run: nothing written, nothing recorded, the answers left where they are.");
    } else if (filesChanged) {
        console.log(`Then check what moved: node scripts/check_scenes.js --text-lang=${lang}`);
    }
    return 0;
});
