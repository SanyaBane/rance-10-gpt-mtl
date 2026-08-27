/**
 * Where a speech and the English in its rows have come apart.
 *
 *   node scripts/find_speech_gaps.js                    # the report
 *   node scripts/find_speech_gaps.js --class=shifted    # one class, all of it
 *   node scripts/find_speech_gaps.js --limit=12         # more of each class
 *   node scripts/find_speech_gaps.js --overflowing      # only what does not fit the window
 *
 * This is the question a person kept answering by playing the game: a bubble
 * with a gap in the middle of it, and, rarer and worse, a narrator saying a line
 * that belongs to the character after them. Both are findable now and were not
 * before -- modules/SpeechGaps.js says what changed and what each class is.
 *
 * It reads text_languages/<lang>/scenes/ and nothing else: no alice-tools, no
 * GAME_DIR, and no corpus. What it reports is what a build of those scenes
 * would put in front of a player.
 */
import {flagValue, hasFlag} from "../modules/Argv.js";
import {run} from "../modules/AliceTools.js";
import {CLASSES, countByClass, findSpeechGaps} from "../modules/SpeechGaps.js";
import {textLangName} from "../modules/TextLanguages.js";

/** A row as the report shows it: the number, the Japanese, and what is on it. */
const showRow = (row, indent = "    ") => console.log(`${indent}m[${row.lineNumber}] `
    + `${JSON.stringify(row.japanese).slice(0, 46).padEnd(48)} ${JSON.stringify(row.english).slice(0, 62)}`);

await run(async () => {
    const only = flagValue("class");
    if (only && !CLASSES.includes(only)) {
        console.error(`--class takes one of ${CLASSES.join(", ")}.`);
        return 1;
    }
    const limit = flagValue("limit") === undefined ? 4 : Number(flagValue("limit"));
    const overflowingOnly = hasFlag("overflowing");

    const textLang = textLangName();
    const {scenes, speeches, findings} = await findSpeechGaps(textLang);
    if (!scenes) {
        console.log(`text_languages/${textLang}/scenes/ holds no scene files, so there is nothing to read.`);
        return 0;
    }

    const wanted = findings.filter(finding => (!only || finding.class === only)
        && (!overflowingOnly || finding.overflows));
    const counts = countByClass(wanted);

    console.log(`${wanted.length} speeches of ${speeches} in ${scenes} scenes of the "${textLang}"`
        + " text language have something wrong with how their English sits in their rows");
    for (const name of CLASSES) {
        if (counts[name]) {
            console.log(`  ${String(counts[name]).padStart(5)}  ${name}`);
        }
    }

    // The class a player sees whatever else is true of the speech: what runs
    // off the box, and how much of it a layout can take back.
    const over = wanted.filter(finding => finding.class === "overflow");
    if (over.length) {
        const withBlank = over.filter(finding => finding.kind.includes("blank")).length;
        console.log(`\n${over.length} speeches run off the window, ${over.length - withBlank} of them with`
            + ` every row filled and nothing else the matter. Laying them out again fits`
            + ` ${over.filter(f => f.fixes).length}; the other ${over.filter(f => f.stillOverflows).length}`
            + " hold more English than their rows can draw whatever the layout, and want shortening"
            + " by meaning.");
    }

    for (const name of CLASSES) {
        const group = wanted.filter(finding => finding.class === name);
        if (!group.length) {
            continue;
        }
        console.log(`\n--- ${group.length} ${name} ---`);
        for (const finding of group.slice(0, only ? group.length : limit)) {
            console.log(`${finding.file} m[${finding.lineNumber}] ${finding.speaker} -- ${finding.kind}`
                + (finding.overflows ? `, drawn in ${finding.drawn} lines of ${finding.budget}` : ""));
            for (const row of finding.rows) {
                showRow(row);
            }
            if (finding.laidOut && finding.overflows) {
                console.log("      laid out again:");
                for (const row of finding.laidOut) {
                    console.log(`        ${JSON.stringify(row).slice(0, 76)}`);
                }
            }
        }
        if (!only && group.length > limit) {
            console.log(`  ... ${group.length - limit} more, --class=${name} for all of them`);
        }
    }

    console.log("\nNothing here is read by a build. modules/SpeechGaps.js says which of these"
        + " a layout can fix and which is somebody's edit.");
    return 0;
});
