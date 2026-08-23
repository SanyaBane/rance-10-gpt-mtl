/**
 * What a translator is handed for one scene, and what it is told about it.
 *
 * Nothing here is invented. Every rule below is a rule something else already
 * enforces or measures, and it is written out so that a scene comes back
 * accepted rather than refused:
 *
 *   - the answer's shape, and why a short one is worse than no answer at all:
 *     modules/SceneAcceptance.js;
 *   - the rows of a speech, the twenty-four characters and what may move
 *     between them: docs/message-window.md;
 *   - the columns, the speaker markers and the "> male" blocks:
 *     modules/SceneFile.js;
 *   - ＜エール＞, which the game replaces at runtime with the name the player
 *     typed: the SUBSTITUTIONS note in modules/SceneAcceptance.js;
 *   - the names, which come from the tables and never from the translator:
 *     CLAUDE.md, and the four glossaries it lists.
 *
 * The draft English is deliberately not shown. It is a line-at-a-time machine
 * translation -- no speaker, no scene, no line before or after -- and putting
 * it in front of a retranslation buys its settled terminology at the price of
 * its mistakes. The terminology is bought instead from the glossaries, which
 * are the authority the draft was supposed to be following.
 *
 * The glossary is sliced per scene rather than sent whole. All of it is some
 * fifty kilobytes of tables against a scene of a couple of kilobytes; what a
 * scene actually names is a dozen rows, and a dozen rows get read.
 */
import {CHARACTER_VOICES, PLAYERS_CHOICE} from "./CharacterGenders.js";
import {gameTextWidth, trackingFor} from "./GameFont.js";
import {createNameFinder, mentions} from "./NameNormalizer.js";
import {CARD_GLOSSARY} from "./Nameplates.js";
import {PLACE_GLOSSARY} from "./PlaceNames.js";
import {SUBSTITUTIONS} from "./SceneAcceptance.js";
import {CG_FLAG, ROUTE_FLAG} from "./SceneIndex.js";
import {SUMMARY_TERMS} from "./SummaryLines.js";
import {readGlossary} from "./TermDrift.js";

/** MessageWindow01: フォントサイズ 57, 文字間隔 -2. docs/message-window.md. */
const DIALOGUE_TRACKING = trackingFor(-2, 57);

/** Twenty-four full-width characters, the width the ordinary window draws. */
const ORDINARY_WINDOW = "１２３４５６７８９０１２３４５６７８９０１２３４";

/**
 * The same width said in the unit somebody writing English can count in.
 *
 * "Twenty-four full-width characters" is exact and uncountable: the row being
 * written has no full-width characters in it. Measured against a sentence of
 * ordinary English prose in the game's own font, that box holds about this
 * many Latin characters, spaces included -- and a number that can be counted
 * is a number that gets respected. modules/SceneAcceptance.js still measures
 * the real thing.
 */
const LATIN_SAMPLE = "The quick brown fox jumps over the lazy dog, and then some more words follow here.";

export const latinPerRow = () => Math.floor(
    gameTextWidth(ORDINARY_WINDOW, DIALOGUE_TRACKING)
    / (gameTextWidth(LATIN_SAMPLE, DIALOGUE_TRACKING) / LATIN_SAMPLE.length));

/**
 * The slice is cut for recall, not for precision.
 *
 * These tables are keyed by the Japanese and were written for other jobs -- a
 * card Id, a Location plate -- so a few of their keys are also ordinary words.
 * Over all 5433 scenes the loudest is てる, a card called Teru, which turns up
 * in 1973 of them because it is the end of 書いてる; きく does it in 266 and 愛,
 * a card called Ai, in 624 because it is also the word for love.
 *
 * Every rule that quiets those costs a real name. Dropping the keys that are
 * hiragana all through loses かなみ -- Kanami, a member of the party -- along
 * with てる; refusing a hiragana key that hiragana runs into, which is the
 * argument mentions() already makes one script over, takes てる down to 493 and
 * still costs Kanami a seventh of her scenes. A name the translator is not
 * shown is the failure this repository is built around, and a wrong line of
 * advice in a prompt is a wrong line of advice. It is 4.7 rows per scene
 * either way.
 */
/**
 * The tables a scene's slice is cut from, read once for a whole run.
 *
 * mistranslated_names.json comes through createNameFinder rather than as rows,
 * because "does this line name this character" is not a substring test: リア is
 * inside バリア and レイ inside ブレイク, and the finder is where that is already
 * answered. The other three are plain Japanese-to-English tables and get
 * mentions() for the same reason.
 */
export const readSceneGlossaries = async () => ({
    names: await createNameFinder(),
    /*
     * How each of them talks. A prompt full of rules about what the English may
     * not do, and nothing at all about how it should sound, gets exactly what
     * it asks for: correct, inside the window, and lifeless. This is the other
     * half, and it is keyed by the name on the cast line so the two print
     * together.
     */
    voices: new Map(readGlossary(CHARACTER_VOICES).map(row => [row.japanese, row.english])),
    tables: [
        {title: "card and combat-log names", rows: readGlossary(CARD_GLOSSARY)},
        {title: "places", rows: readGlossary(PLACE_GLOSSARY)},
        {title: "settled terms", rows: readGlossary(SUMMARY_TERMS)},
    ],
});

/**
 * The rows of the tables this scene's Japanese actually names.
 *
 * Row by row rather than over the scene joined into one string: joining puts
 * the end of one line against the start of the next and invents a name that is
 * in neither.
 */
const glossaryFor = (scene, {names, tables}) => {
    const japanese = scene.rows.map(row => row.japanese).filter(Boolean);
    const found = new Map();
    for (const line of japanese) {
        for (const record of names(line)) {
            /*
             * Not the tokens the game substitutes at runtime. The name table
             * has an entry spelling ＜エール＞ as "El", which is what it is for
             * -- and printing it here would put a line of advice saying to
             * resolve the token directly under the rule saying to carry it
             * through. A translator following the table would be right.
             */
            if (SUBSTITUTIONS.includes(record.shortNameJpn)) {
                continue;
            }
            found.set(record.shortNameJpn, record.shortNameEng);
        }
    }
    const others = [];
    for (const {title, rows} of tables) {
        const hits = rows.filter(row => !found.has(row.japanese)
            && !SUBSTITUTIONS.includes(row.japanese)
            && japanese.some(line => mentions(line, row.japanese)));
        // Longest first, so a name that contains another is read before it.
        hits.sort((a, b) => b.japanese.length - a.japanese.length);
        if (hits.length) {
            others.push({title, hits});
        }
    }
    return {names: [...found].sort((a, b) => b[0].length - a[0].length), others};
};

/**
 * The cast, with the gender to write pronouns from.
 *
 * El Mofus is "Player's choice" and that is not a missing answer: the player
 * decides at ２部旅立ち and the game plays the same lines to both, so the line
 * has to work either way. modules/SceneAcceptance.js warns when it does not.
 */
const castBlock = (scene, voices) => scene.cast
    .map(member => `- **${member.speaker}** (${member.stand}) -- ${member.gender}`
        + (voices.get(member.speaker) ? `. ${voices.get(member.speaker)}` : ""))
    .join("\n");

/** The scene as the translator sees it: number, speaker, Japanese. No English. */
const sceneBlock = (scene) => {
    const lines = [];
    let route = null;
    for (const row of scene.rows) {
        if (row.startsUtterance && lines.length) {
            lines.push("");
        }
        if ((row.route ?? null) !== route) {
            route = row.route ?? null;
            lines.push(`> ${route ?? "end"}`);
        }
        lines.push([row.lineNumber, row.speaker, row.japanese].join("\t"));
    }
    return lines.join("\n");
};

/** How many rows the window will draw for each speech, so the budget is on the page. */
const speechSizes = (scene) => {
    const sizes = [];
    let size = 0;
    for (const row of scene.rows) {
        if (row.startsUtterance && size) {
            sizes.push(size);
            size = 0;
        }
        ++size;
    }
    if (size) {
        sizes.push(size);
    }
    return sizes;
};

const RULES = (perRow) => `## The rules

**Send back every row, and only these rows.** One line per row of the scene:
the number, a tab, the English. Nothing else on the line -- no speaker, no
Japanese, no quotes around it. A scene is accepted whole or not at all, because
the game is handed one English line per number: an answer that stops early does
not lose its tail, it shifts it, and every line after the gap goes out under the
previous line's number.

If you will not translate this scene, say so in plain prose and send no rows.
That is a clean answer and it is handled. A scene translated up to the point it
turns explicit and then stopped is the one failure nothing in the text of the
answer reveals.

**One line, one line.** No tab and no line break inside the English: the first
moves every column when the scene is written back, the second turns one row into
two. Where the Japanese is empty, send the number and an empty English.

**Keep ＜エール＞ exactly as it is**, brackets and all. The game replaces it at
runtime with the name the player typed for the protagonist. Resolving it to "El"
writes one player's name into everybody's game. Other ＜…＞ are sound effects and
are translated inside the brackets.

**Keep the punctuation the row opens and closes with.** 「」 for speech, （） for
a thought, and a leading full-width space on a continuation row -- that space is
an indent that sits the rest of a quote under the 「 that opened it, and dropping
it leaves the line flush against the window edge while its neighbours are not.

**Write the rest in plain ASCII.** The build rewrites ... for an ellipsis, a
hyphen for a dash, straight quotes for curly ones, and strips accents, so
writing them plainly is what you will get either way.

**…… is "...", three dots.** Not one dot per Japanese character. 「ぐすっ……奴隷
です……」 is "「Sniff... Your slave...」" and not "「Sniff...... Your slave......」";
the second is a transcription of the source rather than a line of English, and
it eats a quarter of the row.

## How it has to sound

This is a game script. Every line is somebody talking, or the narrator telling
you what you just did. It is not a document, and the commonest way a careful
translation of it goes wrong is by reading like one.

**Use contractions.** "Break's over, let's go" is a man giving an order.
"Break is over. We are moving." is an announcement at an airport. It is the
same length and it is the wrong character. The apostrophe reaches the game
intact -- there is no reason to avoid it, and a scene that comes back without
one anywhere has been written in the wrong register throughout.

**Keep whose line it is.** The speaker column and the cast list above say who is
talking and how they talk; the Japanese says it too, in the pronoun and the
ending. A diary written in polite ですます is *her* diary and stays first person
-- 外では見ないような材質の壁に is "walls made of materials I've never seen
outside", not "walls of a material never seen outside", which is a guidebook.
A brute stays blunt. A child stays a child.

**Do not trade a concrete word for a shorter one.** ミカン箱 is a tangerine box,
not a crate; 不思議な遺跡 is a mysterious ruin, not a curious one; すりすりと撫でた
is rubbing it *gently*. Length is a real constraint and it is not solved by
blurring the noun -- it is solved by moving words between the rows of the
speech, which you may do freely.

**Honorifics stay.** -sama, -san, -chan, -kun as the Japanese has them; the rest
of this patch writes -sama 3592 times. Do not translate one into "Lady" or
"Lord" -- and especially not for El, whose gender the player picks.

## Rows and width

A blank line separates one speech from the next. The message window draws
**three rows at a time**, and each row is **twenty-four full-width characters --
about ${perRow} Latin characters, spaces counted**.

The words of one speech may be moved between its rows freely. Nothing reads a
row on its own: the backlog replays the same rows, and the game has no voice at
all. **What cannot change is the number of rows** -- they are operands in the
bytecode, so a speech of three rows comes back as three rows.

So a speech of N rows has N lines of about ${perRow} characters to say what it
says, and never fewer than three, since that is what the window draws. Over that
and the build breaks a row in two, and the speech runs off the bottom of the
window. Spread the English across the rows the speech already has rather than
pouring it into the first one and leaving the rest short.`;

const ROUTE_RULE = `## The two Els

Lines between \`> male\` and \`> end\` are played only to a player who made El a
man; lines between \`> female\` and \`> end\` only to one who made El a woman.
**Both halves need translating, and they have to differ.** No player ever sees
both, so one English sentence used for the pair is one of the two players
reading a line written for the other. 深根 calls El 兄様 on one route and 姉様 on
the other; "big sibling" is a translation of neither.`;

const EL_RULE = `## El's gender is the player's

El Mofus is in this scene and the game does not say whether El is a man or a
woman -- the player chose at ２部旅立ち, and these lines are played word for word
to both. So do not give El a gender: no he or she, no Lady or Lord, no brother
or sister, unless the line is inside a \`> male\` or \`> female\` block above,
where the answer is known. ＜エール＞様 is "El" or "Lord El"'s trap; write it
without one.`;

/**
 * One scene, ready to hand over.
 *
 * @param {import("./SceneFile.js").parseSceneFile} scene
 * @param {Awaited<ReturnType<readSceneGlossaries>>} glossaries
 * @param {{answerFile?: string, problems?: string[], warnings?: string[], attempt?: number}} [again]
 *        what went wrong last time, from a previous acceptTranslation()
 */
export const renderScenePrompt = (scene, glossaries, again = {}) => {
    const perRow = latinPerRow();
    const {names, others} = glossaryFor(scene, glossaries);
    const sizes = speechSizes(scene);
    const parts = [];

    parts.push(`# ${scene.name}`);
    parts.push(`Scene ${scene.functionId} of Rance 10, ${scene.rows.length} lines`
        + ` in ${sizes.length} speeches (the longest is ${Math.max(...sizes, 0)} rows).`
        + (scene.flags.includes(CG_FLAG)
            ? " The game lists this scene in its CG recollection gallery, so it is adult content."
            : "")
        + (scene.flags.includes(ROUTE_FLAG)
            ? " It branches on El's gender; see below."
            : ""));

    if (again.problems?.length) {
        parts.push(`## This came back once already, on attempt ${(again.attempt ?? 1)}, and was not accepted`
            + "\n\nEvery one of these has to be fixed, and the whole scene sent again -- a scene lands"
            + " whole or not at all.\n\n"
            + again.problems.map(problem => `- ${problem}`).join("\n"));
    }
    if (again.warnings?.length) {
        parts.push("## Worth a look, but not why it was refused\n\n"
            + again.warnings.map(warning => `- ${warning}`).join("\n"));
    }

    parts.push(RULES(perRow));
    if (scene.rows.some(row => row.route)) {
        parts.push(ROUTE_RULE);
    }
    if (scene.cast.some(member => member.gender === PLAYERS_CHOICE)) {
        parts.push(EL_RULE);
    }

    parts.push("## Who is in it\n\n"
        + (castBlock(scene, glossaries.voices) || "- nobody: this scene is all narration.")
        + "\n\nThe speaker column below is one of these names, or `+` for another row of the speech"
        + " above, `-` for narration, `?` for a message with no speaker, and a trailing `~` for a"
        + " thought the game draws in （） rather than 「」.");

    if (names.length || others.length) {
        const blocks = [];
        if (names.length) {
            blocks.push(names.map(([japanese, english]) => `- ${japanese} -- **${english}**`).join("\n"));
        }
        for (const {title, hits} of others) {
            blocks.push(`*${title}*\n` + hits.map(row => `- ${row.japanese} -- **${row.english}**`).join("\n"));
        }
        parts.push("## The English for what this scene names\n\nThese are settled. Spell them this way"
            + " even where another spelling would be defensible -- a name recalled rather than read is"
            + " how キャンテル shipped as \"Kanteru\" on one screen and \"Cantel\" on another.\n\n"
            + blocks.join("\n\n"));
    }

    parts.push("## The scene\n\n```\n" + sceneBlock(scene) + "\n```");

    if (again.answerFile) {
        parts.push(`## Where it goes\n\nWrite the answer to \`${again.answerFile}\`, one`
            + " `number<TAB>English` per line and nothing else in the file.");
    }

    return parts.join("\n\n") + "\n";
};
