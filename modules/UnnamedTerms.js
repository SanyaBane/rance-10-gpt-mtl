/**
 * The words a translator is about to invent an English for.
 *
 * modules/TermDrift.js asks whether the patch already calls one Japanese word
 * two English things. That question needs the word to have been translated
 * twice, which means it needs the translation to exist. A retranslation asks it
 * the other way round and asks it *first*: which Japanese words are about to be
 * handed to somebody with no English attached at all.
 *
 * The failure it is for is one scene wide. modules/ScenePrompt.js cuts a
 * glossary slice per scene and prints the rows that scene names; a word no row
 * covers is simply absent from the prompt, and the translator writes something
 * plausible. Three agents in a row invented three different Englishes for
 * 聖女の子モンスター that way, while glossaries/summary_terms.tsv had settled
 * 聖女モンスター all along and the substring did not match. ホルス came back the
 * same in all three, which is luck rather than a process, and 大陸 came back
 * lower case in all three.
 *
 * All four were found by a person reading one scene's output. There are 5433
 * scenes.
 *
 * ## What a finding is
 *
 * A term is a Japanese substring, the same candidates TermDrift generates, plus
 * the Latin runs the game writes in the middle of Japanese -- JAPAN and LP7年
 * are terms and no kanji or kana rule reaches them.
 *
 * A term is **blind in a scene** when nothing that scene's prompt carries says
 * anything about it: no glossary row whose key the speech mentions, and no cast
 * line. The cast counts because it is a glossary of its own -- it prints every
 * speaker's Japanese beside the English name to write -- and it is what takes
 * 志津香 from 173 scenes down to 58. Blindness is counted per scene rather than
 * per line on purpose: a word said forty times in one scene is one decision, and
 * a word said once in each of forty scenes is forty.
 *
 * A term's **rendering** is what the draft translation calls it, measured the
 * way TermDrift measures one: a capitalised phrase that turns up almost only on
 * the lines carrying the term. That is the cut that makes this readable at all.
 * Without it the report is 5741 terms and its top is 出来, 本当, 人間, 自分 --
 * ordinary Japanese, which no glossary will ever have a row for and none should.
 * With it, it is a couple of hundred, and they are proper nouns.
 *
 * ## What it does not find, which is the same shape TermDrift does not find
 *
 * A word that is an ordinary noun in Japanese *and* an ordinary noun in English
 * has no capital to be found by. 大陸 is the Continent of this world and the
 * draft writes "the continent" 80 times without ever varying it; 世界 is the
 * world and always will be. Nothing in the text separates the two, and this
 * report keeps neither. See docs/unnamed-terms.md -- 大陸 is this report's 鬼.
 */
import * as fs from "fs";
import * as path from "path";
import {ENEMY_INFO_GLOSSARY} from "./EnemyInfo.js";
import {ENEMY_PARTY_GLOSSARY} from "./EnemyPartyNames.js";
import {mentions, readSharedNameTable} from "./NameNormalizer.js";
import {CARD_GLOSSARY} from "./Nameplates.js";
import {PLACE_GLOSSARY} from "./PlaceNames.js";
import {RACE_GLOSSARY} from "./RaceNames.js";
import {SUBSTITUTIONS} from "./SceneAcceptance.js";
import {parseSceneFile, speechesOf} from "./SceneFile.js";
import {sceneDir} from "./SceneIndex.js";
import {SUMMARY_GLOSSARY, SUMMARY_TERMS} from "./SummaryLines.js";
import {candidatesIn, compoundOf, phrasesIn, readGlossary} from "./TermDrift.js";
import {TROPHY_BONUS_GLOSSARY, TROPHY_GLOSSARY} from "./TrophyNames.js";

/**
 * The three tables modules/ScenePrompt.js cuts a scene's slice from, plus the
 * name table it reads through createNameFinder. A row here reaches the person
 * translating; a row anywhere else does not.
 */
const SLICE_FILES = [CARD_GLOSSARY, PLACE_GLOSSARY, SUMMARY_TERMS];

/**
 * The glossaries a prompt never opens. They are read anyway, because "the
 * repository has no word for this" and "the repository has a word the
 * translator cannot see" are different findings with different repairs, and the
 * second is a copy of one row.
 */
const OTHER_FILES = [SUMMARY_GLOSSARY, ENEMY_INFO_GLOSSARY, ENEMY_PARTY_GLOSSARY, RACE_GLOSSARY,
    TROPHY_GLOSSARY, TROPHY_BONUS_GLOSSARY];

/** Latin inside Japanese: ＪＡＰＡＮ, LP7年, ＩＦ, DD. Half-width and full-width both. */
const LATIN = /[A-Za-zＡ-Ｚａ-ｚ]{2,}/g;

/**
 * A katakana run that is only punctuation is not a word. ・・ and ・・・ are the
 * dialogue's own dot leaders, and they turn up in 653 scenes apiece with the
 * whole cast's names as their "rendering".
 */
const KANA_ONLY = /^[゠-ヿ]+$/;
const REAL_KANA = /[ァ-ヴｦ-ﾝ]/;

/**
 * The English first person is a capital in the middle of a sentence and means
 * nothing by it. It is the one word ordinary English capitalises anywhere, so
 * phrasesIn cannot tell it from a proper noun: without this, 俺様 is reported in
 * 999 scenes with "I" x428 as its rendering, and so is every other pronoun.
 */
const PRONOUN = /^I(?:['’]|$)/;

/** The terms a speech could be said to carry. */
export const termsOf = (japanese) => {
    const terms = [...candidatesIn(japanese)]
        .filter(term => !KANA_ONLY.test(term) || REAL_KANA.test(term));
    for (const run of japanese.match(LATIN) ?? []) {
        terms.push(run);
    }
    /*
     * Not the tokens the game substitutes at runtime. modules/ScenePrompt.js
     * keeps ＜エール＞ out of the slice deliberately -- it is the name the player
     * typed, and a row telling a translator to write "El" for it is the bug
     * docs/scene-driver.md records -- so its absence from the slice is not a
     * gap this should report.
     */
    return terms.filter(term => !SUBSTITUTIONS.some(token => token.includes(term)));
};

/** What the draft calls things, with the pronoun taken out. */
export const phrasesOf = (english) => [...phrasesIn(english)].filter(phrase => !PRONOUN.test(phrase));

/**
 * The scene files, one entry per scene: what its cast list says and what is
 * said in it.
 *
 * Speeches rather than rows. A row break is where Japanese typesetting fell at
 * twenty-four full-width characters, so a term that straddles one is invisible
 * to anything reading a row at a time -- which is the wrap that hid the second
 * Fiend War in docs/terminology-drift.md.
 */
export const readSceneCorpus = (textLang) => {
    const dir = sceneDir(textLang);
    let names;
    try {
        names = fs.readdirSync(dir);
    } catch (error) {
        if (error.code !== "ENOENT") {
            throw error;
        }
        throw new Error(`There are no scene files under ${dir}.`
            + " They are written by npm run extract-scenes, and build/ is gitignored:"
            + ` run "npm run extract-scenes -- --text-lang=${textLang}" first.`);
    }
    return names.filter(name => name.endsWith(".tsv")).sort().map(name => {
        const scene = parseSceneFile(fs.readFileSync(path.join(dir, name), "utf-8"));
        return {
            id: name.slice(0, -".tsv".length),
            name: scene.name,
            // The stand name, which is the Japanese the cast line is keyed by.
            cast: scene.cast.map(member => member.stand).filter(stand => stand.length >= 2),
            speeches: speechesOf(scene).filter(speech => speech.japanese)
                .map(speech => ({japanese: speech.japanese, english: speech.english})),
        };
    });
};

/**
 * Every Japanese key any glossary is written against, split by whether a scene
 * prompt can reach it.
 *
 * Keyed by the Japanese, which is the only key these tables share -- the point
 * docs/enemy-status-lines.md makes for a different reason.
 */
export const readCoverKeys = async () => {
    const slice = new Set();
    for (const file of SLICE_FILES) {
        for (const row of readGlossary(file)) {
            slice.add(row.japanese);
        }
    }
    for (const record of await readSharedNameTable()) {
        slice.add(record.shortNameJpn);
    }
    const other = new Map();
    for (const file of OTHER_FILES) {
        for (const row of readGlossary(file)) {
            if (!slice.has(row.japanese) && !other.has(row.japanese)) {
                other.set(row.japanese, path.basename(file));
            }
        }
    }
    return {
        slice: [...slice].filter(key => key.length >= 2),
        other: [...other].filter(([key]) => key.length >= 2),
    };
};

/**
 * Which of these keys a Japanese line mentions.
 *
 * Indexed by first character, because the alternative is six thousand keys
 * against a hundred and sixty thousand speeches and a report that takes a
 * minute and a half to say the same thing.
 */
const keyFinder = (keys) => {
    const byFirst = new Map();
    for (const key of keys) {
        const first = (Array.isArray(key) ? key[0] : key)[0];
        byFirst.set(first, [...(byFirst.get(first) ?? []), key]);
    }
    return (japanese) => {
        const found = [];
        for (const character of new Set(japanese)) {
            for (const key of byFirst.get(character) ?? []) {
                if (mentions(japanese, Array.isArray(key) ? key[0] : key)) {
                    found.push(key);
                }
            }
        }
        return found;
    };
};

/**
 * Does this key say anything about this term.
 *
 * Either way round. A key inside the term covers it -- 法王特典 answers 法王
 * where the line carries the whole compound -- and a term inside the key covers
 * it too, which is how 子供志津香 on a cast line answers 志津香. What is not
 * covered is the case both directions miss: a key and a term that overlap
 * without containing each other, which is 聖女モンスター against the game's own
 * 聖女の子モンスター, and is the whole reason this file exists.
 */
const saysSomething = (keys, term) => keys.some(key => key.includes(term) || term.includes(key));

/**
 * @param {ReturnType<readSceneCorpus>} scenes
 * @param {Awaited<ReturnType<readCoverKeys>>} keys
 * @param {{least?: number, support?: number, precision?: number, coverage?: number}} [options]
 */
export const findUnnamedTerms = (scenes, keys, options = {}) => {
    const {least = 7, support = 4, precision = 0.85, coverage = 0.35} = options;
    const sliceIn = keyFinder(keys.slice);
    const otherIn = keyFinder(keys.other);

    /*
     * Pass one: how far every term and every phrase reaches. The floor comes
     * off here so that pass two carries phrase counts for a few thousand terms
     * rather than for sixty thousand.
     */
    const termScenes = new Map();
    const phraseCount = new Map();
    for (const scene of scenes) {
        const here = new Set();
        for (const speech of scene.speeches) {
            for (const term of termsOf(speech.japanese)) {
                here.add(term);
            }
            for (const phrase of phrasesOf(speech.english)) {
                phraseCount.set(phrase, (phraseCount.get(phrase) ?? 0) + 1);
            }
        }
        for (const term of here) {
            termScenes.set(term, (termScenes.get(term) ?? 0) + 1);
        }
    }
    const live = new Set([...termScenes].filter(([, n]) => n >= least).map(([term]) => term));

    // Pass two: what each scene's own prompt would have covered.
    const stat = new Map();
    for (const scene of scenes) {
        for (const speech of scene.speeches) {
            const terms = new Set(termsOf(speech.japanese).filter(term => live.has(term)));
            if (!terms.size) {
                continue;
            }
            const phrases = phrasesOf(speech.english).filter(phrase => phraseCount.get(phrase) >= support);
            const inSlice = sliceIn(speech.japanese);
            const inOther = otherIn(speech.japanese);
            for (const term of terms) {
                const record = stat.get(term) ?? {
                    scenes: new Set(), blind: new Set(), unknown: new Set(), said: 0, blindSaid: 0,
                    phrases: new Map(), blindPhrases: new Map(), japaneses: [], where: [],
                    elsewhere: new Set(),
                };
                stat.set(term, record);
                record.scenes.add(scene.id);
                ++record.said;
                for (const phrase of phrases) {
                    record.phrases.set(phrase, (record.phrases.get(phrase) ?? 0) + 1);
                }
                if (saysSomething(scene.cast, term) || saysSomething(inSlice, term)) {
                    continue;
                }
                record.blind.add(scene.id);
                ++record.blindSaid;
                for (const phrase of phrases) {
                    record.blindPhrases.set(phrase, (record.blindPhrases.get(phrase) ?? 0) + 1);
                }
                const answering = inOther.filter(([key]) => key.includes(term) || term.includes(key));
                if (!answering.length) {
                    record.unknown.add(scene.id);
                } else {
                    for (const [, file] of answering) {
                        record.elsewhere.add(file);
                    }
                }
                if (record.japaneses.length < 120) {
                    record.japaneses.push({japanese: speech.japanese, phrases});
                }
                if (record.where.length < 40) {
                    record.where.push({scene: scene.id, japanese: speech.japanese, english: speech.english});
                }
            }
        }
    }

    const findings = [];
    for (const [term, one] of stat) {
        if (one.blind.size < least) {
            continue;
        }
        /*
         * A rendering is measured over every speech carrying the term, so that
         * a name keeps the one the covered scenes gave it -- 志津香 is blind in
         * 58 scenes of 173 and "Shizuka" is what the other 115 call her.
         *
         * How far it *reaches* is measured over the blind ones alone, and that
         * is the difference between a word and a word inside a compound. 都市
         * renders "Free Cities" 301 times and every one of them is 自由都市連合,
         * which summary_terms.tsv settled and the slice hands over; what is left
         * blind is 195 scenes calling a city a city. Counting reach over all of
         * them reported 都市, 自由, 大将, 討伐 and 将軍 -- five compounds already
         * answered, read one component at a time.
         */
        const renderings = [...one.phrases]
            .filter(([phrase, n]) => n >= support && n / phraseCount.get(phrase) >= precision)
            .sort((a, b) => b[1] - a[1]);
        const covers = renderings.length
            ? Math.max(...renderings.map(([phrase]) => one.blindPhrases.get(phrase) ?? 0)) / Math.max(1, one.blindSaid)
            : 0;
        /*
         * The longest string every speech carrying the rendering shares, which
         * is the word when the term is only a window onto one: 天王 and 四天 are
         * both 四天王, 令部 and 司令 are both 司令部. Asked of the speeches
         * carrying the rendering rather than of every blind one, because that
         * is the question -- which Japanese the English belongs to -- and
         * because a term that also stands alone somewhere would otherwise
         * report itself and the nest would stay unfolded.
         */
        const carrying = (renderings.length
            ? one.japaneses.filter(at => at.phrases.includes(renderings[0][0]))
            : one.japaneses).map(at => at.japanese);
        findings.push({
            term,
            compound: carrying.length ? compoundOf(term, carrying) : term,
            scenes: one.scenes.size,
            blind: one.blind.size,
            unknown: one.unknown.size,
            said: one.said,
            covers,
            renderings,
            elsewhere: [...one.elsewhere],
            where: one.where,
            // Used only to fold two windows onto one word together.
            blindScenes: one.blind,
        });
    }
    return findings;
};

/**
 * One word reported once.
 *
 * Two folds, and they take different things. Terms blind in exactly the same
 * scenes are one word seen through several windows and are grouped by the
 * compound they share. Then a term whose blind scenes are almost a subset of a
 * longer term's already kept ones is that longer term with a letter off the
 * end -- 北条早 under 北条早雲, 毛利元 under 毛利.
 */
export const foldTerms = (findings, {overlap = 0.7} = {}) => {
    const groups = new Map();
    for (const finding of findings) {
        const key = `${finding.compound} ${[...finding.blindScenes].sort().slice(0, 8).join(",")}`;
        groups.set(key, [...(groups.get(key) ?? []), finding]);
    }
    const best = [...groups.values()].map(group =>
        group.sort((a, b) => b.term.length - a.term.length || b.scenes - a.scenes)[0]);

    best.sort((a, b) => b.blind - a.blind || b.term.length - a.term.length);
    const kept = [];
    for (const finding of best) {
        const swallowed = kept.some(other => {
            if (!other.term.includes(finding.term) && !finding.term.includes(other.term)) {
                return false;
            }
            let shared = 0;
            for (const scene of finding.blindScenes) {
                shared += other.blindScenes.has(scene) ? 1 : 0;
            }
            return shared >= Math.min(finding.blind, other.blind) * overlap;
        });
        if (!swallowed) {
            kept.push(finding);
        }
    }
    return kept;
};

/**
 * Which repair a finding wants.
 *
 * "unknown" is a decision: nothing in the repository has a word for this, and
 * whoever takes it should read docs/terminology-drift.md on where the answer
 * usually already is -- the .x tables and the wiki settled two thirds of the
 * untabled bucket there without anybody deciding anything.
 *
 * "unsliced" is a copy: some glossary has the word and the prompt cannot reach
 * it, so the repair is one row in glossaries/summary_terms.tsv. Not the file
 * that already has it -- the slice is cut from three tables and nothing else,
 * and widening it is a change to every prompt.
 */
export const bucketOf = (finding) => (finding.unknown >= finding.blind / 2 ? "unknown" : "unsliced");
