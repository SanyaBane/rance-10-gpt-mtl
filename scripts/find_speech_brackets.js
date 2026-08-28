/**
 * Where a speech's English lost the bracket its Japanese opened or closed with.
 *
 *   node scripts/find_speech_brackets.js                     # the report
 *   node scripts/find_speech_brackets.js --scene=030521.tsv  # one scene, all of it
 *   node scripts/find_speech_brackets.js --bucket=closing-lost
 *   node scripts/find_speech_brackets.js --limit=20
 *
 * 「かっ……か、かかか、かない！？」 came back as 「W-wife!? and the player sees a
 * bubble that never closes. modules/SpeechBrackets.js says which buckets there
 * are, which of them a rule can decide and which want reading.
 *
 * It reads text_languages/<lang>/scenes/ and nothing else -- no alice-tools, no
 * GAME_DIR, no corpus -- and writes nothing.
 */
import {flagValue} from "../modules/Argv.js";
import {run} from "../modules/AliceTools.js";
import {BUCKETS, countByBucket, englishOf, findSpeechBrackets, holds} from "../modules/SpeechBrackets.js";
import {textLangName} from "../modules/TextLanguages.js";

const cell = (text, width) => JSON.stringify(text).slice(0, width).padEnd(width);

/** One speech, row by row: what the game says, what the English says, and what it would say. */
const showFinding = (finding) => {
    const marks = finding.symbols.length ? ` ${finding.symbols.join(" ")}` : "";
    const fit = finding.pushedOver
        ? `, and the fix pushes it over the window: ${finding.drawn} -> ${finding.after} of ${finding.budget}`
        : finding.overflowedBefore ? `, already over the window: ${finding.drawn} of ${finding.budget}` : "";
    const checked = finding.shifted
        ? "  !! inside a shifted run: the English on these rows belongs to other rows"
        : finding.verified && !holds(finding.verified)
            ? `  !! the fix does not verify:${finding.verified.matches ? "" : ` shape ${finding.verified.shape || "(none)"}`}`
                + `${finding.verified.kept ? "" : " the text on the rows changed"}`
                + `${finding.verified.filled ? "" : " it would leave a row empty"}`
            : "";
    console.log(`${finding.file} m[${finding.lineNumber}] ${finding.speaker}`
        + ` -- ${finding.bucket}${marks}, ${finding.shape.japanese || "(none)"}`
        + ` -> ${finding.shape.english || "(none)"}${fit}${checked}`);
    for (const row of finding.rows) {
        const after = finding.edits.get(row.lineNumber);
        console.log(`   ${String(row.lineNumber).padStart(6)} ${cell(row.japanese, 44)}`
            + ` ${cell(englishOf(row), 52)}${after === undefined ? "" : ` -> ${JSON.stringify(after)}`}`);
    }
};

await run(async () => {
    const scene = flagValue("scene");
    const only = flagValue("bucket");
    if (only && !BUCKETS.includes(only)) {
        console.error(`--bucket takes one of ${BUCKETS.join(", ")}.`);
        return 1;
    }
    const limit = flagValue("limit") === undefined ? 4 : Number(flagValue("limit"));

    const textLang = textLangName();
    const {speeches, findings} = await findSpeechBrackets(textLang, scene);
    if (!speeches) {
        console.log(scene
            ? `text_languages/${textLang}/scenes/${scene} holds no translated speech.`
            : `text_languages/${textLang}/scenes/ holds no scene files, so there is nothing to read.`);
        return 0;
    }

    const wanted = findings.filter(finding => !only || finding.bucket === only);
    const counts = countByBucket(wanted);
    const where = scene ? `${scene}` : `the "${textLang}" text language`;
    console.log(`${wanted.length} speeches of ${speeches} in ${where} carry brackets`
        + " their Japanese does not");
    for (const name of BUCKETS) {
        if (counts[name]) {
            console.log(`  ${String(counts[name]).padStart(5)}  ${name}`);
        }
    }

    // The post-condition, and the only line here worth reading twice: a fix is
    // right when the rows it produced say so, not when the rule that made it
    // says so. Both halves are asked -- the brackets in order, which subsumes
    // any tally of them, and the rest of the row unmoved.
    const fixable = wanted.filter(finding => finding.verified);
    const failed = fixable.filter(finding => !holds(finding.verified));
    console.log(`\n${fixable.length - failed.length} of ${wanted.length} findings have a fix that verifies:`
        + " the English then carries the same brackets in the same order as the Japanese, nothing else on"
        + " the rows moved, and no row was left empty. The other"
        + ` ${wanted.length - fixable.length + failed.length} want reading, and are marked !! below.`);

    const shifted = wanted.filter(finding => finding.shifted);
    if (shifted.length) {
        console.log(`${shifted.length} of those are inside a shifted run and are not a bracket fault at all:`
            + " SHIFTED_RUNS in modules/SpeechBrackets.js says which rows and how they were found.");
    }

    const pushed = wanted.filter(finding => finding.pushedOver);
    if (pushed.length) {
        console.log(`\n${pushed.length} of the fixes push a speech that fits today past its window,`
            + " because a bracket is a character wide. They are named again at the end.");
    }

    for (const name of BUCKETS) {
        const group = wanted.filter(finding => finding.bucket === name);
        if (!group.length) {
            continue;
        }
        console.log(`\n--- ${group.length} ${name} ---`);
        const shown = scene || only ? group : group.slice(0, limit);
        for (const finding of shown) {
            showFinding(finding);
        }
        if (shown.length < group.length) {
            console.log(`  ... ${group.length - shown.length} more, --bucket=${name} for all of them`);
        }
    }

    if (pushed.length) {
        console.log(`\n--- ${pushed.length} the fix pushes past the window ---`);
        for (const finding of pushed) {
            console.log(`${finding.file} m[${finding.lineNumber}] ${finding.speaker}`
                + ` -- ${finding.bucket}, drawn in ${finding.drawn} lines of ${finding.budget},`
                + ` ${finding.after} once the bracket is back`);
        }
    }

    console.log("\nNothing here is read by a build, and nothing here has been written.");
    return 0;
});
