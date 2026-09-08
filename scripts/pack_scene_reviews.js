/**
 * Deal every prompt waiting in build/scene-review/ out to N reviewers at once.
 *
 *   node scripts/pack_scene_reviews.js
 *   node scripts/pack_scene_reviews.js --reviewers=9 --cap-kb=100
 *
 * scripts/request_scene_reviews.js has a --batch-kb of its own and it answers a
 * different question: it groups **the scenes it is handing out in that run**, in
 * the order it hands them out. This one reads the folder instead, so it sees the
 * ones an earlier wave could not fit and the ones a reviewer never answered, and
 * it packs into a **fixed number of batches** because the number of reviewers is
 * what a wave actually costs.
 *
 * Largest first into the emptiest batch that still has room, which is the whole
 * of the arithmetic. What does not fit anywhere prints as NO FIT and stays on
 * disk: nothing is written or moved here, so an unfitted prompt is simply first
 * in line next time. Scene prompts run from 2 KB to 17 KB and later scenes are
 * markedly longer -- 45 of them came to 951 KB once, and ten waited a wave.
 *
 * Scenes in text_languages/<lang>/declined.tsv are left out. That list used to
 * be a Set typed into a throwaway script under build/, which is the same
 * argument for committing it that modules/SceneReview.js makes beside the
 * ledger itself.
 */
import * as fs from "fs/promises";
import * as path from "path";
import {flagValue} from "../modules/Argv.js";
import {readDeclined, REVIEW} from "../modules/SceneReview.js";
import {textLangName} from "../modules/TextLanguages.js";

const KB = 1024;

/** Nine agents is what a wave has been; the cap is one agent's context, not the model's. */
const DEFAULT_REVIEWERS = 9;
const DEFAULT_CAP_KB = 100;

const main = async () => {
    const lang = textLangName();
    const reviewers = Number(flagValue("reviewers") ?? DEFAULT_REVIEWERS);
    const cap = Number(flagValue("cap-kb") ?? DEFAULT_CAP_KB) * KB;
    const declined = await readDeclined(lang);

    const names = (await fs.readdir(REVIEW).catch(() => []))
        .filter(name => name.endsWith(".prompt.md"));
    const pending = [];
    for (const name of names) {
        const id = name.replace(".prompt.md", "");
        if (declined.has(id)) {
            continue;
        }
        pending.push({id, bytes: (await fs.stat(path.join(REVIEW, name))).size});
    }
    pending.sort((one, two) => two.bytes - one.bytes);

    const batches = Array.from({length: reviewers}, () => ({bytes: 0, ids: []}));
    const unfitted = [];
    for (const one of pending) {
        const room = batches
            .filter(batch => batch.bytes + one.bytes <= cap)
            .sort((a, b) => a.bytes - b.bytes)[0];
        if (!room) {
            unfitted.push(one);
            continue;
        }
        room.bytes += one.bytes;
        room.ids.push(one.id);
    }

    for (const one of unfitted) {
        console.log(`NO FIT  ${one.id}  ${(one.bytes / KB).toFixed(1)}KB -- waits for the next wave`);
    }
    for (const [index, batch] of batches.entries()) {
        if (!batch.ids.length) {
            continue;
        }
        console.log(`B${index + 1} ${(batch.bytes / KB).toFixed(1)}KB ${batch.ids.length} :`
            + ` ${batch.ids.sort().join(" ")}`);
    }
    const dealt = pending.length - unfitted.length;
    console.log(`${dealt} of ${pending.length} pending scenes dealt to ${reviewers} reviewers,`
        + ` ${(pending.reduce((sum, one) => sum + one.bytes, 0) / KB).toFixed(1)}KB in all`
        + (declined.size ? `; ${declined.size} declined scenes left where they are.` : "."));
};

await main();
