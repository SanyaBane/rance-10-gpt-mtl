/**
 * Which text the game is built with: a translation, or the Japanese it
 * shipped with.
 *
 * A text language is data, not code: a directory under text_languages/ holding
 * the text -- either the two translation corpora or a finished dialogue.ain.txt
 * -- and, if it insists on spelling a name its own way, a
 * mistranslated_names.json layered over the shared one. Everything else -- the
 * cherry-picked system strings, the wrapping and the name repairs -- is the
 * same whichever is selected, so adding a translation is adding a folder.
 *
 * One of them holds no text at all. jp is the game's own Japanese, and what it
 * selects is the absence of a translation: the folder says so in its
 * text_language.js and the builds read that rather than looking for English
 * that was never there.
 *
 * The game directory holds one Rance10.ain, so a build installs one text
 * language; switching is re-running the build with a different name.
 */
import * as fs from "fs";
import * as path from "path";
import {pathToFileURL} from "url";
import {flagValue} from "./Argv.js";
import {BUILD, ROOT} from "./Env.js";
import {PATCH_TAG} from "./Version.js";

/** One folder per text language, each holding nothing but that text. */
export const TEXT_LANGS_DIR = path.join(ROOT, "text_languages");

/**
 * What a build renders when neither --text-lang nor TEXT_LANG names one, and
 * what a patch-shaped text language is rendered on top of.
 *
 * It was en_gpt until that language was removed -- the translation this
 * repository shipped from the beginning, kept in git under the en_gpt-final
 * tag and nowhere in the working tree. docs/text-languages.md says why and
 * how to read it back.
 */
export const DEFAULT_TEXT_LANG = "en_grok";

const MANIFEST = "text_language.js";

/**
 * A folder under text_languages/ read as one. The same arrangement features/
 * has, and for the same reason: a manifest that is a module can carry the
 * comments explaining itself, which for a translation is where it came from and
 * what it is allowed to differ in.
 */
const readTextLang = async (name) => {
    const manifest = path.join(TEXT_LANGS_DIR, name, MANIFEST);
    if (!fs.existsSync(manifest)) {
        throw new Error(`text_languages/${name} has no ${MANIFEST}, so nothing there says what that text is.`
            + " Every folder under text_languages/ is one text language.");
    }
    const {default: lang} = await import(pathToFileURL(manifest));
    if (!lang?.summary) {
        throw new Error(`text_languages/${name}/${MANIFEST} has no summary. It is the line the release listing`
            + " and the folder's README print, so a language without one has no way to say what it is.");
    }
    return [name, {summary: lang.summary, translated: lang.translated ?? false}];
};

/**
 * Every text language there is, by name. Sorted, because readdir's order is the
 * filesystem's and this decides the order a release folder is built in.
 */
export const TEXT_LANGS = Object.fromEntries(await Promise.all(fs.readdirSync(TEXT_LANGS_DIR, {withFileTypes: true})
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort()
    .map(readTextLang)));

export const listTextLangs = () => Object.keys(TEXT_LANGS);

/** Whether a build of this one applies any English at all. */
export const isTranslated = (name) => TEXT_LANGS[name].translated;

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
 * What this language's folder is called in a release: rance10-en_grok-v<version>,
 * where the version is whatever package.json says, through modules/Version.js.
 *
 * Every other name here is an identifier -- the folder under text_languages/,
 * the value --text-lang takes, the key in TEXT_LANGS -- and all of them are the
 * bare name. This one is not: each language is an asset of its own on the
 * releases page, zipped exactly as this folder stands, so what it is called
 * becomes the name of a file somebody downloads. It has to say which game,
 * which text and which patch without the page around it to explain, because a
 * month later it is a zip in a downloads folder and nothing else.
 *
 * Which is also why it is only ever an output. Nothing reads a folder by this
 * name, and --text-lang goes on taking the bare one -- the two must not be
 * confused, or somebody feeds the flag the folder they downloaded and is told
 * there is no such language.
 */
export const releaseFolder = (name) => `rance10-${name}-${PATCH_TAG}`;

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
    if (!isTranslated(name)) {
        throw new Error(`The "${name}" text language is the game's own Japanese: there is no text in`
            + ` ${path.relative(ROOT, textLangDir(name))} for this script to work on.`);
    }
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
