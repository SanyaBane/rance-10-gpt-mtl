/**
 * Turn a retranslation's scene files into the patch the build reads.
 *
 *   node scripts/assemble_scene_patch.js --text-lang=en_opus
 *
 * text_languages/<lang>/scenes/*.tsv is written a scene at a time as a
 * translator gets through them; text_languages/<lang>/dialogue.ain.txt is this
 * script's output and nobody's to edit. Run it after any scene lands, then
 * build as usual -- scripts/regenerate_aai_txt.js renders the default text
 * language underneath, so the scenes not reached yet still play in English.
 *
 * Rewritten whole every time rather than appended to. An assembled file that
 * only ever grows can disagree with the scenes it came from, and the way that
 * shows up is a line nobody can find the source of.
 */
import * as fs from "fs/promises";
import * as path from "path";
import {run} from "../modules/AliceTools.js";
import {ROOT} from "../modules/Env.js";
import {loadGameJapanese} from "../modules/LineNumbers.js";
import {assemblePatch} from "../modules/SceneTranslations.js";
import {DEFAULT_TEXT_LANG, isTranslated, textLangName, textLangPatch} from "../modules/TextLanguages.js";

await run(async () => {
    const lang = textLangName();
    if (!isTranslated(lang)) {
        throw new Error(`The "${lang}" text language is the game's own Japanese: there is nothing to assemble.`);
    }
    if (lang === DEFAULT_TEXT_LANG) {
        throw new Error(`"${lang}" is the text language every patch is rendered on top of, and it is a corpus`
            + " rather than a patch. Assembling over it would leave nothing underneath to show through.");
    }

    const {text, scenes, lines, skipped} = await assemblePatch(lang);
    if (!scenes) {
        throw new Error(`text_languages/${lang}/scenes/ holds no scene files yet, so there is nothing to`
            + " assemble. Translate one first -- npm run extract-scenes lays the work out.");
    }

    const patch = textLangPatch(lang);
    await fs.writeFile(patch, text, "utf-8");

    // The game's own message count, off a committed dump: no alice-tools, no
    // GAME_DIR, and no dependency on the scenes having been extracted.
    const japaneseByLineNumber = await loadGameJapanese();
    const total = japaneseByLineNumber.size;

    console.log(`Assembled ${scenes} scenes into ${path.relative(ROOT, patch)}`);
    console.log(`  ${lines} lines of ${total} (${(lines / total * 100).toFixed(2)}%),`
        + ` the rest left to "${DEFAULT_TEXT_LANG}"`);
    if (skipped) {
        console.log(`  ${skipped} lines had no English and were left unnamed on purpose`);
    }
    return 0;
});
