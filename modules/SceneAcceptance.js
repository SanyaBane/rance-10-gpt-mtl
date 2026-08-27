/**
 * Deciding whether a translated scene may be written back.
 *
 * A scene is the unit: all of it is accepted or none of it is. That is not
 * tidiness, it is the only shape that makes a declined translation harmless.
 * The game is handed one English line per m[] number, so a scene that came back
 * short does not lose its tail -- it shifts it, and every line after the gap
 * goes out under the previous line's number. 158 lines of six scenes played one
 * line out of step that way until eec7f479, and that was a merge in the corpus
 * rather than a translator stopping halfway.
 *
 * Which is the case this exists for. A translator asked to render Rance 10 will
 * decline some of it, and the failure worth designing against is not the clean
 * refusal -- it is the scene that runs as ordinary dialogue for two hundred
 * lines, turns explicit, and comes back translated up to that point. There is
 * nothing in the text of such an answer that says it stopped early. Only the
 * line numbers say so, so the line numbers are what is checked.
 *
 * Refusals are recognised by structure, never by scanning the translation for
 * apologetic phrases: a line of dialogue is free to say anything, and a phrase
 * list run over the cells would eventually throw away a good scene because a
 * character said the wrong sentence. What gets looked at is only the part of
 * the answer that did not parse as rows.
 *
 * The file format itself is modules/SceneFile.js. This module only judges.
 */
import {PLAYERS_CHOICE} from "./CharacterGenders.js";
import {speechesOf, unescapeCell} from "./SceneFile.js";

/** "N<tab>english", or the four-column form when a translator echoes the input. */
const ROW = /^(\d+)\t(.*)$/;

/**
 * A translated line may not carry a raw tab or a line break: the first moves
 * every column after it when the scene is written back, and the second turns
 * one line into two.
 */
const CONTROL = /[\t\r\n]/;

/**
 * How much longer than its draft an accepted line may get before it is worth
 * a second look. Generous on purpose -- English runs wider than Japanese and a
 * short line runs wider still -- because this is a warning and not a verdict.
 */
const LONGER_THAN_DRAFT = 3;

/**
 * Text the game replaces at runtime, which a translation has to carry through
 * rather than resolve.
 *
 * ＜エール＞ is the name the player types at the エール入力画面 -- GameChapter2@Init
 * registers it into the game context, and 1522 lines of dialogue are written
 * around it. The existing draft resolved every one of them to the literal "El",
 * so a player who named their character anything else read somebody else's name
 * 1522 times. Nothing about that is visible in the English on its own, which is
 * exactly why it survived a whole translation; the corpus carries the token
 * again, on 1504 of the 1522, and docs/player-name-token.md is what the other
 * eighteen are.
 *
 * A named list rather than a rule about ＜…＞ generally, because the game writes
 * its sound effects that way too -- ＜コンコン……＞ is a knock at the door, 679
 * distinct ones, and those are meant to be translated inside the brackets.
 * Being inline rather than a line of its own does not separate them either: 76
 * tokens only ever appear inline and 75 of those are onomatopoeia. The four
 * other bracketed literals in the code -- ＜ナギ＞, ＜志津香＞, ＜ケイブニャン＞,
 * ＜ケイブワン＞ -- belong to AssistantMessageView's colouring and appear in no
 * line of dialogue at all.
 *
 * Exported because modules/ScenePrompt.js has to keep these out of the glossary
 * it shows a translator. glossaries/mistranslated_names.json carries ＜エール＞
 * as a name spelled "El" -- which is right for the repairs it was written for
 * and flatly contradicts the rule in the same prompt saying to carry the token
 * through untouched. One list, so the two cannot drift.
 */
export const SUBSTITUTIONS = ["＜エール＞"];

/**
 * Punctuation, which two lines of a gender branch differ in without differing.
 *
 * 「…………。」 against 「…………」 is 19 of the 25 pairs the current draft renders
 * identically, and every one of them is right to: the game's two routes really
 * do say the same nothing.
 */
const PUNCTUATION = /[「」（）｛｝【】、。！？…‥・゛゜\s]/g;

/**
 * Whether two lines of a gender branch differ in something English can carry.
 *
 * Two things are deliberately not a difference. Punctuation, above. And the
 * last character of the line, which in Japanese is where the sentence-final
 * particle sits and where a great deal of gendered speech lives: 置いてあるぞ
 * against 置いてあるよ is the same sentence said by a man and by a woman, and no
 * English renders it twice. 兄様 against 姉様, 弟 against 妹, 童貞 against 処女
 * are all differences in the body of the line, and those are the ones a
 * translation has to keep.
 */
/**
 * An English word that says whether somebody is a man or a woman.
 *
 * Deliberately not every such word. "king", "queen" and "guy" were in an earlier
 * draft of this list and every one of their hits was about somebody else --
 * "the Demon King's child", "Man, El," -- which is how a warning stops being
 * read. What is here is the pronouns and the words that attach to a name: the
 * honorific ＜エール＞様 rendered as "Lady El" is the single commonest way the
 * existing draft gives El a gender, fourteen times over.
 */
const GENDERED = /\b(he|him|his|himself|she|her|hers|herself|lady|lord|sir|madam|mistress|mister|brother|sister|son|daughter|boy|girl|woman|prince|princess)\b/i;

const differsMaterially = (a, b) => {
    const left = a.replace(PUNCTUATION, "");
    const right = b.replace(PUNCTUATION, "");
    if (left === right) {
        return false;
    }
    return left.length !== right.length || left.slice(0, -1) !== right.slice(0, -1);
};

/**
 * Hold what came back against the scene it was asked about.
 *
 * @param {import("./SceneFile.js").parseSceneFile} scene the source scene
 * @param {string} returned the translator's answer, "N<tab>english" per line
 * @return {{
 *     accepted: boolean,
 *     declined: boolean,
 *     english: Map<number, string>,
 *     problems: string[],
 *     warnings: string[],
 * }}
 */
export const acceptTranslation = (scene, returned) => {
    const problems = [];
    const warnings = [];
    const english = new Map();
    const duplicated = [];
    const unasked = [];
    /** Everything that was not a row, which is where a refusal would be. */
    const prose = [];

    /*
     * Keyed by the speech rather than by the row, because the speech is the
     * unit the translation is asked for and stored in: its rows are where
     * Japanese typesetting fell, and modules/SpeechRows.js puts the English
     * back into them at assembly. The number is the speech's first row, which
     * is the number the answer comes back under and the number a missing
     * speech would shift everything after.
     */
    const speeches = speechesOf(scene);
    const expected = new Map(speeches.map(speech => [speech.lineNumber, speech]));

    for (const line of returned.split(/\r?\n/)) {
        if (!line.trim()) {
            continue;
        }
        const cells = line.split("\t");
        // A translator handed the scene file's columns sometimes gives them
        // back. The number is still first and the English still last, so that
        // is readable; anything else is not a row. Four and five both, because
        // the file grew a column for what the portrait is doing and an answer
        // echoing the old shape is still an answer.
        const row = (cells.length === 4 || cells.length === 5) && /^\d+$/.test(cells[0])
            ? [line, cells[0], cells[cells.length - 1]]
            : ROW.exec(line);
        if (!row) {
            prose.push(line);
            continue;
        }
        const lineNumber = Number(row[1]);
        if (!expected.has(lineNumber)) {
            unasked.push(lineNumber);
            continue;
        }
        if (english.has(lineNumber)) {
            duplicated.push(lineNumber);
            continue;
        }
        english.set(lineNumber, unescapeCell(row[2]));
    }

    if (english.size === 0) {
        /*
         * Nothing landed, and which of two things that is decides what to do
         * about it. A translator declining -- prose and no rows -- is the clean
         * answer this module exists to make safe, and asking again gets the
         * same answer. An answer full of rows whose numbers this scene never
         * had is a mistake, and one worth sending back with the reason.
         *
         * Reported as a flag rather than left to be re-derived from the shape
         * of the result: whoever is driving would have to look for the same
         * thing this already knows, and would get it subtly wrong -- a scene
         * whose every line number came back off by one has an empty english
         * and is not a refusal.
         */
        if (unasked.length) {
            problems.push(`${unasked.length} lines came back and not one of their numbers belongs to this`
                + ` scene, from ${unasked[0]}. The number is the only part of a row the game reads;`
                + " send back the scene's own.");
        } else {
            problems.push(prose.length
                ? `no lines came back, only prose: ${JSON.stringify(prose.join(" ").slice(0, 200))}`
                : "no lines came back and nothing was said");
        }
        return {accepted: false, declined: !unasked.length, english, problems, warnings};
    }

    const missing = speeches.filter(speech => !english.has(speech.lineNumber))
        .map(speech => speech.lineNumber);
    if (missing.length) {
        problems.push(`${missing.length} of ${speeches.length} speeches missing,`
            + ` from ${missing[0]}: a scene that stops early shifts every speech after it`);
        if (prose.length) {
            problems.push(`what was said instead: ${JSON.stringify(prose.join(" ").slice(0, 200))}`);
        }
    }
    if (duplicated.length) {
        problems.push(`${duplicated.length} line numbers came back twice, from ${duplicated[0]}`);
    }
    if (unasked.length) {
        problems.push(`${unasked.length} line numbers this scene never had, from ${unasked[0]}`);
    }

    for (const [lineNumber, text] of english) {
        const speech = expected.get(lineNumber);
        if (CONTROL.test(text)) {
            problems.push(`speech ${lineNumber} holds a tab or a line break`);
        }
        if (!text && speech.japanese) {
            problems.push(`speech ${lineNumber} came back empty for ${JSON.stringify(speech.japanese)}`);
        }
        for (const token of SUBSTITUTIONS) {
            if (speech.japanese.includes(token) && !text.includes(token)) {
                problems.push(`speech ${lineNumber} drops ${token}, which the game replaces at runtime`
                    + " -- resolving it writes one player's name into everybody's game");
            }
        }
        if (speech.english && text.length > speech.english.length * LONGER_THAN_DRAFT) {
            warnings.push(`speech ${lineNumber} is ${Math.round(text.length / speech.english.length)}x`
                + " the draft's length -- a note to the reader rather than a translation?");
        }
    }

    /*
     * A gender branch flattened into one sentence.
     *
     * The game plays a line inside "> male" to a player who made El a man and
     * the line inside "> female" to one who made her a woman, and no player
     * ever sees both. So two such lines with the same English throw the branch
     * away: 深根 calls El 兄様 on one route and 姉様 on the other, and "big
     * sibling" would be a translation of neither.
     *
     * This is the failure the scene format itself creates. Translated a line at
     * a time, as the existing draft was, the two halves are a fortnight apart
     * and get different English by accident. Handed a whole scene, a translator
     * sees two nearly identical Japanese lines together, and the shorter way
     * out is one sentence used twice -- which is what six lines of the current
     * draft did while it still had the excuse of never having seen them.
     *
     * Every male line against every female one, rather than pairing them off.
     * The blocks are not the same length -- 深根２／友情イベントＣ has 24 lines on
     * one route and 29 on the other -- and any alignment guess would miss the
     * pair that matters. What keeps that from crying wolf is
     * differsMaterially, not the pairing.
     */
    const onRoute = (route) => speeches.filter(speech => speech.route === route);
    for (const male of onRoute("male")) {
        for (const female of onRoute("female")) {
            const said = english.get(male.lineNumber);
            if (!said || said !== english.get(female.lineNumber)) {
                continue;
            }
            if (!differsMaterially(male.japanese, female.japanese)) {
                continue;
            }
            problems.push(`speeches ${male.lineNumber} and ${female.lineNumber} are both`
                + ` ${JSON.stringify(said)}, but the game plays the first only to a male El and the`
                + ` second only to a female one -- ${JSON.stringify(male.japanese)} against`
                + ` ${JSON.stringify(female.japanese)}. Nobody sees both, so one English for the two`
                + " is one of the two players reading the wrong line.");
        }
    }

    /*
     * English that gives El a gender where the game gives her none.
     *
     * 257 scenes have El on stage and 82 of them carry a "> male" / "> female"
     * branch, which means the other 175 are played word for word to a player who
     * chose a man and to one who chose a woman. A "she" in those is not a
     * translation choice, it is half the players reading about somebody they did
     * not create.
     *
     * A warning and not a refusal, because whether the word is about El is not
     * decidable from the line. Over the current draft it fires 51 times on the
     * lines carrying ＜エール＞, and about twenty of those are "Lady El" or "Lord
     * El" for ＜エール＞様 and ＜エール＞殿; the rest are a "him" that belongs to
     * whoever El is being told to hit. Narrowing it to the lines that name El,
     * and skipping the branches where the gender is known, is what keeps the
     * other thirty-odd from being three thousand.
     */
    if (scene.cast.some(member => member.gender === PLAYERS_CHOICE)) {
        for (const speech of speeches) {
            const said = english.get(speech.lineNumber);
            if (speech.route || !said || !GENDERED.test(said)) {
                continue;
            }
            if (SUBSTITUTIONS.some(token => speech.japanese.includes(token))) {
                warnings.push(`speech ${speech.lineNumber} names El and says`
                    + ` ${JSON.stringify(GENDERED.exec(said)[0])} -- El's gender is the player's, and`
                    + " this line is played to both. Fine if the word is about somebody else.");
            }
        }
    }

    // Prose alongside a complete answer is a preamble, not a refusal, and the
    // rows are all there -- worth saying once, not worth rejecting over.
    if (prose.length && !problems.length) {
        warnings.push(`${prose.length} lines of the answer were not rows and were ignored`);
    }

    return {accepted: problems.length === 0, declined: false, english, problems, warnings};
};
