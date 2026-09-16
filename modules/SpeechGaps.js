/**
 * Where a speech and the English written into its rows have come apart.
 *
 * The corpus this repository builds from was translated a line at a time, and
 * the fork that wrote it often answered a whole utterance on the utterance's
 * first row -- 「喧嘩や、悪ければ決闘沙汰にまで / 発展しそうになるんだぞ！」 came
 * back as one English sentence with the second row left empty. That is the same
 * shape modules/SceneTranslations.js writes on purpose, so most of it is
 * harmless. Some of it is not, and none of it was visible until the dialogue was
 * laid out scene by scene: a corpus record is a number, a Japanese line and an
 * English one, with no speech around it to be wrong about.
 *
 * What makes the question answerable here is that a scene file carries the
 * game's own Japanese, the speaker the bytecode names, and the row boundaries
 * the `MSG` operands gave -- so a row's English can be held against the row it
 * is on rather than against the record it came from. The alignment check in
 * docs/corpus-alignment.md cannot do this and reads 0: it compares a record's
 * Japanese with the dump, and in every case here the Japanese is right and the
 * English is what moved.
 *
 * ## The four classes, worst first
 *
 * **shifted** -- the English on a row belongs to a different row. The two
 * signals that are almost never anything else: a row whose Japanese is a
 * thought （…） answered with speech 「…」 or the other way round, and a row
 * whose English is nothing but dots over real Japanese, which is the padding a
 * run of shifted rows ends with. m[102332] carries the thought that belongs to
 * m[102333], and m[102335] carries "............".
 *
 * **overflow** -- the speech draws in more lines than its window has, so the
 * end of it runs off the box. The player sees this one whether or not anything
 * else is wrong with the speech, which is why it is a class of its own and
 * ranks above the rest: 4193 of the 4472 have every row filled and nothing else
 * the matter with them. It was a flag on the class below until a screenshot of
 * ネルソン／キャライベントＣ arrived, five lines drawn in a three-row window, and
 * the report had nothing to say about that scene -- the fit was only ever being
 * asked about speeches that were already suspect for another reason.
 *
 * **blank** -- a row where the game says something and the English does not,
 * in a speech that does fit. Three kinds: a *hole* between two filled rows is
 * the one a player sees as a gap in the middle of a bubble; *trailing* blanks
 * are the whole utterance sitting in row one; *leading* is the mirror.
 *
 * Both carry what modules/SpeechRows.js would put in the rows instead, so a
 * report can show the fix rather than assert one exists.
 *
 * A row the game itself left blank is none of this, and asking the cell
 * instead of the row got it wrong by 954 speeches. See carriesText below.
 *
 * **fold** -- every row is filled and the speech fits its window, and the
 * build still folds one of its rows into two drawn lines, where laying the
 * same words back into the same rows would not. The tail of a row alone on a
 * line under a full one: `world,` under `He declared the birth of the New Demon
 * King Army to the`, which is a screenshot rather than an example.
 *
 * Not an overflow, which is why no report had it: a two-row speech folded into
 * three still fits a three-row window, so `rowBudget` is satisfied and the
 * class above never fires. The fault is the division, not the length -- 38.5
 * ems over 28.3 where the same words balance to 34.4 and 32.4 -- and the
 * remedy is a layout rather than somebody's edit, which is what separates this
 * class from the one above it.
 *
 * Held to the backlog rather than to the window, because the backlog is the
 * binding box and a layout that only cleared the window would trade a ragged
 * line for a clipped one: see `clipsInBacklog` in modules/SpeechRows.js. A
 * speech whose fold no layout can remove -- because the widest row of the best
 * division is still past that edge, or because there is simply more English
 * than the rows draw -- is not in the class. Those want shortening by meaning,
 * and they are counted and said out loud rather than dropped.
 *
 * It ranks above bracket, so some speeches that would have been filed there
 * are filed here instead. That costs nothing: scripts/find_speech_brackets.js
 * asks every speech about its brackets rather than only the ones nothing worse
 * is wrong with, which is the report that number comes from.
 *
 * **bracket** -- the speech opens 「 in Japanese and does not in English, or
 * closes 」 and does not. The text is on its own row; a quotation mark fell off
 * the end of one row or the start of the next. Cosmetic, and the largest class.
 *
 * **untranslated** -- a speech with no English at all. Reported because it is
 * what a build has to decide about rather than what somebody has to fix: a row
 * with no English is left unnamed, and an unnamed row plays in Japanese.
 *
 * A speech is reported once, under the worst class it answers, so the counts
 * add up to the speeches with something wrong rather than to the signals.
 */
import {speechesOf} from "./SceneFile.js";
import {readTranslatedScenes} from "./SceneTranslations.js";
import {
    backlogEms, BACKLOG_EDGE, clipsInBacklog, drawnLines, folds,
    inHistoryFrameOf as inHistoryFrame, layOutVoices, rowBudget,
} from "./SpeechRows.js";

/** Worst first, which is also the order a fix is worth making in. */
export const CLASSES = ["shifted", "overflow", "blank", "fold", "bracket", "untranslated"];

/**
 * Kana and kanji, and deliberately not ・ or ー.
 *
 * The katakana middle dot is a letter by codepoint and a dot by eye, and a row
 * whose Japanese is ………………・ answered with ..............・ is a translation
 * rather than a fault. A range that takes in U+30FB reports it as one.
 */
const HAS_JAPANESE = /[ぁ-ゖァ-ヺ一-鿿]/;
/** Dots, full-width dots and ellipses: the padding a shifted run ends with. */
const ONLY_DOTS = /^[\s　]*[.．・…][\s　.．・…]*$/;
/**
 * The one run of rows the game does not draw in `MessageWindow01`, and so the
 * one run whose width this report may not judge.
 *
 * `AdvMessageWindow@GetMessageWindowActivityName` switches on each ADV
 * command's viewType, and that switch is not the whole answer: a scene can put
 * a different frame under it. `CALLFUNC ■歴史枠` does, and it happens **once**
 * in the whole 60 MB of bytecode -- in 033026.tsv, ６０１／プロローグ, before
 * the chronology of everything since Rance became Demon King. The frame goes up
 * at m[193987] and `■枠消し` takes it down after m[194532]; between them the
 * window is `MessageWindowHistory`, eighteen rows and wide enough for the 41
 * full-width characters the game's own Japanese runs to there.
 *
 * docs/message-window.md held those 311 lines out of its census for exactly
 * this reason and this report did not, so 15 speeches of the `overflow` class
 * were the report asking a 24-wide question about a 41-wide box. Their English
 * runs to 128% of a `MessageWindow01` row and fits the frame it is actually in.
 * Shortening them by meaning -- which is what that class asks for -- would have
 * thrown away text nothing was wrong with.
 *
 * Only `overflow` is held off. The other classes ask what a row says rather
 * than how wide it is, and those questions are the same in any window.
 */
/**
 * A scene that is the scenario document rather than a scene the game plays.
 *
 * Every scene function has a twin whose name is the same with a `t` in front --
 * `６０４／ザンス登場２` and `t６０４／ザンス登場２` -- and the twin holds what the
 * writer handed the scripter: stage directions, casting notes, `＞戦闘` where a
 * battle goes, and asides like `（書かなくても良い）`. The game's own Japanese in
 * them runs far past 24 full-width characters, which is why
 * docs/message-window.md held 4562 of its 9783 over-wide lines out of the
 * census on exactly this test.
 *
 * `overflow` asks whether the player sees the end of a line, and in a draft
 * there is no player. 420 of the class's 433 findings were in these, and the
 * remedy the class asks for -- shorten by meaning -- would have rewritten a
 * source document to fit a window it is never drawn in. They are counted and
 * said out loud rather than dropped, because "the report is down to 13" and
 * "down to 13, plus 420 nobody is going to read" are different facts about
 * the same patch.
 *
 * A leading ASCII `t` is the whole test: the game's own scene names are
 * Japanese and full-width digits, so nothing else starts with one.
 *
 * Exported because modules/SpeechIndent.js holds its own width findings apart
 * the same way, and a second spelling of this test is a second opinion about
 * which scenes the player ever sees.
 */
export const isDraftScene = (name) => name.startsWith("t");

// The frame is modules/SpeechRows.js's, asked there by file and number, because
// the build, the chronology's own layout and bake_speech_rows all need it and
// four copies of a line number is four chances to mistype one.

const opens = (text, bracket) => text.trimStart().startsWith(bracket);
const closes = (text, bracket) => text.trimEnd().endsWith(bracket);

/**
 * A cell holding nothing but the continuation indent is a blank row wearing a
 * character. It draws as an empty line, `assemblePatch` would read it as
 * translated, and read as a dot it is a shifted run's padding -- which is three
 * different wrong answers to one whitespace.
 */
const englishOf = (row) => (row.english.trim() ? row.english : "");

/**
 * Whether the game says anything on this row, which is what decides whether a
 * translation owes it anything.
 *
 * 954 speeches hold a row the game itself left blank -- a beat inside a bubble,
 * or text positioned across the screen with runs of full-width spaces, as
 * m[6638] does with twenty of them under 「ふ」. An English cell that is blank
 * there is the faithful answer and not a gap, and a layout that treated it as
 * one would pour the speech into a row the author left empty on purpose. So the
 * question is never "is this cell empty" but "is this cell empty where the game
 * has something to say".
 */
const carriesText = (row) => Boolean(row.japanese.trim());

/**
 * The English of a row that is a thought where its Japanese is speech, or the
 * reverse. Both languages mark the difference and the corpus keeps the marks,
 * so this is one of the two places a shifted row cannot hide.
 */
const swapsThoughtAndSpeech = (row) =>
    (opens(row.japanese, "（") && opens(row.english, "「"))
    || (opens(row.japanese, "「") && (opens(row.english, "（") || opens(row.english, "(")));

const shiftSignals = (rows) => {
    const signals = [];
    for (const row of rows) {
        const english = englishOf(row);
        if (!english || !row.japanese) {
            continue;
        }
        if (swapsThoughtAndSpeech({...row, english})) {
            signals.push({at: row.lineNumber, kind: "a thought answered with speech, or the reverse"});
        } else if (ONLY_DOTS.test(english) && HAS_JAPANESE.test(row.japanese)) {
            signals.push({at: row.lineNumber, kind: "English is nothing but dots over real Japanese"});
        }
    }
    return signals;
};

/** Which of the three shapes a speech's blanks make. */
const blankKind = (filled) => {
    const first = filled.indexOf(true);
    const last = filled.lastIndexOf(true);
    if (filled.slice(first, last).includes(false)) {
        return "a hole between two filled rows";
    }
    return first > 0 ? "blank rows before the English" : "blank rows after the English";
};

/**
 * Every speech of one text language's scenes that answers one of the classes.
 *
 * @param {string} lang
 * @return {Promise<{scenes: number, speeches: number, findings: object[]}>}
 */
/**
 * @param {string} lang
 * @param {string} [only] one scene file, with or without the .tsv, so that a
 * translator refining one scene reads a report about that scene. Narrowing here
 * rather than filtering the findings afterwards keeps every count in the run
 * about the same set of speeches.
 */
export const findSpeechGaps = async (lang, only) => {
    const wanted = only && (only.endsWith(".tsv") ? only : `${only}.tsv`);
    const scenes = (await readTranslatedScenes(lang))
        .filter(({fileName}) => !wanted || fileName === wanted);
    const findings = [];
    let speeches = 0;
    let draftsHeld = 0;
    // Folds no layout can take out, and folds in a scene the game never draws.
    // Named rather than dropped: "the class is 3517" and "3517, plus 3111 that
    // want an edit" are different facts about the same corpus.
    //
    // The first of those is kept whole rather than counted, because it is a work
    // list: every one of them is a row somebody has to shorten by meaning, and a
    // number tells them there are three thousand without telling them which.
    const heldFolds = [];
    let draftFoldsHeld = 0;

    for (const {fileName, scene} of scenes) {
        const draft = isDraftScene(scene.name);
        const byNumber = new Map(scene.rows.map(row => [row.lineNumber, row]));
        for (const speech of speechesOf(scene)) {
            ++speeches;
            const rows = speech.rows.map(number => byNumber.get(number));
            const at = {file: fileName, lineNumber: speech.lineNumber, speaker: speech.speaker, rows};

            // Rows the game says nothing on are the game's own spacing, and a
            // translation owes them nothing. A speech made of them entirely --
            // a beat between two bubbles -- is not a speech to have an opinion
            // about at all.
            const spoken = rows.filter(carriesText);
            if (!spoken.length) {
                continue;
            }

            const signals = shiftSignals(rows);
            if (signals.length) {
                findings.push({...at, class: "shifted", kind: signals[0].kind, signals});
                continue;
            }

            if (!speech.english.trim()) {
                // A speech nobody translated. Only its rows' emptiness says so:
                // the Japanese is there and the game will play it.
                findings.push({...at, class: "untranslated", kind: "no English at all"});
                continue;
            }

            const filled = spoken.map(row => Boolean(englishOf(row)));
            // Drawn over every row, because a blank one still takes a line of
            // the window; laid out over the spoken ones, because those are the
            // only rows a layout may put words in.
            const drawn = drawnLines(rows.map(englishOf));
            const budget = rowBudget(rows.length);
            // Voice by voice, the way the build lays it out: a speech whose
            // speaker changes part way is two people's rows and the layout may
            // not move words between them. Offering a fix the build would not
            // produce is worse than offering none.
            const spokenAt = new Set(spoken.map(row => row.lineNumber));
            const again = layOutVoices(speech.voices,
                voiceRows => voiceRows.filter(lineNumber => spokenAt.has(lineNumber)));
            const howItWouldGo = {
                drawn,
                budget,
                // What laying it out again would put in the rows, so that a
                // report can show the fix rather than assert one exists.
                laidOut: again.rows,
                fixes: again.fits,
                stillOverflows: !again.fits,
            };

            if (drawn > budget && !inHistoryFrame(fileName, speech.lineNumber)) {
                if (draft) {
                    ++draftsHeld;
                    continue;
                }
                findings.push({
                    ...at,
                    class: "overflow",
                    kind: filled.includes(false)
                        ? `${blankKind(filled)}, and too long for the window`
                        : "too long for the window",
                    overflows: true,
                    ...howItWouldGo,
                });
                continue;
            }

            if (filled.includes(false)) {
                findings.push({
                    ...at,
                    class: "blank",
                    kind: blankKind(filled),
                    overflows: false,
                    ...howItWouldGo,
                });
                continue;
            }

            // A fold is invisible to the budget above -- two rows drawn in
            // three still fit a window that draws three -- so it is asked as a
            // question of its own rather than read off that answer. Every row
            // is filled by here: the blank class returned already.
            if (folds(rows.map(englishOf)) && !inHistoryFrame(fileName, speech.lineNumber)) {
                const unfolds = !again.tooFewWords && !folds(again.rows)
                    && !again.rows.some(clipsInBacklog);
                // Draft first: a t… scene is the scenario document and is never
                // drawn, so neither kind of fold in one is anybody's work. Asking
                // `unfolds` first put the unfixable ones in the translator's list.
                if (draft) {
                    ++draftFoldsHeld;
                } else if (!unfolds) {
                    const widest = Math.max(...again.rows.map(backlogEms));
                    heldFolds.push({
                        ...at,
                        kind: "more English than its rows can draw",
                        laidOut: again.rows,
                        widest,
                        over: widest - BACKLOG_EDGE,
                    });
                } else {
                    findings.push({
                        ...at,
                        class: "fold",
                        kind: "a row folded that the same rows could hold whole",
                        overflows: false,
                        ...howItWouldGo,
                    });
                    continue;
                }
            }

            const missing = [];
            if (opens(speech.japanese, "「") && !opens(speech.english, "「")) {
                missing.push("opening 「");
            }
            if (closes(speech.japanese, "」") && !closes(speech.english, "」")) {
                missing.push("closing 」");
            }
            if (missing.length) {
                findings.push({...at, class: "bracket", kind: `no ${missing.join(" and no ")}`});
            }
        }
    }

    return {scenes: scenes.length, speeches, findings, draftsHeld, heldFolds, draftFoldsHeld};
};

/** How many findings each class holds, in the order they are worth reading. */
export const countByClass = (findings) => Object.fromEntries(
    CLASSES.map(name => [name, findings.filter(finding => finding.class === name).length]));
