/**
 * Repairing how the translation spells character names.
 *
 * glossaries/mistranslated_names.json is not translation text but a repair pass run at
 * build time: where the Japanese line names a character and the English does
 * not spell them the canonical way, a known misspelling is swapped out. The
 * table is shared by every text language on purpose -- scripts/generate_card_names.js
 * reads the same file for the card plates, so a language that renamed people in its
 * dialogue alone would disagree with the cards its own build installs.
 *
 * A text language that wants to disagree anyway can put a mistranslated_names.json
 * next to its corpora. It is layered over the shared table by Japanese name,
 * so it only has to state what it wants different.
 */
import fs from "fs/promises";
import * as path from "path";
import {ROOT} from "./Env.js";

const readTable = async (filePath) => JSON.parse(await fs.readFile(filePath, "utf-8"));

const readOptionalTable = async (filePath) => {
    try {
        return await readTable(filePath);
    } catch (error) {
        if (error.code === "ENOENT") {
            return [];
        }
        throw error;
    }
};

/**
 * Overriding a name keeps the misspellings the shared table already knows --
 * they are the same wrong spellings whichever name you consider right, and a
 * text language should not have to copy the list to change the answer.
 *
 * The shared table gives a couple of Japanese names two entries -- クルックー is
 * both "Crook" and "Ms. Crook" -- so an override applies to every entry under
 * that name rather than collapsing them into one, which would quietly drop a
 * repair the build has always made.
 */
const layer = (shared, overrides) => {
    const overrideFor = new Map(overrides.map(record => [record.shortNameJpn, record]));
    const layered = shared.map(record => {
        const override = overrideFor.get(record.shortNameJpn);
        return !override ? record : {
            ...record,
            ...override,
            knownMistranslations: [...new Set([
                ...record.knownMistranslations,
                ...override.knownMistranslations ?? [],
            ])],
        };
    });
    const alreadyNamed = new Set(shared.map(record => record.shortNameJpn));
    return [...layered, ...overrides.filter(record => !alreadyNamed.has(record.shortNameJpn))];
};

/** The canonical spellings, shared by every text language and by the card plates. */
export const SHARED_NAMES = path.join(ROOT, "glossaries", "mistranslated_names.json");

export const readSharedNameTable = async () => readTable(SHARED_NAMES);

export const readNameTable = async (langDir) => {
    const table = layer(
        await readSharedNameTable(),
        await readOptionalTable(path.join(langDir, "mistranslated_names.json")),
    );
    table.forEach(char => char.knownMistranslations.sort((a, b) => b.length - a.length));
    return table;
};

const KATAKANA = /[゠-ヿ]/;

/**
 * Whether a Japanese line says this word, rather than merely containing its
 * characters.
 *
 * A katakana word only counts when it is not part of a longer run of katakana.
 * Without that, リア is in バリア, レイ is in ブレイク and フル is in
 * フルスペック, and three complaints out of five are noise -- which is how a
 * warning stops being read. The synopsis terms need it as badly as the names
 * do: オク, リッチ and スケール are free cities of two and three characters
 * apiece.
 *
 * It is the ends of the word that decide, not whether it holds katakana
 * anywhere: 裸イベント follows a character's name in 144 captions, and reading
 * the カチューシャ before it as a longer run would lose every one of them.
 */
export const mentions = (japanese, word) => {
    const opensKatakana = KATAKANA.test(word[0]);
    const endsKatakana = KATAKANA.test(word[word.length - 1]);
    for (let at = japanese.indexOf(word); at >= 0; at = japanese.indexOf(word, at + 1)) {
        const before = japanese[at - 1];
        const after = japanese[at + word.length];
        const glued = (opensKatakana && before && KATAKANA.test(before))
            || (endsKatakana && after && KATAKANA.test(after));
        if (!glued) {
            return true;
        }
    }
    return false;
};

/**
 * Which of the table's characters a Japanese line names.
 *
 * The shared table only: the files this serves are not dialogue, and a
 * language's overrides are its dialogue's business.
 */
export const createNameFinder = async () => {
    const table = (await readSharedNameTable()).filter(record => record.shortNameJpn.length >= 2);

    return (japanese) => table.filter(record => mentions(japanese, record.shortNameJpn));
};

/**
 * The same table read as a check rather than a repair, for the hand-written
 * glossaries -- glossaries/enemy_info_glossary.tsv, glossaries/race_name_glossary.tsv,
 * glossaries/summary_glossary.tsv -- which the repair pass above cannot help with.
 *
 * It cannot because it swaps a *known* misspelling for the right one, and what
 * a person writing a glossary produces is a plausible new one: ハニー came out
 * as "Honey", which is not the listed "honey" and so would have gone through
 * untouched and unmentioned. Absence of the canonical spelling is the signal
 * worth having, and there are few enough entries to say it out loud and let
 * somebody decide.
 */
export const createNameChecker = async () => {
    const names = await createNameFinder();

    return (japanese, english) => names(japanese)
        .filter(record => !english.toLowerCase().includes(record.shortNameEng.toLowerCase()))
        .map(record => `${japanese} is ${record.shortNameJpn}, which the game calls`
            + ` "${record.shortNameEng}" -- ${JSON.stringify(english)}`);
};

export const createNameNormalizer = async (langDir) => {
    const mistranslated_names = await readNameTable(langDir);

    return (lineRecord) => {
        let sentence = lineRecord.translatedEnglishLine;
        for (const nameRecord of mistranslated_names) {
            if (!lineRecord.originalJapaneseLine.includes(nameRecord.shortNameJpn)) {
                continue;
            }
            const shortNameEng = nameRecord.shortNameEng;
            if (sentence.includes(shortNameEng)) {
                continue;
            }
            for (const mistranslation of nameRecord.knownMistranslations) {
                const beforeUpdate = sentence;
                sentence = sentence.replaceAll(mistranslation, shortNameEng);
                if (beforeUpdate !== sentence) {
                    break;
                }
            }
        }
        return sentence;
    };
};
