/**
 * Build Rance10EX.ex -- the skill and character descriptions, the quests, and
 * the synopsis screen.
 *
 *   npm run regenerate-ex
 *
 * Everything in archives/Rance10EX_v1_04 is translated in the file itself and needs no
 * step before the build. Three tables are the exception -- the quests' Location
 * plate, the synopsis and the achievements -- because their English lives in
 * glossaries/, keyed by the Japanese, so it has to be written in on the way past.
 *
 * On the way past and not into the file, because the key is the Japanese. A
 * table with the English written over it would match nothing the next time, so
 * the build renders it into a copy of the whole source tree -- seven megabytes
 * of text, a moment to copy -- and hands alice-tools the copy. What is under
 * version control stays as the game shipped it, and the translation stays in
 * one place. modules/PlaceNames.js, modules/SummaryLines.js and
 * modules/TrophyNames.js have the rest of the reasoning.
 */
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import {alice, run} from "../modules/AliceTools.js";
import {ROOT} from "../modules/Env.js";
import {checkCardNames, checkNameplates, checkPlayerNamePlate} from "../modules/Nameplates.js";
import {PLACE_DATA, renderPlaceTable} from "../modules/PlaceNames.js";
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
     * The name on the Location plate of the quest map. Written over the Japanese
     * rather than beside it -- nothing reads the field but the plate -- except
     * for the ランス城 rows, which are a sentinel the code compares against and
     * which modules/PlaceNames.js leaves alone.
     */
    const places = await renderPlaceTable();
    console.log(`Translated ${places.report}`);
    for (const complaint of places.offPlate) {
        console.warn(`  past the Location plate, ${complaint}`);
    }
    for (const complaint of places.misnamed) {
        console.warn(`  ${complaint}`);
    }
    for (const japanese of places.stale) {
        console.warn(`  no quest is set in ${JSON.stringify(japanese)} any more`);
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

    /*
     * The dialogue window's nameplates are translated in the file rather than
     * rendered from a glossary, so no pass repairs them and this build installs
     * whatever they say -- in the plate, and through scripts/generate_card_names.js
     * in the combat log. modules/Nameplates.js has what that cost.
     */
    const plates = await checkNameplates();
    console.log(`Checked ${plates.report}`);
    for (const complaint of plates.misnamed) {
        console.warn(`  ${complaint}`);
    }

    /*
     * And the one plate whose English is not a matter of taste: the .ain
     * compares it against a cherry-picked string to decide whether to put the
     * player's own name there instead. modules/Nameplates.js has the whole of it.
     */
    const playerPlate = await checkPlayerNamePlate();
    console.log(`Checked ${playerPlate.report}`);
    for (const complaint of playerPlate.complaints) {
        console.warn(`  ${complaint}`);
    }

    /*
     * カード情報's フルネーム is the same kind of hand-written English, read by
     * the card detail panel and -- for a character with no portrait -- by the
     * combat log as well.
     */
    const cardNames = await checkCardNames();
    console.log(`Checked ${cardNames.report}`);
    for (const complaint of cardNames.misnamed) {
        console.warn(`  ${complaint}`);
    }

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "rance10-ex-"));
    try {
        await fs.cp(EX_DIR, tempDir, {recursive: true});
        await fs.writeFile(path.join(tempDir, path.basename(PLACE_DATA)), places.text, "utf-8");
        await fs.writeFile(path.join(tempDir, path.basename(SUMMARY_DATA)), summary.text, "utf-8");
        await fs.writeFile(path.join(tempDir, path.basename(TROPHY_DATA)), trophies.text, "utf-8");
        return alice(["ex", "build", "-o", "{game}/Rance10EX.ex", path.join(tempDir, "main.x")]);
    } finally {
        await fs.rm(tempDir, {recursive: true, force: true});
    }
});
