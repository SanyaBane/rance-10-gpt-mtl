/**
 * What a translator is handed for one scene, and what it is told about it.
 *
 * Nothing here is invented. Every rule below is a rule something else already
 * enforces or measures, and it is written out so that a scene comes back
 * accepted rather than refused:
 *
 *   - the answer's shape, and why a short one is worse than no answer at all:
 *     modules/SceneAcceptance.js;
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
import {createNameFinder, mentions} from "./NameNormalizer.js";
import {CARD_GLOSSARY} from "./Nameplates.js";
import {PLACE_GLOSSARY} from "./PlaceNames.js";
import {SUBSTITUTIONS} from "./SceneAcceptance.js";
import {speechesOf} from "./SceneFile.js";
import {CG_FLAG, ROUTE_FLAG} from "./SceneIndex.js";
import {SUMMARY_TERMS} from "./SummaryLines.js";
import {readGlossary} from "./TermDrift.js";

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

/**
 * The scene as the translator sees it: one speech per line -- its number, who
 * says it, and the whole utterance. No English, and no rows.
 *
 * The rows are deliberately not on the page. They are where Japanese
 * typesetting fell, modules/SpeechRows.js puts the answer back into them
 * afterwards, and a translator who can see them writes English shaped to them:
 * the first scene translated through this pipeline lost 巨大戦艦 out of a
 * sentence because the row it was on was already full, while the row above it
 * was two thirds empty.
 */
const sceneBlock = (scene) => {
    const lines = [];
    let route = null;
    for (const speech of speechesOf(scene)) {
        if (speech.route !== route) {
            route = speech.route;
            lines.push(`> ${route ?? "end"}`);
        }
        lines.push([speech.lineNumber, speech.speaker, speech.japanese].join("\t"));
    }
    return lines.join("\n");
};

const RULES = `## The rules

**Send back every speech, and only these speeches.** One line per speech below:
the number, a tab, the English. Nothing else on the line -- no speaker, no
Japanese, no quotes around it. A scene is accepted whole or not at all, because
the game is handed one English speech per number: an answer that stops early
does not lose its tail, it shifts it, and every speech after the gap goes out
under the previous speech's number.

If you will not translate this scene, say so in plain prose and send no lines.
That is a clean answer and it is handled. A scene translated up to the point it
turns explicit and then stopped is the one failure nothing in the text of the
answer reveals.

**One speech, one line of answer.** No tab and no line break inside the English:
the first moves every column when the scene is written back, the second is read
as the end of the answer. Where the Japanese is empty, send the number and an
empty English.

**Keep ＜エール＞ exactly as it is**, brackets and all. The game replaces it at
runtime with the name the player typed for the protagonist. Resolving it to "El"
writes one player's name into everybody's game. Other ＜…＞ are sound effects and
are translated inside the brackets.

**Keep the punctuation the speech opens and closes with.** 「」 for speech, （）
for a thought. They are how the game marks who is talking rather than
decoration, and the build reads them to lay the speech out.

**Write the rest in plain ASCII.** The build rewrites ... for an ellipsis, a
hyphen for a dash, straight quotes for curly ones, and strips accents, so
writing them plainly is what you will get either way.

**…… is "...", three dots**, however many Japanese characters it runs to. Not
one dot apiece. 「ぐすっ……奴隷です……」 is "「Sniff... Your slave...」" and not
"「Sniff...... Your slave......」"; the second is a transcription of the source
rather than a line of English.

**A number the Japanese writes in digits stays in digits.** 20万 is "200,000",
not "two hundred thousand": a figure spelled out reads as prose where the
Japanese meant a figure. Multiply 万 and 億 out on the way, because English has
no unit for either -- 20万 is 200,000 and never "20 man" or "20 myriad".

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

**Do not tidy a voice upward.** "gonna", "wanna", a missing subject, a sentence
that opens with "and" -- that is how somebody talks, not a defect to repair.
A mob youkai says "all of you are gonna get crushed"; regularising him into
"every one of you is going to get chewed to pieces" costs the one thing the
speaker column is there to protect, and it costs it quietly, because the tidied
line is perfectly good English.

**Do not trade a concrete word for a shorter one.** ミカン箱 is a tangerine box,
not a crate; 不思議な遺跡 is a mysterious ruin, not a curious one; すりすりと撫でた
is rubbing it *gently*. A shorter word that means less is not a translation of
the longer one.

**Honorifics stay.** -sama, -san, -chan, -kun as the Japanese has them; the rest
of this patch writes -sama 3592 times. Do not translate one into "Lady" or
"Lord" -- and especially not for El, whose gender the player picks.

**There is no length limit.** Say what the Japanese says, in English that reads
well, and let it come out as long as it comes out. Nothing is gained by
compressing a sentence and something is always lost.

**But length is earned by content, not by grammar.** The rule above is about
words that carry something -- a tangerine box, a mysterious ruin, a nail driven
into bran. It is not a licence to finish a sentence the scene has already
finished. English exclamations stand without a verb: "And such terrible
bloodlust...!" is a whole utterance, and "what terrible bloodlust they have" is
the same thought with three words of scaffolding and a steadier speaker behind
it. The line is played inside a scene, with the thing on screen and the speaker
in the middle of reacting to it. It never has to stand alone.

Japanese ですます is the unmarked way to say something; an English finite clause
is not. Match the register rather than the grammar -- matching the grammar is
how a frightened girl ends up composing a sentence.

**A question stays a question.** 戦争は終わったんじゃなかったのかよ is "Wasn't the
war over!?" and not "I thought the war was over". Both carry the same fact and
only one of them is affronted: a negative question is how the Japanese is
protesting, English has the same construction, and turning it into a statement
leaves somebody calmly reporting their own expectations. The same goes the
other way -- an order stays an order, a mutter stays a mutter.`;

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
    const {names, others} = glossaryFor(scene, glossaries);
    const speeches = speechesOf(scene);
    const parts = [];

    parts.push(`# ${scene.name}`);
    parts.push(`Scene ${scene.functionId} of Rance 10, ${speeches.length} speeches.`
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

    parts.push(RULES);
    if (scene.rows.some(row => row.route)) {
        parts.push(ROUTE_RULE);
    }
    if (scene.cast.some(member => member.gender === PLAYERS_CHOICE)) {
        parts.push(EL_RULE);
    }

    parts.push("## Who is in it\n\n"
        + (castBlock(scene, glossaries.voices) || "- nobody: this scene is all narration.")
        + "\n\nThe speaker column below is one of these names, `-` for narration, `?` for a message"
        + " with no speaker, and a trailing `~` for a thought the game draws in （） rather than 「」.");

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
            + " `number<TAB>English` per line -- one line per speech -- and nothing else in the file.");
    }

    return parts.join("\n\n") + "\n";
};
