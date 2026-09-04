/**
 * Hand out the next scenes to read against their Japanese.
 *
 *   node scripts/request_scene_reviews.js --only=033299
 *   node scripts/request_scene_reviews.js --count=8
 *
 * Writes build/scene-review/<scene>.prompt.md, one per scene, and prints the
 * list. The prompt is the whole task: the scene with the English it has now
 * beside the Japanese, the cast with their genders, the settled English for
 * what it names, and what counts as worth changing. Whoever reads it writes
 * build/scene-review/<scene>.answer.tsv beside it -- one
 * `number<TAB>corrected English<TAB>what was wrong` per correction, and nothing
 * for the speeches that are sound -- and then
 * scripts/accept_scene_reviews.js decides.
 *
 * The same two halves scripts/request_scenes.js and scripts/accept_scenes.js
 * are, for the same reason: the middle is a person or a model, the seam is a
 * file, and only the second half writes into text_languages/.
 *
 * **What it reads is the translation itself**, not build/scenes/. That folder is
 * what a *re*translation is written from and carries the same English anyway;
 * reading the file that is about to be edited is one less thing that can be a
 * run behind.
 *
 * Coverage is text_languages/<lang>/reviewed.tsv, which
 * modules/SceneReview.js writes a row into per scene. It has to be committed
 * rather than left under build/: a review pass over 5433 scenes is months of
 * asking, and build/ is documented as safe to delete. It is a record of what was
 * asked and cannot go out of step with the tree the way a ledger of state would
 * -- a scene reviewed stays reviewed however its file changes afterwards.
 */
import * as fs from "fs/promises";
import * as path from "path";
import {run} from "../modules/AliceTools.js";
import {flagValue, hasFlag} from "../modules/Argv.js";
import {ROOT} from "../modules/Env.js";
import {parseSceneFile, sceneFileName} from "../modules/SceneFile.js";
import {CG_FLAG} from "../modules/SceneIndex.js";
import {readSceneGlossaries} from "../modules/ScenePrompt.js";
import {answerFile, promptFile, readReviewed, renderReviewPrompt, REVIEW}
    from "../modules/SceneReview.js";
import {isTranslated, textLangName, textLangScenes} from "../modules/TextLanguages.js";

await run(async () => {
    const lang = textLangName();
    if (!isTranslated(lang)) {
        throw new Error(`"${lang}" is the game's own Japanese: there is no English in it to read.`);
    }
    const dir = textLangScenes(lang);
    const count = Number(flagValue("count") ?? 1);
    const only = (flagValue("only") ?? "").split(",").map(name => name.trim()).filter(Boolean)
        .map(name => /^\d+$/.test(name) ? sceneFileName(Number(name)) : name);

    /*
     * The CG recollection gallery's scenes, skipped unless asked for, which is
     * the same routing scripts/request_scenes.js does and for the same reason:
     * 35_ＣＧ回想情報.x is the game's own statement of where its adult content is
     * and a reviewer is entitled to decline it. Their English stays as it is,
     * which is what it would be anyway.
     */
    const withCg = hasFlag("with-cg");
    const onlyCg = hasFlag("only-cg");

    const fileNames = (await fs.readdir(dir)).filter(name => name.endsWith(".tsv")).sort();
    if (!fileNames.length) {
        throw new Error(`text_languages/${lang}/scenes/ holds no scene files, so there is nothing to read.`);
    }
    for (const name of only) {
        if (!fileNames.includes(name)) {
            throw new Error(`--only names ${name}, which text_languages/${lang}/scenes/ does not have.`);
        }
    }

    const reviewed = await readReviewed(lang);
    const held = new Set((await fs.readdir(REVIEW).catch(() => []))
        .map(name => /^(\d+)\.(prompt\.md|answer\.tsv)$/.exec(name)?.[1])
        .filter(Boolean)
        .map(id => `${id}.tsv`));

    const skipped = {done: 0, cg: 0, out: 0, empty: 0};
    const batch = [];
    for (const fileName of fileNames) {
        if (only.length) {
            if (!only.includes(fileName)) {
                continue;
            }
        } else {
            if (batch.length >= count) {
                break;
            }
            if (reviewed.has(fileName)) {
                ++skipped.done;
                continue;
            }
            if (held.has(fileName)) {
                ++skipped.out;
                continue;
            }
        }
        const scene = parseSceneFile(await fs.readFile(path.join(dir, fileName), "utf-8"));
        const isCg = scene.flags.includes(CG_FLAG);
        if (!only.length && (onlyCg ? !isCg : (isCg && !withCg))) {
            skipped.cg += isCg ? 1 : 0;
            continue;
        }
        /*
         * Nothing to read: function 2119 is the engine's own empty m[1] and
         * there is no scene there. Counted out loud rather than silently
         * passed over, so that one short of a batch is not a mystery.
         */
        if (!scene.rows.some(row => row.japanese)) {
            ++skipped.empty;
            continue;
        }
        batch.push({fileName, scene});
    }

    if (!batch.length) {
        console.log(`Nothing to hand out: ${reviewed.size} of ${fileNames.length} scenes reviewed`
            + (skipped.cg ? `, ${skipped.cg} skipped as "${CG_FLAG}" -- --with-cg asks for them` : "")
            + (skipped.out ? `, ${skipped.out} already out` : "")
            + (skipped.empty ? `, ${skipped.empty} hold no Japanese` : "") + ".");
        return 0;
    }

    await fs.mkdir(REVIEW, {recursive: true});
    const glossaries = await readSceneGlossaries();
    let speeches = 0;
    for (const {fileName, scene} of batch) {
        const prompt = renderReviewPrompt(scene, glossaries, {
            answerFile: path.relative(ROOT, answerFile(fileName)).replaceAll("\\", "/"),
        });
        await fs.writeFile(promptFile(fileName), prompt, "utf-8");
        speeches += scene.rows.length;
        console.log(`${path.relative(ROOT, promptFile(fileName)).replaceAll("\\", "/")}`
            + `\t${scene.rows.length}\t${scene.flags.join(",")}\t${scene.name}`);
    }

    console.log(`\n${batch.length} scenes, ${speeches} rows. Write each answer to the .answer.tsv the`
        + " prompt names -- an empty file is a valid answer -- then: node scripts/accept_scene_reviews.js"
        + ` --text-lang=${lang}`);
    console.log(`${reviewed.size} of ${fileNames.length} scenes reviewed so far.`);
    return 0;
});
