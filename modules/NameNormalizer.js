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

/**
 * Longest Japanese name first, and the longest of its misspellings first within
 * it, because the repair below applies every entry the line matches in turn and
 * a name can sit inside another name.
 *
 * 魔人討伐隊 holds 魔人, so with the short entry first "the Demon Lord subjugation
 * squad" becomes "the Fiend Lord subjugation squad" before the long entry ever
 * sees the line -- 82 lines of the corpus went that way. That was kept working
 * by ordering the file itself, an invariant nothing checked and which twelve of
 * the file's twenty-four nested pairs already broke; they cost nothing only
 * because their misspellings happen not to overlap. Sorting here says it once,
 * and the order the file is written in stops meaning anything.
 *
 * Two names of the same length still fall to the file's order, and that is not
 * an oversight this can fix: 魔人 and 魔軍 both claim "demon" on the lines that
 * name both, and which one should have it is a fact about the sentence rather
 * than about the table. The sort is stable, so those keep the order they are
 * written in.
 */
export const readNameTable = async (langDir) => {
    const table = layer(
        await readSharedNameTable(),
        await readOptionalTable(path.join(langDir, "mistranslated_names.json")),
    );
    table.forEach(char => char.knownMistranslations.sort((a, b) => b.length - a.length));
    return table.sort((a, b) => b.shortNameJpn.length - a.shortNameJpn.length);
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

    return (japanese) => {
        const found = table.filter(record => mentions(japanese, record.shortNameJpn));
        /*
         * The longest name wins where one contains another, the way
         * outermostTerms does it for the synopsis terms.
         *
         * 魔物大将軍 holds 大将軍, and their English shares no words at all: a
         * "Great Monster General" carries no "Great General" for the plain
         * substring test in createNameChecker to find. So the short entry
         * complained about twelve cherry-picked slots whose English was right.
         *
         * Strictly longer rather than merely different, because the table
         * carries alias pairs under one key -- リア is both "Lia" and "Queen
         * Lia", クルックー both "Crook" and "Ms. Crook". Those contain each
         * other in both directions, so a rule that only asked about containment
         * would drop one of each arbitrarily and silence five slots that should
         * still be reported.
         */
        return found.filter(record => !found.some(other =>
            other.shortNameJpn.length > record.shortNameJpn.length
            && other.shortNameJpn.includes(record.shortNameJpn)));
    };
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

const LETTER = /[A-Za-z]/;

/**
 * Whether adding an s is all this name's plural takes.
 *
 * The pass has always let a plural through by accident -- replacing "demon"
 * inside "demons" gave "Fiends", which is the right word -- and the boundary
 * check below would take that away from 250 lines. So the plural is allowed on
 * purpose instead, for the names where it is only an s: "Hanny" and "Monster
 * Army" pluralise as Hannies and Monster Armies, and those the check keeps
 * refusing rather than shipping the "Hannys" and "Monster Armys" it used to.
 */
const pluralisesWithS = (canonical) => !/(?:s|x|z|ch|sh|y)$/i.test(canonical);

/**
 * Swap a misspelling for the right name where the misspelling is a word, and
 * leave it alone where it is the opening of a longer one.
 *
 * A plain replaceAll does not know the difference, and the translation is full
 * of near misses that a listed misspelling opens: it spells スシヌ "Sushinu"
 * where the table wants "Sushinu the Gandhi" and lists the shorter "Sushi", so
 * 427 lines went out saying "Sushinu the Gandhinu". キャロリ turned "Caroli"
 * into "Caroliei" the same way, バボラ "Babolat" into "Babolata", ミル "Milk"
 * into "Millk" -- 843 lines of it altogether, produced silently at every build.
 *
 * Only the letter ends of a misspelling are guarded. Plenty of them open or
 * close on something else -- "<Ale>", "Ms. Crook", "Cave-bris" -- and a bracket
 * or a hyphen is a boundary already.
 *
 * What this cannot do is finish the repair: a line left saying "Caroli" is no
 * longer mangled but still is not "Carolie", and the way to fix that one is an
 * entry in the table rather than a cleverer match here.
 */
const replaceWords = (sentence, misspelling, canonical) => {
    const opensLetter = LETTER.test(misspelling[0]);
    const endsLetter = LETTER.test(misspelling[misspelling.length - 1]);
    const takesPlural = endsLetter && pluralisesWithS(canonical);
    let repaired = "";
    let from = 0;
    for (let at = sentence.indexOf(misspelling); at >= 0; at = sentence.indexOf(misspelling, from)) {
        const before = sentence[at - 1];
        const after = sentence[at + misspelling.length];
        // The s stays where it is: replacing the stem of "demons" leaves "Fiends".
        const plural = takesPlural && after === "s" && !LETTER.test(sentence[at + misspelling.length + 1] ?? "");
        const glued = !plural && ((opensLetter && before && LETTER.test(before))
            || (endsLetter && after && LETTER.test(after)));
        repaired += sentence.slice(from, at) + (glued ? misspelling : canonical);
        from = at + misspelling.length;
    }
    return repaired + sentence.slice(from);
};

/** The misspelling this entry would take out of the sentence, if any. */
const claimOf = (sentence, nameRecord) => sentence.includes(nameRecord.shortNameEng) ? null
    : nameRecord.knownMistranslations.find(mistranslation =>
        replaceWords(sentence, mistranslation, nameRecord.shortNameEng) !== sentence) ?? null;

/**
 * Two names of the same length reaching for the same words, which is the one
 * thing the ordering above cannot settle.
 *
 * 魔人 and 魔軍 are two characters each and both list "demon", so on the lines
 * that name both -- 魔軍は魔人ガルティアに率いられ -- whichever is written first
 * in the file takes it, and the other 36 lines get the answer that order
 * happens to give: "led by the Monster Army Galtya" where the Japanese says
 * 魔人ガルティア. Which "demon" belongs to which word is a fact about the
 * sentence, so there is no entry that fixes it and no order that is right for
 * both. The build says so out loud instead, and the line gets repaired where
 * the rest of the residue does, in the corpus.
 *
 * Entries sharing a Japanese name are left alone: クルックー is "Crook" and again
 * "Ms. Crook" on purpose, and ＜エール＞ is spelled by two entries in turn.
 */
const contestsOver = (claims) => {
    const complaints = [];
    for (let i = 0; i < claims.length; ++i) {
        for (let j = i + 1; j < claims.length; ++j) {
            const [a, claimedByA] = claims[i];
            const [b, claimedByB] = claims[j];
            if (a.shortNameJpn === b.shortNameJpn
                || a.shortNameJpn.length !== b.shortNameJpn.length
                || !(claimedByA.includes(claimedByB) || claimedByB.includes(claimedByA))) {
                continue;
            }
            complaints.push(`${a.shortNameJpn} ("${a.shortNameEng}") and ${b.shortNameJpn}`
                + ` ("${b.shortNameEng}") both claim ${JSON.stringify(claimedByA)}`);
        }
    }
    return complaints;
};

/**
 * The repair, and the lines it could not decide.
 *
 * contested is filled in as lines go through rather than returned per line:
 * every caller renders the whole corpus and then reports, the way
 * renderEnemyInfo hands back its overlong and misnamed lists.
 */
export const createNameNormalizer = async (langDir) => {
    const mistranslated_names = await readNameTable(langDir);
    const contested = [];

    const normalizeNames = (lineRecord) => {
        const original = lineRecord.translatedEnglishLine;
        let sentence = original;
        const claims = [];
        for (const nameRecord of mistranslated_names) {
            if (!lineRecord.originalJapaneseLine.includes(nameRecord.shortNameJpn)) {
                continue;
            }
            // Read against the line as it arrived: by the time a later entry is
            // reached the earlier ones have already taken their words out, and
            // what the report is about is who wanted them.
            const claimed = claimOf(original, nameRecord);
            if (claimed) {
                claims.push([nameRecord, claimed]);
            }
            const shortNameEng = nameRecord.shortNameEng;
            if (sentence.includes(shortNameEng)) {
                continue;
            }
            for (const mistranslation of nameRecord.knownMistranslations) {
                const beforeUpdate = sentence;
                sentence = replaceWords(sentence, mistranslation, shortNameEng);
                if (beforeUpdate !== sentence) {
                    break;
                }
            }
        }
        for (const complaint of contestsOver(claims)) {
            contested.push(`m[${lineRecord.lineNumber}] ${complaint} -- ${JSON.stringify(original)}`);
        }
        return sentence;
    };

    return {normalizeNames, contested};
};
