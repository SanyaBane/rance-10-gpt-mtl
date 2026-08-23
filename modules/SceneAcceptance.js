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
import {gameTextWidth, trackingFor} from "./GameFont.js";
import {unescapeCell} from "./SceneFile.js";
import {LONGEST_DIALOGUE_LINE, wrapAt} from "./TextNormalization.js";

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
 * around it. The existing draft resolved it to the literal "El" in 1474 of
 * them, so a player who named their character anything else reads somebody
 * else's name in every one. Nothing about that is visible in the English on its
 * own, which is exactly why it survived a whole translation.
 *
 * A named list rather than a rule about ＜…＞ generally, because the game writes
 * its sound effects that way too -- ＜コンコン……＞ is a knock at the door, 679
 * distinct ones, and those are meant to be translated inside the brackets.
 * Being inline rather than a line of its own does not separate them either: 76
 * tokens only ever appear inline and 75 of those are onomatopoeia. The four
 * other bracketed literals in the code -- ＜ナギ＞, ＜志津香＞, ＜ケイブニャン＞,
 * ＜ケイブワン＞ -- belong to AssistantMessageView's colouring and appear in no
 * line of dialogue at all.
 */
const SUBSTITUTIONS = ["＜エール＞"];

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
 * Rows the message window draws at once.
 *
 * The layout says so: MessageWindow01.pactex.x, which every ADV command but the
 * three ●…Ｅ ones opens, carries a three-line placeholder, and 99.25% of the
 * game's own speeches are three m[] rows or fewer. docs/message-window.md has
 * the rest, including why this is the number the window states and its width is
 * not.
 */
const WINDOW_ROWS = 3;

/**
 * How wide one of those rows is, as a string rather than a number, the way
 * modules/SummaryLines.js compares against its panel: twenty-four full-width
 * characters.
 *
 * Not stated anywhere as a number. What states it is the geometry --
 * MessageWindow01 starts its text at x=470 and puts the key-wait mark at
 * x=1440 -- read at the scale the event window fixes: MessageWindow02's
 * placeholder is exactly 31 full-width characters, its text starts at x=337 and
 * its mark sits at x=1580, which makes a full-width character 40.1 px and this
 * window (1440-470)/40.1 = 24.2 of them. The backlog checks the same arithmetic
 * from a third place and lands within one percent. docs/message-window.md has
 * it in full.
 *
 * The game's own Japanese agrees: 96.1% of the lines this window draws are
 * inside 24, against 17.6% of the current English draft being outside it.
 *
 * The tracking has to be the window's own. modules/GameFont.js defaults to the
 * synopsis panel's 字間隔 4 at font 48; MessageWindow01 says 文字間隔 -2 at font
 * 57, which is negative, and using the default would over-measure every line by
 * an eighth of a character.
 */
const ORDINARY_WINDOW = "１２３４５６７８９０１２３４５６７８９０１２３４";

/** MessageWindow01: フォントサイズ 57, 文字間隔 -2. */
const DIALOGUE_TRACKING = trackingFor(-2, 57);

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

    const expected = new Map(scene.rows.map(row => [row.lineNumber, row]));

    for (const line of returned.split(/\r?\n/)) {
        if (!line.trim()) {
            continue;
        }
        const cells = line.split("\t");
        // A translator handed four columns sometimes gives four back. The
        // number is still first and the English still last, so that is
        // readable; anything else is not a row.
        const row = cells.length === 4 && /^\d+$/.test(cells[0])
            ? [line, cells[0], cells[3]]
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
        problems.push(prose.length
            ? `no lines came back, only prose: ${JSON.stringify(prose.join(" ").slice(0, 200))}`
            : "no lines came back and nothing was said");
        return {accepted: false, english, problems, warnings};
    }

    const missing = scene.rows.filter(row => !english.has(row.lineNumber)).map(row => row.lineNumber);
    if (missing.length) {
        problems.push(`${missing.length} of ${scene.rows.length} lines missing,`
            + ` from ${missing[0]}: a scene that stops early shifts every line after it`);
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
        const row = expected.get(lineNumber);
        if (CONTROL.test(text)) {
            problems.push(`line ${lineNumber} holds a tab or a line break`);
        }
        if (!text && row.japanese) {
            problems.push(`line ${lineNumber} came back empty for ${JSON.stringify(row.japanese)}`);
        }
        for (const token of SUBSTITUTIONS) {
            if (row.japanese.includes(token) && !text.includes(token)) {
                problems.push(`line ${lineNumber} drops ${token}, which the game replaces at runtime`
                    + " -- resolving it writes one player's name into everybody's game");
            }
        }
        if (row.english && text.length > row.english.length * LONGER_THAN_DRAFT) {
            warnings.push(`line ${lineNumber} is ${Math.round(text.length / row.english.length)}x`
                + " the draft's length -- a note to the reader rather than a translation?");
        }
    }

    /*
     * A row wider than the window draws.
     *
     * A warning rather than a refusal for two reasons. The build's own wrap
     * budget is about 31 full-width characters -- it was fitted in Meiryo,
     * which is not the game's font -- so 17.6% of the existing draft is over
     * this and refusing would refuse the house style rather than a mistake.
     * And the 6.7% of lines drawn by the ●…Ｅ commands get a wider window, 31
     * rather than 24, which the scene file does not say; those get a warning
     * they do not deserve.
     *
     * What it is for is the new translation, which can be written to the real
     * window from the first scene instead of to a budget nobody measured.
     */
    for (const row of scene.rows) {
        const said = english.get(row.lineNumber);
        if (said && gameTextWidth(said, DIALOGUE_TRACKING)
                > gameTextWidth(ORDINARY_WINDOW, DIALOGUE_TRACKING)) {
            warnings.push(`line ${row.lineNumber} is wider than the message window,`
                + ` which draws ${ORDINARY_WINDOW.length} full-width characters:`
                + ` ${JSON.stringify(said.slice(0, 60))}`);
        }
    }

    /*
     * A speech that will not fit the window it is drawn in.
     *
     * The game hands the message window one line per m[] row and draws three at
     * a time. Nothing wraps at runtime, so a row too wide for the window is a
     * row the build has to break in two -- and the speech then wants four lines
     * where the game's own Japanese wanted three.
     *
     * The budget is the greater of the window's rows and the rows the speech
     * has, because the Japanese line count is by definition acceptable: the
     * game shipped it. 1241 of the game's own speeches run past three rows and
     * those are its business, not a translation's.
     *
     * A refusal rather than a warning, because it is always fixable without
     * touching a line number. The rows of one speech may hold the English in
     * any arrangement -- nothing reads a row on its own; the backlog replays
     * the same rows, and the game has no voice at all -- so a speech that needs
     * four lines can be written as three that each fit. What the existing draft
     * did instead was pour two Japanese rows into one English row and leave the
     * next empty, which the build then wraps back into two: m[43] is that in
     * three rows and four lines. 4455 of the draft's 166 173 speeches are over,
     * 3274 of them by exactly one line.
     *
     * Measured with the build's own wrap, so this refuses exactly what the
     * build would split rather than a second opinion about the window's width
     * -- which nobody has settled. docs/message-window.md is what is known.
     */
    let speech = [];
    const closeSpeech = () => {
        if (!speech.length) {
            return;
        }
        const lines = speech.reduce((sum, row) =>
            sum + wrapAt(english.get(row.lineNumber) ?? "", LONGEST_DIALOGUE_LINE).split("\n").length, 0);
        const budget = Math.max(speech.length, WINDOW_ROWS);
        if (lines > budget) {
            problems.push(`the speech at line ${speech[0].lineNumber} is ${speech.length} rows and needs`
                + ` ${lines} lines, where the window draws ${budget}. Rows of one speech may hold the`
                + " English in any arrangement, so this fits if the words are spread across them --"
                + " what it cannot do is grow past the rows the game gave it.");
        }
        speech = [];
    };
    for (const row of scene.rows) {
        if (row.startsUtterance) {
            closeSpeech();
        }
        speech.push(row);
    }
    closeSpeech();

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
    const onRoute = (route) => scene.rows.filter(row => row.route === route);
    for (const male of onRoute("male")) {
        for (const female of onRoute("female")) {
            const said = english.get(male.lineNumber);
            if (!said || said !== english.get(female.lineNumber)) {
                continue;
            }
            if (!differsMaterially(male.japanese, female.japanese)) {
                continue;
            }
            problems.push(`lines ${male.lineNumber} and ${female.lineNumber} are both`
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
        for (const row of scene.rows) {
            const said = english.get(row.lineNumber);
            if (row.route || !said || !GENDERED.test(said)) {
                continue;
            }
            if (SUBSTITUTIONS.some(token => row.japanese.includes(token))) {
                warnings.push(`line ${row.lineNumber} names El and says`
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

    return {accepted: problems.length === 0, english, problems, warnings};
};
