/**
 * Build Rance10EX.ex -- the skill and character descriptions, the quests, and
 * the synopsis screen.
 *
 *   npm run regenerate-ex
 *
 * Everything in archives/Rance10EX_v1_04 is translated in the file itself and needs no
 * step before the build. Two tables are the exception -- the synopsis and the
 * achievements -- because their English lives in glossaries/, keyed by the
 * Japanese, so it has to be written in on the way past.
 *
 * On the way past and not into the file, because the key is the Japanese. A
 * table with the English written over it would match nothing the next time, so
 * the build renders it into a copy of the whole source tree -- seven megabytes
 * of text, a moment to copy -- and hands alice-tools the copy. What is under
 * version control stays as the game shipped it, and the translation stays in
 * one place. modules/SummaryLines.js and modules/TrophyNames.js have the rest of
 * the reasoning.
 */
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import {alice, run} from "../modules/AliceTools.js";
import {ROOT} from "../modules/Env.js";
import {SUMMARY_DATA, renderSummaryTable} from "../modules/SummaryLines.js";
import {TROPHY_DATA, renderTrophyTable} from "../modules/TrophyNames.js";

const EX_DIR = path.join(ROOT, "archives", "Rance10EX_v1_04");

run(async () => {
    const summary = await renderSummaryTable();
    console.log(`Translated ${summary.report}`);
    for (const english of summary.overlong) {
        console.warn(`  too wide for the synopsis panel: ${english}`);
    }

    /*
     * The achievement names go in beside their Japanese Ids rather than over
     * them, and patches/trophy_names.jaf reads them back -- the Id is a save
     * key. modules/TrophyNames.js says what happens if it is translated instead.
     */
    const trophies = await renderTrophyTable();
    console.log(`Translated ${trophies.report}`);
    for (const complaint of trophies.overlong) {
        console.warn(`  past what the 実績 row draws, ${complaint}`);
    }
    for (const complaint of trophies.misnamed) {
        console.warn(`  ${complaint}`);
    }
    for (const japanese of trophies.stale) {
        console.warn(`  the game has no achievement called ${JSON.stringify(japanese)}`);
    }
    for (const japanese of trophies.missingBonus) {
        console.warn(`  no English for the bonus ${JSON.stringify(japanese)}`);
    }

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "rance10-ex-"));
    try {
        await fs.cp(EX_DIR, tempDir, {recursive: true});
        await fs.writeFile(path.join(tempDir, path.basename(SUMMARY_DATA)), summary.text, "utf-8");
        await fs.writeFile(path.join(tempDir, path.basename(TROPHY_DATA)), trophies.text, "utf-8");
        return alice(["ex", "build", "-o", "{game}/Rance10EX.ex", path.join(tempDir, "main.x")]);
    } finally {
        await fs.rm(tempDir, {recursive: true, force: true});
    }
});
