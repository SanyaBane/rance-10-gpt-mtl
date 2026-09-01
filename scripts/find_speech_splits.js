/**
 * Where the English draws a boundary between utterances that the game does not.
 *
 *   node scripts/find_speech_splits.js                  # the report
 *   node scripts/find_speech_splits.js --class=crammed  # one class, all of it
 *   node scripts/find_speech_splits.js --limit=12       # more of each class
 *   node scripts/find_speech_splits.js --scene=033028   # one scene
 *
 * The fault a player sees is `together?」 「Huh? Defeating the Demon King?」` --
 * a closing bracket and an opening one in the middle of a row, where the game
 * gives the second utterance a row of its own. Sometimes it is worse than that:
 * the row the English overran belongs to a different speaker, so one character
 * says another's line.
 *
 * modules/SpeechSplits.js is what each class is, and why neither
 * find_speech_gaps nor find_speech_brackets reports any of it.
 *
 * It reads text_languages/<lang>/scenes/ and nothing else: no alice-tools, no
 * GAME_DIR, and no corpus.
 */
import {flagValue} from "../modules/Argv.js";
import {run} from "../modules/AliceTools.js";
import {CLASSES, countByClass, findSpeechSplits} from "../modules/SpeechSplits.js";
import {textLangName} from "../modules/TextLanguages.js";

/** A row as the report shows it: the number, the Japanese, and what is on it. */
const showRow = (row, flagged) => console.log(`  ${flagged ? ">>" : "  "} m[${row.lineNumber}] `
    + `${JSON.stringify(row.japanese).slice(0, 44).padEnd(46)} ${JSON.stringify(row.english).slice(0, 62)}`);

await run(async () => {
    const only = flagValue("class");
    if (only && !CLASSES.includes(only)) {
        console.error(`--class takes one of ${CLASSES.join(", ")}.`);
        return 1;
    }
    const limit = flagValue("limit") === undefined ? 4 : Number(flagValue("limit"));
    const scene = flagValue("scene");

    const textLang = textLangName();
    const {scenes, speeches, findings, drafts} = await findSpeechSplits(textLang, scene);
    if (!scenes) {
        console.log(scene
            ? `text_languages/${textLang}/scenes/ has no scene called ${JSON.stringify(scene)}.`
            : `text_languages/${textLang}/scenes/ holds no scene files, so there is nothing to read.`);
        return scene ? 1 : 0;
    }

    const wanted = findings.filter(finding => !only || finding.class === only);
    const counts = countByClass(wanted);

    console.log(`${wanted.length} speeches of ${speeches} in ${scenes} scenes of the "${textLang}"`
        + " text language put a boundary between utterances where the game puts none");
    for (const name of CLASSES) {
        if (counts[name]) {
            console.log(`  ${String(counts[name]).padStart(5)}  ${name}`);
        }
    }
    if (drafts) {
        // Said rather than dropped: 185 of the first run's 192 were in these,
        // and "the report is 12" and "12, plus 185 nobody will read" are
        // different facts about the same patch.
        console.log(`\n${drafts} more are in a t… scene -- the scenario document the writer handed`
            + " the scripter, which the game does not play and whose own notes quote dialogue"
            + " inline. Not counted above.");
    }

    for (const name of CLASSES) {
        const group = wanted.filter(finding => finding.class === name);
        if (!group.length) {
            continue;
        }
        console.log(`\n--- ${group.length} ${name} ---`);
        for (const finding of group.slice(0, only ? group.length : limit)) {
            const flagged = new Set(finding.signals.map(signal => signal.lineNumber));
            console.log(`${finding.file} m[${finding.lineNumber}] ${finding.speaker}`
                + ` -- ${finding.signals.map(signal => `m[${signal.lineNumber}] ${signal.class}`).join(", ")}`);
            for (const row of finding.rows) {
                showRow(row, flagged.has(row.lineNumber));
            }
        }
        if (!only && group.length > limit) {
            console.log(`  ... ${group.length - limit} more, --class=${name} for all of them`);
        }
    }

    console.log("\nNothing here is read by a build. The fix is to lay the speech's rows out again"
        + " so each utterance starts on the row the game starts it on; widths are"
        + " find_speech_gaps' question, not this one.");
    return 0;
});
