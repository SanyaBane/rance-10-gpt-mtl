/**
 * Terminology drift, found without a table.
 *
 * Every check in this repository starts from a glossary, so a word nobody wrote
 * down is invisible. createNameChecker in modules/NameNormalizer.js knows the
 * names in glossaries/mistranslated_names.json; createTermChecker in
 * modules/SummaryLines.js knows the words in glossaries/summary_terms.tsv; a
 * title, a place or the word a role is called that is in neither gets no report
 * from anywhere, and terminology drifts exactly the way names do.
 *
 * This starts from the text instead. A term is a Japanese substring. Its
 * rendering is an English phrase that turns up almost only on the lines
 * carrying that substring -- "Supreme Leader" is on 972 lines and 953 of them
 * say 総統, which no dictionary had to say. Drift is a term with two such
 * phrases.
 *
 * It is not the same question scripts/find_dropped_terms.js asks. That one asks
 * whether a settled English word is *absent*, which cannot tell a line that
 * said the thing differently from a line that used a pronoun or a caption too
 * short to fit it: ラグナロックアーク is 44 dropped lines there, and that 27 of them
 * write "Ragnarock Ark" against the table's "Ragnarok Arc" is said nowhere. The
 * two are complementary and neither replaces the other.
 *
 * Nothing here is a verdict either. What it does is name both forms with their
 * counts and the files they come from, which is the readable half.
 */
import * as fs from "fs";
import * as path from "path";
import {AIN_TXT} from "./AinFiles.js";
import {ENEMY_INFO_GLOSSARY} from "./EnemyInfo.js";
import {ENEMY_PARTY_GLOSSARY} from "./EnemyPartyNames.js";
import {ROOT} from "./Env.js";
import {CARD_GLOSSARY} from "./Nameplates.js";
import {SHARED_NAMES} from "./NameNormalizer.js";
import {RACE_GLOSSARY} from "./RaceNames.js";
import {SUMMARY_GLOSSARY, SUMMARY_TERMS} from "./SummaryLines.js";
import {corpusDir} from "./TextLanguages.js";
import {TROPHY_BONUS_GLOSSARY, TROPHY_GLOSSARY} from "./TrophyNames.js";

/** The system text translated by hand, which no name or term check has ever run over. */
export const CHERRY_PICKS = path.join(ROOT, "patches", "system_cherry_picks.v1.04.ain.txt");

const KANJI = /[一-鿿々]/;
const KATAKANA = /[゠-ヿｦ-ﾟ]/;

/** Maximal runs of one script, which is what a Japanese term is written in. */
export const runsOf = (japanese) => {
    const runs = [];
    let current = "";
    let kind = null;
    for (const character of japanese) {
        const next = KANJI.test(character) ? "kanji" : KATAKANA.test(character) ? "kana" : null;
        if (next && next === kind) {
            current += character;
            continue;
        }
        if (current.length >= 2) {
            runs.push({text: current, kind});
        }
        current = next ? character : "";
        kind = next;
    }
    if (current.length >= 2) {
        runs.push({text: current, kind});
    }
    return runs;
};

/**
 * The terms a Japanese line could be said to carry.
 *
 * A kanji run genuinely nests -- 魔人討伐隊 holds 魔人 and 討伐隊, and both are
 * words -- so every substring of one is a candidate. A katakana run does not:
 * リア is inside バリア and ーリ is inside both チューリップ and ダーリン, which is
 * exactly what mentions() in modules/NameNormalizer.js refuses. So a katakana
 * term is the whole run, and the middle dot splits it because that is its job.
 */
export const candidatesIn = (japanese, longest = 6) => {
    const terms = new Set();
    for (const {text, kind} of runsOf(japanese)) {
        if (kind === "kana") {
            for (const part of text.split("・")) {
                if (part.length >= 2) {
                    terms.add(part);
                }
            }
            terms.add(text);
            continue;
        }
        for (let length = Math.min(longest, text.length); length >= 2; --length) {
            for (let at = 0; at + length <= text.length; ++at) {
                terms.add(text.slice(at, at + length));
            }
        }
    }
    return terms;
};

/**
 * The capitalised phrases of an English line, which is what a rendering looks
 * like in this translation.
 *
 * A hyphen joins a word only between letters. Written greedily it swallows the
 * dash rules the dialogue is full of, and "Supreme Leader----" then reads as a
 * phrase of its own rather than as "Supreme Leader". A stutter is the same word
 * said twice, so "P-Supreme" is Supreme.
 */
export const phrasesIn = (english, longest = 4) => {
    const phrases = new Set();
    const tokens = english.match(/[A-Za-z][A-Za-z'’]*(?:-[A-Za-z][A-Za-z'’]*)*|[^A-Za-z\s]+|\s+/g) ?? [];
    const words = [];
    let opening = true;
    for (const token of tokens) {
        if (/^\s+$/.test(token)) {
            continue;
        }
        if (/^[A-Za-z]/.test(token)) {
            words.push({word: token.replace(/^[A-Za-z]-(?=[A-Z])/, ""), free: !opening});
            opening = false;
            continue;
        }
        opening = /[.!?！？。…「『（(【[]/.test(token);
        words.push(null);
    }
    for (let at = 0; at < words.length; ++at) {
        if (!words[at] || !/^[A-Z]/.test(words[at].word)) {
            continue;
        }
        /*
         * One capital at the start of a phrase proves nothing -- after 「, after
         * a full stop, or at the start of a record every word carries one. A
         * second capital does prove something, because ordinary English
         * capitalises only the first word: "World Leader" opening a label is a
         * proper noun where "World" alone is not. Refusing both is what hid
         * s[10623], the one line the whole exercise was for.
         */
        let phrase = words[at].word;
        if (words[at].free) {
            phrases.add(phrase);
        }
        for (let length = 2; length <= longest && at + length <= words.length; ++length) {
            const next = words[at + length - 1];
            if (!next || !/^[A-Z]/.test(next.word)) {
                break;
            }
            phrase += ` ${next.word}`;
            phrases.add(phrase);
        }
    }
    return phrases;
};

/** Horaga, Horaga's, Horagas and Horaga-san are one name. */
const HONORIFIC = /-(?:san|kun|chan|sama|senpai|neesama|niisama|oniisama|dono|sensei)$/i;
const stem = (phrase) => phrase.replace(/['’]s$/, "").replace(HONORIFIC, "");
const singular = (word) => word.replace(/['’]s$/, "").replace(/ies$/, "y").replace(/(?:es|s)$/, "");

/**
 * A phrase compared on its bare words. Without it "Supreme Leader's Office"
 * does not hold "Supreme Leader", and eight lines of 総統 read as disagreements
 * while saying exactly what the term settled on.
 */
export const keyOf = (phrase) => stem(phrase).split(" ").map(singular).join(" ");
const holds = (whole, part) => ` ${keyOf(whole)} `.includes(` ${keyOf(part)} `);
const sameWord = (a, b) => keyOf(a) === keyOf(b);
const wordsOf = (phrase) => keyOf(phrase).split(" ").filter(word => word.length > 2);

const readGlossary = (file) => fs.readFileSync(file, "utf-8").split(/\r?\n/)
    .map((row, at) => ({row, number: at + 1}))
    .filter(({row}) => row.trim() && !row.startsWith("#"))
    .map(({row, number}) => {
        const [japanese, english] = row.split("\t");
        return {japanese, english: (english ?? "").trim(), number};
    })
    .filter(({japanese, english}) => japanese && english);

/**
 * The Japanese of every string slot, out of the dump game/ain/ already carries.
 *
 * docs/system-cherry-picks.md says to take this from a fresh alice ain dump -t,
 * on the grounds that the committed dump is messages only. It is not: the .json
 * is, and the .txt has all 15 770 slots commented out beside the messages, byte
 * for byte what a fresh dump writes. So nothing here needs alice-tools or
 * GAME_DIR to run.
 */
export const readSlotJapanese = () => {
    const bySlot = new Map();
    const dump = fs.readFileSync(AIN_TXT, "utf-8");
    for (const match of dump.matchAll(/^;s\[(\d+)\]\s*=\s*"((?:[^"\\\n]|\\.)*)"\r?$/gm)) {
        const slot = +match[1];
        const japanese = match[2].replace(/\\(.)/g, (_, character) =>
            character === "n" ? "\n" : character === "t" ? "\t" : character === "r" ? "\r" : character);
        const already = bySlot.get(slot);
        if (!already) {
            bySlot.set(slot, [japanese]);
        } else if (!already.includes(japanese)) {
            already.push(japanese);
        }
    }
    return bySlot;
};

/**
 * Every Japanese-and-English pair the patch is made of: the dialogue, the
 * hand-written glossaries, and the cherry-picked system strings paired with the
 * Japanese of the slot they overwrite.
 *
 * The cherry-picks matter here out of proportion to their size. They are the
 * one file createNameChecker has never run over at any build, they are appended
 * last so they beat the corpus, and both terms this was written to find --
 * 総統's "World Leader" and 大将軍's "Great Monster General" -- are in them.
 */
export const readDriftLines = (textLang) => {
    const lines = [];

    const root = corpusDir(textLang);
    // Last wins, the way alice-tools reads the rendered patch: the chunk ranges
    // overlap, so a line number carries two records and only one is played.
    const winner = new Map();
    for (const folder of ["gpt_outputs", "gpt_outputs_v104"]) {
        const dir = path.join(root, folder);
        for (const name of fs.readdirSync(dir).filter(file => file.endsWith(".json")).sort()) {
            const data = JSON.parse(fs.readFileSync(path.join(dir, name), "utf-8"));
            for (const record of data.output_parsed?.translationLines ?? []) {
                winner.set(`${folder}:${+record.lineNumber}`, {
                    japanese: record.originalJapaneseLine ?? "",
                    english: record.translatedEnglishLine ?? "",
                    source: "corpus",
                    where: `m[${record.lineNumber}]`,
                });
            }
        }
    }
    for (const line of winner.values()) {
        lines.push(line);
    }

    const slots = readSlotJapanese();
    for (const match of fs.readFileSync(CHERRY_PICKS, "utf-8").matchAll(/^s\[(\d+)\]\s*=\s*"((?:[^"\\\n]|\\.)*)"/gm)) {
        for (const japanese of slots.get(+match[1]) ?? []) {
            lines.push({japanese, english: match[2], source: "cherry-picks", where: `s[${match[1]}]`});
        }
    }

    for (const file of [SUMMARY_GLOSSARY, SUMMARY_TERMS, ENEMY_INFO_GLOSSARY, ENEMY_PARTY_GLOSSARY,
        RACE_GLOSSARY, TROPHY_GLOSSARY, TROPHY_BONUS_GLOSSARY, CARD_GLOSSARY]) {
        const name = path.basename(file);
        for (const row of readGlossary(file)) {
            lines.push({japanese: row.japanese, english: row.english, source: name, where: `${name}:${row.number}`});
        }
    }
    return lines;
};

/**
 * Two phrases are one rendering when a third holds them both, or when they
 * differ only by a plural, a possessive or an honorific.
 *
 * Without this the loudest finding is "Fiend Extermination" against
 * "Extermination Squad", which is one phrase seen through a four-word window.
 */
const mergePhrases = (found) => {
    const parent = found.map((_, at) => at);
    const rootOf = (at) => (parent[at] === at ? at : (parent[at] = rootOf(parent[at])));
    for (let a = 0; a < found.length; ++a) {
        for (let b = 0; b < found.length; ++b) {
            if (a !== b && (holds(found[b].phrase, found[a].phrase) || sameWord(found[a].phrase, found[b].phrase))) {
                parent[rootOf(a)] = rootOf(b);
            }
        }
    }
    const groups = new Map();
    for (let at = 0; at < found.length; ++at) {
        const root = rootOf(at);
        groups.set(root, [...(groups.get(root) ?? []), found[at]]);
    }
    return [...groups.values()].map(group => {
        /*
         * Named by the longest form that still covers the group. The most
         * supported member is often one generic word -- 総統's group is led by a
         * bare "Leader" on 971 lines against "Supreme Leader"'s 953 -- and a
         * rendering called "Leader" matches "World Leader" too, which is the
         * one line worth finding.
         */
        const widest = Math.max(...group.map(one => one.where.length));
        const named = group.filter(one => one.where.length >= widest * 0.9)
            .sort((a, b) => b.phrase.length - a.phrase.length || b.where.length - a.where.length)[0];
        const where = new Set(group.flatMap(one => one.where));
        return {phrase: named.phrase, support: where.size, where, members: new Set(group.map(one => one.phrase))};
    });
};

/**
 * Both reports.
 *
 * Two of them, because drift has two shapes and one filter cannot see both.
 * split is a term rendered two ways at scale, which finds a scene translated
 * the other way. odd is a term that has settled and the handful of lines that
 * disagree with it -- the shape 総統 has, where 1044 lines of 1155 say Supreme
 * Leader and the minority is one slot, which no count-based filter will ever
 * surface.
 */
export const findTermDrift = (lines, options = {}) => {
    const {
        least = 25, most = 8000, precision = 0.85, support = 4, coverage = 0.35, settled = 0.6,
    } = options;

    const termCount = new Map();
    const phraseCount = new Map();
    const termsPer = [];
    const phrasesPer = [];
    for (const line of lines) {
        const terms = candidatesIn(line.japanese);
        const phrases = phrasesIn(line.english);
        termsPer.push(terms);
        phrasesPer.push(phrases);
        for (const term of terms) {
            termCount.set(term, (termCount.get(term) ?? 0) + 1);
        }
        for (const phrase of phrases) {
            phraseCount.set(phrase, (phraseCount.get(phrase) ?? 0) + 1);
        }
    }
    const liveTerms = new Set([...termCount].filter(([, n]) => n >= least && n <= most).map(([term]) => term));
    const livePhrases = new Set([...phraseCount].filter(([, n]) => n >= support).map(([phrase]) => phrase));

    const linesOfTerm = new Map();
    const pairs = new Map();
    for (let at = 0; at < lines.length; ++at) {
        const terms = [...termsPer[at]].filter(term => liveTerms.has(term));
        for (const term of terms) {
            linesOfTerm.set(term, [...(linesOfTerm.get(term) ?? []), at]);
        }
        const phrases = [...phrasesPer[at]].filter(phrase => livePhrases.has(phrase));
        for (const term of phrases.length ? terms : []) {
            const byPhrase = pairs.get(term) ?? new Map();
            pairs.set(term, byPhrase);
            for (const phrase of phrases) {
                byPhrase.set(phrase, [...(byPhrase.get(phrase) ?? []), at]);
            }
        }
    }

    const renderingsOf = (term) => {
        const kept = [];
        for (const [phrase, where] of pairs.get(term) ?? []) {
            if (where.length >= support && where.length / phraseCount.get(phrase) >= precision) {
                kept.push({phrase, where});
            }
        }
        const merged = mergePhrases(kept);
        return merged
            .filter(one => !merged.some(other =>
                other !== one && holds(other.phrase, one.phrase) && other.support >= one.support * 0.6))
            .sort((a, b) => b.support - a.support);
    };

    const split = [];
    const odd = [];
    for (const term of pairs.keys()) {
        const renderings = renderingsOf(term);
        if (!renderings.length) {
            continue;
        }
        const all = linesOfTerm.get(term) ?? [];

        if (renderings.length >= 2) {
            const covered = new Set(renderings.flatMap(one => [...one.where])).size;
            if (covered / termCount.get(term) >= coverage) {
                split.push({term, total: termCount.get(term), covered, renderings});
            }
        }

        const top = renderings[0];
        // Carrying the settled rendering means carrying that phrase, not one
        // word of it: "World Leader" is not "Supreme Leader".
        const carries = (at) => [...phrasesPer[at]].some(phrase => phrase === top.phrase || holds(phrase, top.phrase));
        const agreeing = all.filter(carries);
        if (agreeing.length / all.length < settled) {
            continue;
        }
        const words = new Set(wordsOf(top.phrase));
        const disagreeing = [];
        for (const at of all) {
            if (carries(at)) {
                continue;
            }
            for (const phrase of phrasesPer[at]) {
                /*
                 * A phrase that merged into the settled rendering is that
                 * rendering, and one built only out of its words is it with
                 * something on the end -- "Mouri's" against "Mouri Army". What
                 * is worth reading brings a word the settled form does not have.
                 */
                if (top.members.has(phrase) || sameWord(phrase, top.phrase) || holds(top.phrase, phrase)) {
                    continue;
                }
                const words2 = wordsOf(phrase);
                if (!words2.some(word => words.has(word)) || words2.every(word => words.has(word))) {
                    continue;
                }
                disagreeing.push({at, phrase});
                break;
            }
        }
        if (disagreeing.length) {
            odd.push({term, total: all.length, top, settled: agreeing.length, disagreeing});
        }
    }
    return {split, odd, lines};
};

/**
 * The longest term of every group saying the same thing. 魔人討伐隊, 魔人討伐 and
 * 人討伐隊 are one finding reported thirteen times over.
 */
export const dedupe = (findings, keyFor) => {
    const groups = new Map();
    for (const finding of findings) {
        const key = keyFor(finding);
        groups.set(key, [...(groups.get(key) ?? []), finding]);
    }
    return [...groups.values()]
        .map(group => group.sort((a, b) => b.term.length - a.term.length || b.total - a.total)[0]);
};

/**
 * Which table, if any, already has a word for this term.
 *
 * Names are separated rather than dropped. They have their own table and their
 * own pass -- but a name drifting in a spelling that table does not list is
 * exactly what nothing else reports, so it is worth its own heading rather than
 * silence.
 */
export const createBucketer = () => {
    const names = new Set(JSON.parse(fs.readFileSync(SHARED_NAMES, "utf-8")).map(record => record.shortNameJpn));
    for (const row of readGlossary(CARD_GLOSSARY)) {
        names.add(row.japanese);
    }
    const terms = new Set(readGlossary(SUMMARY_TERMS).map(row => row.japanese));
    const nameList = [...names];
    const termList = [...terms];
    return (term) => nameList.some(key => key.includes(term) || term.includes(key)) ? "named"
        : termList.some(key => key.includes(term) || term.includes(key)) ? "tabled"
            : "untabled";
};
