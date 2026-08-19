/**
 * Which text the game is built with: one of the translations, or the Japanese
 * it shipped with.
 *
 * A text language is data, not code: a directory under text_languages/ holding
 * the text -- either the two translation corpora or a finished dialogue.ain.txt
 * -- and, if it insists on spelling a name its own way, a
 * mistranslated_names.json layered over the shared one. Everything else -- the
 * cherry-picked system strings, the wrapping and the name repairs -- is the
 * same whichever is selected, so adding a translation is adding a folder.
 *
 * The game directory holds one Rance10.ain, so a build installs one text
 * language; switching is re-running the build with a different name.
 */
import * as fs from "fs";
import * as path from "path";
import {flagValue} from "./Argv.js";
import {BUILD, ROOT} from "./Env.js";

/** One folder per text language, each holding nothing but that text. */
export const TEXT_LANGS_DIR = path.join(ROOT, "text_languages");

export const DEFAULT_TEXT_LANG = "en_gpt";

export const listTextLangs = () => fs.readdirSync(TEXT_LANGS_DIR, {withFileTypes: true})
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort();

/**
 * The flag beats TEXT_LANG in .env, which beats the default -- so .env names
 * the one you build most and the flag is for the exception. Both
 * --text-lang=en_grok and --text-lang en_grok are read; modules/Argv.js says why.
 *
 * TRANSLATION_VARIANT was this variable's name until the flag, the folder and
 * the module were all renamed together. Left in the environment it would be
 * read by nothing and the build would quietly make the default instead, which
 * is a long way to go to find a renamed key -- so it is an error rather than
 * silence.
 */
export const textLangName = () => {
    if (process.env.TRANSLATION_VARIANT) {
        throw new Error("TRANSLATION_VARIANT is now TEXT_LANG, and the folders it names are under"
            + ` text_languages/: ${listTextLangs().join(", ")}. Rename the key in your .env.`);
    }
    const name = flagValue("text-lang") || process.env.TEXT_LANG || DEFAULT_TEXT_LANG;
    const available = listTextLangs();
    if (!available.includes(name)) {
        throw new Error(`There is no "${name}" text language. text_languages/ holds: ${available.join(", ")}.`);
    }
    return name;
};

export const textLangDir = (name) => path.join(TEXT_LANGS_DIR, name);

/**
 * A translation does not have to arrive as a corpus of chunks. One that was
 * written straight into the file alice-tools applies -- m[<line>] = "<text>",
 * the v1.04 line numbers already -- is a text language too, and this is where
 * the build looks for it. If the file is there it is that language's text and
 * the two chunk folders are not read; the rest of the pipeline does not change.
 */
export const textLangPatch = (name) => path.join(textLangDir(name), "dialogue.ain.txt");

export const hasPatch = (name) => fs.existsSync(textLangPatch(name));

/**
 * For the scripts that read or write the chunk files themselves, which have
 * nothing to work with in a text language that arrived as a finished patch.
 * Naming the reason beats the ENOENT they would otherwise die of.
 */
export const corpusDir = (name) => {
    if (hasPatch(name)) {
        throw new Error(`The "${name}" text language is a finished patch, ${textLangPatch(name)},`
            + ` rather than a corpus of chunk files. This script works on the chunks.`);
    }
    return textLangDir(name);
};

/**
 * One patch file per text language rather than one regenerated.ain.txt:
 * switching languages should not leave you looking at the other one's text, and
 * a failed generation should not pass off a stale file as the build you asked
 * for.
 *
 * Absolute, like every other path a module hands out, so that which directory
 * the build was started from is not one of the things that can go wrong. The
 * one caller that needs it relative -- alice-tools, which is handed the game's
 * own .ain the same way -- says so with path.relative.
 */
export const regeneratedTxt = (name) => path.join(BUILD, `regenerated.${name}.ain.txt`);
