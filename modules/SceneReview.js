/**
 * Reading a translation that already exists, and changing only what it gets
 * wrong.
 *
 * The other pipeline -- modules/ScenePrompt.js and modules/SceneAcceptance.js,
 * driven by docs/scene-driver.md -- hands a scene over with no English on the
 * page and takes a whole retranslation back. This one is the opposite ask: the
 * English is on the page, the house style is settled, and what comes back is a
 * list of the speeches that say something the Japanese does not. `she` where the
 * cast list says he, a negation dropped, a sentence that ended up in the wrong
 * mouth.
 *
 * **The unit is the voice, not the file and not the row.** A voice is one
 * speaker's run of rows inside one bubble -- modules/SceneFile.js splits them --
 * and it is what a reviewer can read as a sentence and answer as a sentence.
 * The rows underneath it are where the layout fell and are worked out again
 * here by modules/SpeechRows.js; the file is far too big a unit, because a
 * review that lands whole or not at all throws away nine good corrections for
 * the tenth that overflowed.
 *
 * That last point is the one real difference from the acceptance next door,
 * and it is safe for a reason that does not hold there: **a correction cannot
 * shift anything.** A retranslation that comes back short shifts every line
 * after the gap, because the game is handed one English line per m[] number and
 * the numbers come from the answer. A review names the number it is changing
 * and the row count never moves, so an edit that is refused leaves the line it
 * was about exactly as it was. Per-edit is therefore the honest granularity,
 * and this module refuses per edit and says why.
 *
 * What it will not let through, in the order the checks read:
 *
 *   - a number that is not a voice of this scene, or came back twice;
 *   - a tab, a line break, or an empty correction where the game speaks;
 *   - ＜エール＞ resolved to a name -- the token the game replaces at runtime
 *     with what the player typed;
 *   - brackets the old line had and the new one does not: modules/SpeechBrackets.js
 *     compares them in order, because 「」 and 」「 hold the same two characters;
 *   - a correction that no longer fits the window, or that the backlog would
 *     clip, where the line it replaces did fit;
 *   - a speech whose rows are the ■歴史枠 chronology or one of the shifted runs
 *     -- neither is this pass's to lay out;
 *   - a gender branch flattened into one sentence by the correction.
 *
 * Every one of those is "do not make it worse" rather than "be perfect": a
 * line that already overflowed and still does is let through with a warning,
 * because the corpus has 839 of those and refusing them would refuse the fix
 * for the pronoun as well. modules/SpeechGaps.js is the report that owns them.
 */
import * as fs from "fs/promises";
import * as path from "path";
import {PLAYERS_CHOICE} from "./CharacterGenders.js";
import {BUILD} from "./Env.js";
import {describeFlattenedRoute, flattenedRoutes, GENDERED, SUBSTITUTIONS} from "./SceneAcceptance.js";
import {speechesOf} from "./SceneFile.js";
import {castBlock, EL_RULE, glossaryFor, NUMBER_RULE, SOUND_RULES, TEXT_RULES} from "./ScenePrompt.js";
import {CG_FLAG, ROUTE_FLAG} from "./SceneIndex.js";
import {bracketsAgree, carriesText, isShifted} from "./SpeechBrackets.js";
import {clipsInBacklog, drawnLines, inHistoryFrameOf, layOutSpeech, rowBudget} from "./SpeechRows.js";
import {textLangDir} from "./TextLanguages.js";

/** build/scene-review: the scenes that are out with a reviewer, and what came back. */
export const REVIEW = path.join(BUILD, "scene-review");

/** Every edit of a run, applied or not, for a person to read afterwards. */
export const REPORT = path.join(BUILD, "scene-review.tsv");

/** Appended to as scenes land, so a killed run still leaves its trail. */
export const LOG = path.join(BUILD, "scene-review.log");

const stem = (fileName) => fileName.replace(/\.tsv$/, "");

export const promptFile = (fileName) => path.join(REVIEW, `${stem(fileName)}.prompt.md`);
export const answerFile = (fileName) => path.join(REVIEW, `${stem(fileName)}.answer.tsv`);

/** What the answer is read as: the number, the corrected speech, and why. */
const ROW = /^(\d+)\t([^\t]*)(?:\t(.*))?$/;

/**
 * What a correction says it is, which decides where it goes.
 *
 * `meaning` and `english` are written into the patch. `name` is collected and
 * not applied: a name spelled wrong in one scene is spelled wrong in every scene
 * that says it -- イラーピュ is "Irapyu" in ten of them against the table's
 * "Ylapu" -- and this repository mends those with one sweep, which is what
 * scripts/find_term_drift.js and CLAUDE.md's rule about a sweep finishing in the
 * built file are for. Fixing one scene's copy leaves nine and finishes nothing.
 *
 * The reviewer names the kind rather than this working it out. What separates a
 * name correction from a meaning one is *why* the word changed, which is in the
 * reviewer's head and not in the diff -- and a mis-named kind is one line in the
 * report to read, where a guessed one is silent.
 */
export const KINDS = ["meaning", "english", "name"];

const KIND = new RegExp(`^(${KINDS.join("|")})\s*:\s*(.*)$`, "i");

/** A correction may not carry a raw tab or a line break, for the file's sake. */
const CONTROL = /[\r\n]/;

/**
 * The units a review is asked about: one speaker's run of rows inside one
 * bubble, keyed by its first row.
 *
 * The speech would be the obvious unit and is the wrong one by 297 speeches:
 * those change speaker without the click that would end them, and one line of
 * English for the pair cannot be laid back out -- there is no way to say which
 * half of it belongs to which speaker's rows. docs/speech-voices.md is that
 * class. Every other speech has exactly one voice and this is the speech.
 *
 * The state comes off the unit's own rows and falls back to the speech's,
 * because modules/SceneFile.js writes it only where it changes and a reviewer
 * reading "(怒り)" beside the line is reading the one thing the text cannot say.
 *
 * @param {import("./SceneFile.js").parseSceneFile} scene
 */
export const reviewUnits = (scene) => {
    const byNumber = new Map(scene.rows.map(row => [row.lineNumber, row]));
    const units = [];
    for (const speech of speechesOf(scene)) {
        for (const voice of speech.voices) {
            const rows = voice.rows.map(number => byNumber.get(number));
            units.push({
                lineNumber: voice.rows[0],
                speaker: voice.speaker,
                state: rows.map(row => row.state).find(Boolean) ?? speech.state,
                japanese: voice.japanese,
                english: voice.english,
                rows,
                route: speech.route,
                speech,
                /** Whether this is the whole bubble or one voice of a shared one. */
                shares: speech.voices.length > 1,
            });
        }
    }
    return units;
};

const REVIEW_RULES = `## What this is

This scene is already translated, and the English is beside the Japanese below.
You are reading one against the other and changing **only what the English gets
wrong**. It is not a draft to be improved: its register, its word choice and its
punctuation are the house style of a patch 269 617 lines long, and a scene
rewritten to read better is a scene nobody can review.

Most scenes should come back with nothing in them, or with one line. That is the
expected answer, not a failure to find anything.

## Send back only the speeches you are changing

One line per correction -- the number, a tab, the whole corrected speech, a tab,
and the reason, which opens with the kind of fault it is:

\`\`\`
223993	「Fufufu, but isn't this fine.」	meaning: Miracle is a woman; the English said "he"
\`\`\`

Nothing else on the line, and nothing at all for a speech you are not changing.
Anything that is not one of these lines is read by a person and ignored by the
machine -- so say what you like around them, but a correction with no reason is
refused, because a change nobody can name a fault for is a rewrite.

**The first word of every reason is one of three kinds, and a colon after it:**

- **\`meaning:\`** -- the English says something the Japanese does not. A pronoun
  for the wrong person, a negation that fell out, an action given to the wrong
  character, a number that changed, a question turned into a statement of the
  opposite, half of one speech sitting in the next, Japanese left untranslated,
  a speech saying nothing while the Japanese speaks, somebody addressed by the
  wrong title.
- **\`english:\`** -- the English is broken rather than plain. "a ancient city",
  "an dishonest man", a sentence that stops without finishing, a word typed
  twice, a letter missing out of one. The test is whether you can name what is
  wrong with it in a word: a wrong article is a fault, "clunky" is not.
- **\`name:\`** -- a name, a place or a settled term spelled some way other than
  the table below spells it.

The first two are written into the patch. **A \`name:\` correction is collected
rather than applied**, and that is not a rejection: a name spelled wrong here is
spelled wrong in every scene that says it, and those are mended with one sweep
over the whole corpus rather than one scene at a time. Send it anyway -- the
sweep is built out of what these runs report.

**Send the whole speech, not the words you changed.** The number names one
bubble and what you send replaces all of it. Write it as a single line however
many rows it is shown in: the rows below are where Japanese typesetting fell and
the build lays your English back into them by width.

**Change as little as possible inside it.** Put the pronoun right and leave the
rest of the sentence exactly as it stands. A correction that also tidies the
grammar around it is two edits, one of which nobody asked for, and it hides the
one that mattered.

## Before you answer, name the pronouns

Read the scene through once. Then go back over it and, **for every he, him,
his, she, her and hers in the English, say who it is** -- by name, off the cast
list. Write that list out in the prose part of your answer if you like; the
machine ignores prose and it costs nothing.

This is asked for because a pronoun for the wrong person is the fault this pass
exists for and the one that is invisible to a reading. Read for meaning, "I knew
he liked rare items" is a perfectly good sentence about somebody; asked who
\`he\` is, it is Miracle, and Miracle is a woman. A run that was not asked to name
them found three faults of four in a scene, and the one it missed was that.

## What is not worth changing

- **English that is plain, stiff or blunt and says the right thing.** Wanting a
  better sentence is not a fault, and \`english:\` is for a sentence that is
  wrong rather than one that is dull. This translation reads flat on purpose in
  places and by accident in more, and neither is worth the risk of an edit.
- A word you would have chosen differently. A shorter sentence than the
  Japanese. A comma, a capital.
- A missing subject, a "gonna", a sentence opening with "and" -- that is how
  somebody talks.
- **The dots.** A long Japanese ellipsis answered by a long run of dots, one to
  a character, is how this patch writes a silence -- 20 457 rows of it. Counting
  them is not a correction.
- Anything whose reason would read "reads better", "more natural" or "clearer".
  If that is the reason, there is no correction.`;

const ROUTE_RULE = `## The two Els

Lines between \`> male\` and \`> end\` are played only to a player who made El a
man; lines between \`> female\` and \`> end\` only to one who made El a woman.
**The two halves have to keep saying different things.** No player ever sees
both, so one English sentence used for the pair is one of the two players
reading a line written for the other -- and a correction that copies one half
onto the other is exactly how that happens.`;

const SHARED_RULE = `## Two speakers in one bubble

Two lines below with no blank line between them are one window, and the second
carries a name of its own. Each is answered under its own number: the game draws
them in the rows it gave each speaker, and words may not move across the point
where the speaker changes.`;

/**
 * The scene as the reviewer sees it: the number, who is talking, the Japanese
 * and the English there is now, one line per voice with a blank line between
 * bubbles.
 *
 * Four columns where the translation prompt has three, and the fourth is the
 * whole point -- the draft is deliberately withheld from a retranslation
 * (docs/scene-driver.md measures what showing it is worth) and is the subject
 * here.
 *
 * The English is joined out of its rows, the way modules/Corpus.js joins it,
 * because a correction is written as an utterance. Showing the rows would ask
 * the reviewer to write English shaped to them, which is the mistake the first
 * scene through the other pipeline made.
 */
const sceneBlock = (units) => {
    const lines = [];
    let route = null;
    let lastSpeech = null;
    for (const unit of units) {
        if (unit.route !== route) {
            route = unit.route;
            lines.push(`> ${route ?? "end"}`);
        } else if (lastSpeech && unit.speech !== lastSpeech) {
            lines.push("");
        }
        lastSpeech = unit.speech;
        const who = unit.state ? `${unit.speaker} (${unit.state})` : unit.speaker;
        lines.push([unit.lineNumber, who, unit.japanese, unit.english].join("\t"));
    }
    return lines.join("\n");
};

/**
 * One scene, ready to hand to a reviewer.
 *
 * @param {import("./SceneFile.js").parseSceneFile} scene the translated scene
 * @param {Awaited<ReturnType<import("./ScenePrompt.js").readSceneGlossaries>>} glossaries
 * @param {{answerFile?: string}} [where]
 */
export const renderReviewPrompt = (scene, glossaries, where = {}) => {
    const {names, others} = glossaryFor(scene, glossaries);
    const units = reviewUnits(scene);
    const parts = [];

    parts.push(`# ${scene.name}`);
    parts.push(`Scene ${scene.functionId} of Rance 10, ${units.length} speeches, already translated.`
        + (scene.flags.includes(CG_FLAG)
            ? " The game lists this scene in its CG recollection gallery, so it is adult content."
            : "")
        + (scene.flags.includes(ROUTE_FLAG)
            ? " It branches on El's gender; see below."
            : ""));

    parts.push(REVIEW_RULES);
    /*
     * Not ELLIPSIS_RULE, which is the one rule of the translation prompt that a
     * review must not carry: the dot run is this patch's house style in 20 457
     * rows. modules/ScenePrompt.js says what happened when it did.
     */
    parts.push(TEXT_RULES);
    parts.push(NUMBER_RULE);
    parts.push(SOUND_RULES);
    if (units.some(unit => unit.route)) {
        parts.push(ROUTE_RULE);
    }
    if (units.some(unit => unit.shares)) {
        parts.push(SHARED_RULE);
    }
    if (scene.cast.some(member => member.gender === PLAYERS_CHOICE)) {
        parts.push(EL_RULE);
    }

    parts.push("## Who is in it\n\n"
        + (castBlock(scene, glossaries.voices) || "- nobody: this scene is all narration.")
        + "\n\nThe speaker column below is one of these names, `-` for narration, `?` for a message"
        + " with no speaker, and a trailing `~` for a thought the game draws in （） rather than 「」."
        + " The gender beside each name is what the pronouns in their lines -- and in the lines about"
        + " them -- have to agree with.");

    if (names.length || others.length) {
        const blocks = [];
        if (names.length) {
            blocks.push(names.map(([japanese, english]) => `- ${japanese} -- **${english}**`).join("\n"));
        }
        for (const {title, hits} of others) {
            blocks.push(`*${title}*\n` + hits.map(row => `- ${row.japanese} -- **${row.english}**`).join("\n"));
        }
        parts.push("## The English for what this scene names\n\nThese are settled. A line spelling one of"
            + " them another way is worth correcting; a line spelling it this way is not, however"
            + " defensible the other spelling would have been.\n\n" + blocks.join("\n\n"));
    }

    parts.push("## The scene\n\n```\n" + sceneBlock(units) + "\n```");

    if (where.answerFile) {
        parts.push(`## Where it goes\n\nWrite the answer to \`${where.answerFile}\`:`
            + " one `number<TAB>corrected English<TAB>what was wrong` per correction, and nothing else"
            + " in the file. An empty file is a valid answer and means the scene is sound.");
    }

    return parts.join("\n\n") + "\n";
};

/**
 * What came back, read as corrections.
 *
 * Structural complaints only -- a number this scene has no voice for, a number
 * twice, a missing reason. Whether a correction may be written is decided by
 * applyReview below, against the rows it would land on.
 *
 * @param {import("./SceneFile.js").parseSceneFile} scene
 * @param {string} returned
 * @return {{edits: Map<number, {english: string, why: string}>, problems: string[], prose: string[]}}
 */
export const readReview = (scene, returned) => {
    const units = new Map(reviewUnits(scene).map(unit => [unit.lineNumber, unit]));
    const edits = new Map();
    const problems = [];
    const prose = [];

    for (const line of returned.split(/\r?\n/)) {
        if (!line.trim()) {
            continue;
        }
        const row = ROW.exec(line);
        if (!row) {
            prose.push(line);
            continue;
        }
        const lineNumber = Number(row[1]);
        const english = row[2];
        const why = (row[3] ?? "").trim();
        if (!units.has(lineNumber)) {
            problems.push(`${lineNumber} is not a speech of this scene`);
            continue;
        }
        if (edits.has(lineNumber)) {
            problems.push(`${lineNumber} came back twice`);
            continue;
        }
        if (!why) {
            problems.push(`${lineNumber} came back with no reason column -- a change nobody can name a`
                + " fault for is a rewrite, and this pass does not make those");
            continue;
        }
        const kind = KIND.exec(why);
        if (!kind) {
            problems.push(`${lineNumber} names no kind: a reason opens with one of`
                + ` ${KINDS.join(", ")} and a colon, and this one reads ${JSON.stringify(why.slice(0, 60))}`);
            continue;
        }
        edits.set(lineNumber, {english, kind: kind[1].toLowerCase(), why: kind[2].trim() || why});
    }

    /*
     * A correction written with spaces where the format wants tabs reads as
     * prose, and prose is ignored -- so the scene would land as "read and found
     * sound" with the finding thrown away and nothing anywhere saying so. The
     * shape is unmistakable and the silence is the expensive half, so it is a
     * complaint rather than a guess at what was meant.
     */
    const nearly = prose.filter(line => /^\d+\s/.test(line));
    if (nearly.length) {
        problems.push(`${nearly.length} lines open with a number and are not tab-separated, so they were`
            + ` read as prose and ignored: ${JSON.stringify(nearly[0].slice(0, 120))}`);
    }
    return {edits, problems, prose};
};

/** One utterance as the layout reads it: the words, and nothing about the rows. */
const wordsOf = (text) => text.trim().split(/\s+/).filter(Boolean);

/** Whether these rows fit the window they are drawn in. */
const fits = (rows) => drawnLines(rows) <= rowBudget(rows.length);

/**
 * The correction written back into the division the speech already has, when it
 * is a word-for-word change.
 *
 * The layout in modules/SpeechRows.js divides an utterance again from scratch,
 * which is right for a translation arriving as one sentence and wrong for a
 * correction. `a` mended to `an` came back as both rows of the speech rewritten
 * -- and on a speech already half again too wide for its window, the
 * rebalancing took it from three drawn lines to four and the correction was
 * refused over one letter.
 *
 * So where the correction has as many words as the speech has, each row keeps
 * its own words and its own indent. That is the minimal diff -- a reviewer who
 * changed one word sees one row change -- and it cannot draw worse than what is
 * there, because nothing moved between rows. A correction that adds or drops a
 * word has to be laid out, and takes the gates that come with it.
 *
 * Declined where a row of the speech holds no words at all: that is the blank
 * class of modules/SpeechGaps.js, and keeping the division would keep the blank.
 *
 * @param {object[]} rows the voice's spoken rows
 * @param {string} english the whole corrected voice
 * @return {string[] | null}
 */
const keepDivision = (rows, english) => {
    const wordsOfRow = (row) => row.english.replace(/^\u3000/, "").trim().split(/\s+/).filter(Boolean);
    const counts = rows.map(row => wordsOfRow(row).length);
    if (counts.some(count => count === 0)) {
        return null;
    }
    const words = english.trim().split(/\s+/).filter(Boolean);
    if (counts.reduce((sum, count) => sum + count, 0) !== words.length) {
        return null;
    }
    let at = 0;
    return rows.map((row, index) => {
        const indent = row.english.startsWith("\u3000") ? "\u3000" : "";
        const taken = words.slice(at, at + counts[index]);
        at += counts[index];
        return indent + taken.join(" ");
    });
};

/**
 * Hold every correction against the rows it would land on, and lay the ones
 * that stand into them.
 *
 * Refused per correction rather than per scene: the row count never moves, so a
 * refusal here leaves that speech exactly as it was and costs the others
 * nothing. The header says why that is safe here and is not next door.
 *
 * @param {string} fileName the scene's file, for the two tables keyed by it
 * @param {import("./SceneFile.js").parseSceneFile} scene
 * @param {Map<number, {english: string, why: string}>} edits
 * @param {(japanese: string, english: string) => string} [repairs]
 *        modules/NameNormalizer.js's pass, which the corrected line has to be a
 *        fixed point of. The repairs are written into the corpus rather than
 *        applied at build time -- CLAUDE.md's rule that a file reads the way a
 *        build of it reads -- so a correction the pass would rewrite is a line
 *        that says one thing on disk and another in the game.
 * @return {{
 *     rowEdits: Map<number, string>,
 *     applied: object[],
 *     refused: object[],
 *     unchanged: object[],
 *     collected: object[],
 *     warnings: string[],
 * }}
 */
export const applyReview = (fileName, scene, edits, repairs = (japanese, english) => english,
    holds = new Set()) => {
    const units = reviewUnits(scene);
    const byNumber = new Map(units.map(unit => [unit.lineNumber, unit]));
    const rowEdits = new Map();
    const applied = [];
    const refused = [];
    const unchanged = [];
    const collected = [];
    const warnings = [];

    const refuse = (lineNumber, why, complaint) => refused.push({
        lineNumber, why, complaint,
        kind: edits.get(lineNumber).kind,
        before: byNumber.get(lineNumber).english,
        english: edits.get(lineNumber).english,
    });

    /* A speech at a time: the window is the speech, and so is the fit. */
    const rowsByNumber = new Map(scene.rows.map(row => [row.lineNumber, row]));
    const bySpeech = new Map();
    for (const [lineNumber] of edits) {
        const unit = byNumber.get(lineNumber);
        bySpeech.set(unit.speech, [...(bySpeech.get(unit.speech) ?? []), unit]);
    }

    for (const [speech, edited] of bySpeech) {
        const rows = speech.rows.map(number => rowsByNumber.get(number));
        const numbers = edited.map(unit => unit.lineNumber);

        if (inHistoryFrameOf(fileName, speech.lineNumber)) {
            numbers.forEach(at => refuse(at, edits.get(at).why,
                "this speech is in the ■歴史枠 chronology, whose rows are a table rather than a"
                + " bubble -- scripts/relayout_chronology.js owns their layout"));
            continue;
        }
        if (rows.some(row => isShifted(fileName, row.lineNumber))) {
            numbers.forEach(at => refuse(at, edits.get(at).why,
                "this speech is in a run whose English sits one row late; re-laying it out would"
                + " redistribute somebody else's sentence"));
            continue;
        }
        const written = rows.filter(row => !carriesText(row) && row.english.trim());
        if (written.length) {
            numbers.forEach(at => refuse(at, edits.get(at).why,
                `the game says nothing on ${written.length} of this speech's rows and the English does`
                + " -- laying it out again would leave that English where it is as well"));
            continue;
        }

        /* Every spoken row of the speech, so the fit is asked of the window. */
        const spoken = rows.filter(carriesText);
        const before = spoken.map(row => row.english);
        const after = new Map();
        const held = [];

        for (const unit of edited) {
            const {english, why, kind} = edits.get(unit.lineNumber);
            const at = unit.lineNumber;
            if (CONTROL.test(english)) {
                refuse(at, why, "the correction holds a line break");
                continue;
            }
            if (english === unit.english) {
                unchanged.push({lineNumber: at, why, kind, english});
                continue;
            }
            const voiceRows = unit.rows.filter(carriesText);
            if (!voiceRows.length) {
                refuse(at, why, "the game says nothing on any of this speech's rows");
                continue;
            }
            if (!english.trim()) {
                refuse(at, why, "the correction is empty and the game speaks here");
                continue;
            }
            for (const token of SUBSTITUTIONS) {
                if (unit.japanese.includes(token) && !english.includes(token)) {
                    refuse(at, why, `the correction drops ${token}, which the game replaces at runtime`
                        + " -- resolving it writes one player's name into everybody's game");
                }
            }
            if (refused.some(one => one.lineNumber === at)) {
                continue;
            }
            if (bracketsAgree(unit.japanese, unit.english) && !bracketsAgree(unit.japanese, english)) {
                refuse(at, why, `the brackets no longer match the Japanese: ${JSON.stringify(english)}`
                    + ` against ${JSON.stringify(unit.japanese)}`);
                continue;
            }
            const repaired = repairs(unit.japanese, english);
            if (repaired !== english) {
                refuse(at, why, "the correction spells a name the way the repair pass rewrites,"
                    + ` so the file would stop reading the way a build of it reads: ${JSON.stringify(repaired)}`);
                continue;
            }
            /*
             * Held rather than written, and checked first so that what the
             * report carries is a correction that would have stood. A name is
             * swept over the whole corpus at once; the header says why.
             */
            if (holds.has(kind)) {
                collected.push({lineNumber: at, why, kind, japanese: unit.japanese,
                    before: unit.english, english});
                continue;
            }
            const kept = keepDivision(voiceRows, english);
            const laid = kept ? {rows: kept, tooFewWords: false} : layOutSpeech(english, voiceRows.length);
            if (laid.tooFewWords) {
                refuse(at, why, `the correction has fewer words than the ${voiceRows.length} rows the`
                    + " game draws it in, so some of them would be left empty");
                continue;
            }
            voiceRows.forEach((row, index) => after.set(row.lineNumber, laid.rows[index]));
            held.push({unit, why, english, rows: voiceRows});
        }

        if (!held.length) {
            continue;
        }

        const afterRows = spoken.map(row => after.get(row.lineNumber) ?? row.english);
        if (fits(before) && !fits(afterRows)) {
            held.forEach(({unit, why}) => refuse(unit.lineNumber, why,
                `the correction needs ${drawnLines(afterRows)} lines and the window draws`
                + ` ${rowBudget(afterRows.length)} -- say it shorter, the layout cannot`));
            continue;
        }
        const clipped = afterRows.filter(clipsInBacklog);
        if (clipped.length && !before.some(clipsInBacklog)) {
            held.forEach(({unit, why}) => refuse(unit.lineNumber, why,
                `${clipped.length} of the rows it would be drawn in run past the backlog's edge,`
                + " where the line it replaces did not"));
            continue;
        }
        if (!fits(afterRows)) {
            warnings.push(`m[${held[0].unit.lineNumber}] still needs ${drawnLines(afterRows)} lines`
                + ` in a window of ${rowBudget(afterRows.length)}, as the line it replaces did`);
        }

        for (const {unit, why, english, rows: voiceRows} of held) {
            for (const row of voiceRows) {
                rowEdits.set(row.lineNumber, after.get(row.lineNumber));
            }
            applied.push({
                lineNumber: unit.lineNumber,
                speaker: unit.speaker,
                japanese: unit.japanese,
                before: unit.english,
                english,
                why,
                kind: edits.get(unit.lineNumber).kind,
                rows: voiceRows.map(row => row.lineNumber),
            });
            if (unit.japanese.includes(SUBSTITUTIONS[0]) && !unit.route && GENDERED.test(english)
                && scene.cast.some(member => member.gender === PLAYERS_CHOICE)) {
                warnings.push(`m[${unit.lineNumber}] names El and the correction says`
                    + ` ${JSON.stringify(GENDERED.exec(english)[0])} -- El's gender is the player's.`
                    + " Fine if the word is about somebody else.");
            }
        }
    }

    /*
     * The one check that cannot be asked of a correction on its own: two lines
     * of a gender branch saying the same thing. A correction that copies one
     * half onto the other flattens it, and nobody sees both halves to notice.
     */
    const speeches = speechesOf(scene);
    const englishNow = new Map(speeches.map(speech => [speech.lineNumber, speech.english]));
    const englishAfter = new Map(englishNow);
    for (const one of applied) {
        const speech = speeches.find(candidate => candidate.rows.includes(one.lineNumber));
        englishAfter.set(speech.lineNumber, speech.rows
            .map(number => rowEdits.get(number) ?? rowsByNumber.get(number).english)
            .filter(text => text.trim())
            .map(text => text.replace(/^　/, ""))
            .join(" "));
    }
    const flattenedBefore = new Set(flattenedRoutes(speeches, englishNow)
        .map(one => `${one.male.lineNumber}/${one.female.lineNumber}`));
    for (const flattened of flattenedRoutes(speeches, englishAfter)) {
        if (flattenedBefore.has(`${flattened.male.lineNumber}/${flattened.female.lineNumber}`)) {
            continue;
        }
        const at = applied.filter(one =>
            flattened.male.rows.includes(one.lineNumber) || flattened.female.rows.includes(one.lineNumber));
        for (const one of at) {
            for (const number of one.rows) {
                rowEdits.delete(number);
            }
            applied.splice(applied.indexOf(one), 1);
            refuse(one.lineNumber, one.why, describeFlattenedRoute(flattened));
        }
    }

    return {rowEdits, applied, refused, unchanged, collected, warnings};
};

/**
 * What the corrections did to the words, asked of the file that was written
 * rather than of the layout that wrote it.
 *
 * The gate CLAUDE.md's rule about reading the result back asks for, one step
 * before the built `.ain`: every applied correction has to come back out of the
 * rows as the same words in the same order, and no row of the scene outside
 * those may have moved. A layout that dropped a word would otherwise be
 * invisible until somebody played the scene.
 *
 * @param {import("./SceneFile.js").parseSceneFile} written the file, re-read
 * @param {import("./SceneFile.js").parseSceneFile} before the file as it was
 * @param {object[]} applied
 */
export const verifyReview = (written, before, applied) => {
    const complaints = [];
    const units = new Map(reviewUnits(written).map(unit => [unit.lineNumber, unit]));
    const wanted = new Set(applied.flatMap(one => one.rows));

    for (const one of applied) {
        const unit = units.get(one.lineNumber);
        if (!unit) {
            complaints.push(`m[${one.lineNumber}] is not a speech of the file that was written`);
            continue;
        }
        if (wordsOf(unit.english).join(" ") !== wordsOf(one.english).join(" ")) {
            complaints.push(`m[${one.lineNumber}] reads back as ${JSON.stringify(unit.english)}`
                + ` rather than ${JSON.stringify(one.english)}`);
        }
    }

    const was = new Map(before.rows.map(row => [row.lineNumber, row.english]));
    for (const row of written.rows) {
        if (!wanted.has(row.lineNumber) && was.get(row.lineNumber) !== row.english) {
            complaints.push(`m[${row.lineNumber}] changed and no correction named it`);
        }
    }
    return complaints;
};

/** The report every run rewrites: one line per correction, applied or not. */
export const renderReport = (outcomes) => {
    const rows = ["# file\tspeech\tstatus\tkind\twhy\tcomplaint\tbefore\tafter"];
    for (const {fileName, status, one} of outcomes) {
        rows.push([
            fileName,
            one.lineNumber,
            status,
            one.kind ?? "",
            (one.why ?? "").replaceAll("\t", " "),
            (one.complaint ?? "").replaceAll("\t", " "),
            (one.before ?? "").replaceAll("\t", " "),
            (one.english ?? "").replaceAll("\t", " "),
        ].join("\t"));
    }
    return rows.join("\n") + "\n";
};

export const appendLog = async (line) => {
    await fs.mkdir(BUILD, {recursive: true});
    await fs.appendFile(LOG, line + "\n", "utf-8");
};

/**
 * Which scenes have been read, kept beside the translation rather than under
 * build/.
 *
 * Coverage cannot be a directory listing here, which is what it is for a
 * retranslation: every scene already has a file, and a reviewed one is
 * indistinguishable from an unreviewed one except that somebody has read it. So
 * it is a ledger -- and a ledger of *events* rather than of state, which is the
 * only kind that cannot go out of step with the tree. A scene reviewed on a
 * Tuesday stays reviewed however its English is edited afterwards; what the row
 * says is that the question was asked and what came of it.
 *
 * Committed, because a pass over 5433 scenes is months of asking and build/ is
 * documented as safe to delete outright. Append-only, so two runs cannot lose
 * each other's rows, and one row per scene per run -- a scene read twice gets
 * two rows, which is the honest record of what happened.
 */
export const REVIEWED = "reviewed.tsv";

const reviewedFile = (lang) => path.join(textLangDir(lang), REVIEWED);

const LEDGER_HEADER = "# file\tdate\tspeeches\tapplied\trefused\theld\tby";

/** @return {Promise<Map<string, {applied: number, refused: number}>>} by file name. */
export const readReviewed = async (lang) => {
    let text;
    try {
        text = await fs.readFile(reviewedFile(lang), "utf-8");
    } catch (error) {
        if (error.code === "ENOENT") {
            return new Map();
        }
        throw error;
    }
    const rows = new Map();
    for (const line of text.split(/\r?\n/)) {
        if (!line.trim() || line.startsWith("#")) {
            continue;
        }
        const [fileName, , , applied, refused, held] = line.split("\t");
        rows.set(fileName, {applied: Number(applied), refused: Number(refused), held: Number(held)});
    }
    return rows;
};

export const appendReviewed = async (lang, row) => {
    const file = reviewedFile(lang);
    /*
     * Read back normalised: the folder pins these to LF, but a checkout with
     * core.autocrlf=true hands the file over with \r\n and appending \n to that
     * leaves one file written both ways. modules/SceneFile.js's header is the
     * same lesson one directory down.
     */
    const held = await fs.readFile(file, "utf-8").catch(() => "");
    const head = held.replaceAll("\r\n", "\n") || `${LEDGER_HEADER}\n`;
    const line = [row.fileName, row.date, row.speeches, row.applied, row.refused, row.held, row.by]
        .join("\t");
    await fs.writeFile(file, head.endsWith("\n") ? head + line + "\n" : `${head}\n${line}\n`, "utf-8");
};

/**
 * The corrections that were held rather than written, kept beside the
 * translation for whoever runs the sweep.
 *
 * A `name:` correction is deliberately not applied: a name spelled wrong in one
 * scene is spelled wrong in every scene that says it, so mending this copy
 * finishes nothing and scripts/find_term_drift.js sweeps them all in one commit.
 * That routing only pays if the finding survives until somebody sweeps it, and
 * build/scene-review.tsv is the wrong place for it twice over. It is rewritten
 * whole by the next run, so a batch's held findings are gone the moment the
 * next batch is accepted -- which is how the four that 030324 found went
 * missing. And build/ is documented as safe to delete outright, while a pass
 * over 5433 scenes is months of asking with the sweep at the end of it.
 *
 * So this is reviewed.tsv's sibling and works the same way: append only,
 * committed, one row per held correction, an event rather than a state. A
 * finding whose word has since been swept stays in the file and is answered by
 * the sweep rather than by an edit here -- CLAUDE.md's rule is that a sweep is
 * finished when the built file says so, which no ledger can say.
 *
 * The Japanese is carried in the row because that is what a sweep is keyed on:
 * find_term_drift.js starts from a Japanese substring, and a held row that
 * named only the English would have to be looked up again in the scene.
 */
export const HELD = "held.tsv";

const heldFile = (lang) => path.join(textLangDir(lang), HELD);

const HELD_HEADER = "# file\tspeech\tdate\tkind\tjapanese\tbefore\tafter\twhy\tby";

/**
 * @param {string} lang
 * @param {object[]} rows one per held correction, as applyReview collected them
 */
export const appendHeld = async (lang, rows) => {
    if (!rows.length) {
        return;
    }
    const file = heldFile(lang);
    /* Read back normalised, for the reason appendReviewed gives above. */
    const had = await fs.readFile(file, "utf-8").catch(() => "");
    const head = had.replaceAll("\r\n", "\n") || `${HELD_HEADER}\n`;
    const cell = (text) => String(text ?? "").replaceAll("\t", " ").replaceAll("\n", " ");
    const body = rows.map(row => [row.fileName, row.lineNumber, row.date, row.kind, cell(row.japanese),
        cell(row.before), cell(row.english), cell(row.why), row.by].join("\t")).join("\n") + "\n";
    await fs.writeFile(file, head.endsWith("\n") ? head + body : `${head}\n${body}`, "utf-8");
};
