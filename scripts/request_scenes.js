/**
 * Hand out the next scenes to translate.
 *
 *   node scripts/request_scenes.js --text-lang=en_opus --count=8
 *
 * Writes build/scene-work/<scene>.prompt.md, one per scene, and prints the
 * list. Each prompt is the whole task: the scene, its cast with their genders,
 * the settled English for what it names, and the rules the acceptance will hold
 * the answer to. Whoever translates it writes
 * build/scene-work/<scene>.answer.tsv beside it -- `number<TAB>English`, one per
 * row of the scene -- and then scripts/accept_scenes.js decides.
 *
 * The two halves are two scripts because they run at different moments and one
 * of them writes into text_languages/ while this one only ever writes into
 * build/. Nothing here can lose a translation.
 *
 * What it picks, in order:
 *
 *   - scenes already handed out and still unanswered, so a run interrupted
 *     halfway is resumed rather than doubled;
 *   - scenes that came back and were refused, with the complaints at the top of
 *     the new prompt, until --attempts of them;
 *   - scenes nothing has claimed yet, in --order.
 *
 * Coverage is a directory listing of text_languages/<lang>/scenes/ -- see
 * modules/SceneTranslations.js -- so there is no ledger to keep in step and
 * re-translating a scene is --only with the scene's number.
 */
import * as fs from "fs/promises";
import * as path from "path";
import {flagValue, hasFlag} from "../modules/Argv.js";
import {run} from "../modules/AliceTools.js";
import {ROOT} from "../modules/Env.js";
import {parseSceneFile, sceneFileName} from "../modules/SceneFile.js";
import {CG_FLAG, ORDERS, readSceneIndex, sceneDir, translatedFileNames} from "../modules/SceneIndex.js";
import {readSceneGlossaries, renderScenePrompt} from "../modules/ScenePrompt.js";
import {answerFile, promptFile, readState, workInProgress, WORK} from "../modules/SceneWork.js";
import {DEFAULT_TEXT_LANG, isTranslated, textLangName} from "../modules/TextLanguages.js";

/**
 * How many times a refused scene is asked again before it is left alone.
 *
 * Three because the complaints are specific -- a missing line number, a speech
 * that needs a fourth row -- and a translator that has not fixed them twice is
 * not going to on the fifth ask. What is left over is a list for a person,
 * which is what build/scene-translation.tsv is.
 */
const DEFAULT_ATTEMPTS = 3;

await run(async () => {
    const lang = textLangName();
    if (!isTranslated(lang)) {
        throw new Error(`"${lang}" is the game's own Japanese: there is nothing to translate into it.`);
    }
    if (lang === DEFAULT_TEXT_LANG) {
        throw new Error(`"${lang}" is the text language every patch is rendered on top of, and this would`
            + " translate it over itself. Name the one being written, --text-lang=en_opus.");
    }

    /*
     * Which laid-out scenes to read. Not the same choice as --text-lang: the
     * Japanese and the line numbers are the game's, so any language's extract
     * would do, and the default is the one that is certain to be there.
     */
    const source = flagValue("source") ?? DEFAULT_TEXT_LANG;
    const count = Number(flagValue("count") ?? 1);
    const attempts = Number(flagValue("attempts") ?? DEFAULT_ATTEMPTS);
    const orderName = flagValue("order") ?? "index";
    if (!ORDERS[orderName]) {
        throw new Error(`--order=${orderName} is not one of ${Object.keys(ORDERS).join(", ")}.`);
    }
    const only = (flagValue("only") ?? "").split(",").map(name => name.trim()).filter(Boolean)
        .map(name => /^\d+$/.test(name) ? sceneFileName(Number(name)) : name);

    const index = await readSceneIndex(source);
    const byFileName = new Map(index.map(scene => [scene.fileName, scene]));
    for (const name of only) {
        if (!byFileName.has(name)) {
            throw new Error(`--only names ${name}, which build/scenes/${source}/index.tsv does not have.`);
        }
    }

    const done = await translatedFileNames(lang);
    const held = await workInProgress();

    /*
     * The CG recollection gallery's 131 scenes, 10.2% of the dialogue, skipped
     * unless asked for. That table is the game's own statement of where its
     * adult content is, and a translator is entitled to decline it -- so the
     * default is not to spend the ask. Those lines are not lost: a line no
     * scene file claims plays in the language underneath, which is the whole
     * point of rendering en_grok below a partial patch.
     */
    const withCg = hasFlag("with-cg");
    const onlyCg = hasFlag("only-cg");

    const skipped = {done: 0, cg: 0, spent: 0};
    const wanted = [];
    for (const scene of index) {
        if (only.length) {
            if (only.includes(scene.fileName)) {
                wanted.push(scene);
            }
            continue;
        }
        if (done.has(scene.fileName)) {
            ++skipped.done;
            continue;
        }
        const isCg = scene.flags.includes(CG_FLAG);
        if (onlyCg ? !isCg : (isCg && !withCg)) {
            skipped.cg += isCg ? 1 : 0;
            continue;
        }
        const state = held.has(scene.fileName) ? await readState(scene.fileName) : null;
        if (state && state.attempts >= attempts) {
            ++skipped.spent;
            continue;
        }
        wanted.push({...scene, state, answered: held.get(scene.fileName)?.answer ?? false});
    }

    /*
     * A scene handed out and not yet answered goes first whatever the order
     * says. Asking for more while the last batch is still open is how two
     * translators end up on one scene, and the second answer to arrive
     * overwrites the first.
     */
    const unanswered = wanted.filter(scene => held.has(scene.fileName) && !scene.answered);
    const rest = wanted.filter(scene => !unanswered.includes(scene)).sort(ORDERS[orderName]);
    const candidates = [...unanswered, ...rest];

    /*
     * One "scene" has nothing in it to translate: function 2119, whose whole
     * content is the engine's own empty m[1] and whose name in the dump is
     * "VAR  1: Message : string" because there is no scene there to name. It
     * cannot be filtered out of the index -- the extract writes what the game
     * has, which is the right thing for it to do -- and it cannot be
     * translated, so it is counted and passed over. Parsed only for the scenes
     * about to go out, so this costs one file read per scene handed out rather
     * than 5433.
     */
    const batch = [];
    let empty = 0;
    for (const scene of candidates) {
        if (!only.length && batch.length >= count) {
            break;
        }
        const parsed = parseSceneFile(await fs.readFile(path.join(sceneDir(source), scene.fileName), "utf-8"));
        if (!parsed.rows.some(row => row.japanese)) {
            ++empty;
            continue;
        }
        batch.push({...scene, parsed});
    }

    if (!batch.length) {
        console.log(`Nothing to hand out: ${done.size} of ${index.length} scenes are translated`
            + (skipped.cg ? `, ${skipped.cg} skipped as "${CG_FLAG}" -- --with-cg asks for them` : "")
            + (skipped.spent ? `, ${skipped.spent} spent their ${attempts} attempts` : "")
            + (empty ? `, ${empty} hold no Japanese to translate` : "")
            + ".");
        return 0;
    }

    await fs.mkdir(WORK, {recursive: true});
    const glossaries = await readSceneGlossaries();
    let lines = 0;
    for (const scene of batch) {
        const parsed = scene.parsed;
        const state = scene.state ?? await readState(scene.fileName);
        const prompt = renderScenePrompt(parsed, glossaries, {
            answerFile: path.relative(ROOT, answerFile(scene.fileName)).replaceAll("\\", "/"),
            problems: state?.problems,
            warnings: state?.warnings,
            attempt: state?.attempts,
        });
        await fs.writeFile(promptFile(scene.fileName), prompt, "utf-8");
        lines += parsed.rows.length;
        console.log(`${path.relative(ROOT, promptFile(scene.fileName)).replaceAll("\\", "/")}`
            + `\t${parsed.rows.length}\t${scene.flags.join(",")}\t${scene.name}`
            + (state ? `\t(attempt ${state.attempts + 1}, ${state.problems.length} to fix)` : ""));
    }

    console.log(`\n${batch.length} scenes, ${lines} lines. Write each answer to the .answer.tsv the prompt`
        + " names, then: node scripts/accept_scenes.js" + ` --text-lang=${lang}`);
    console.log(`${done.size} of ${index.length} scenes translated so far`
        + (skipped.cg ? `, ${skipped.cg} skipped as "${CG_FLAG}"` : "")
        + (skipped.spent ? `, ${skipped.spent} spent their ${attempts} attempts` : "")
        + (empty ? `, ${empty} hold no Japanese to translate` : "") + ".");
    return 0;
});
