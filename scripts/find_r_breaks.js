/**
 * Which English the game cuts apart at the letter r, and which separator to blame.
 *
 *   node scripts/find_r_breaks.js              # the report
 *   node scripts/find_r_breaks.js --limit=40   # more of each list
 *   node scripts/find_r_breaks.js --all        # every finding
 *
 * The letter r is the game's own line-break marker, free in Japanese and
 * unaffordable in English: "HP and skill uses|are restored|Yay!" arrives on
 * screen as six lines, four of them fragments. The marker is not compiled into
 * the code, though -- it is a string slot the code pushes -- so a separator
 * cherry-picked as CR takes the letter out of the set and leaves everything
 * else alone. modules/RBreaks.js is how the sites are found and
 * docs/r-line-breaks.md is what to do about an open one.
 *
 * It reads the code dump and the text dump under game/ain/, so it needs
 * alice-tools the first time build/ has no code dump and nothing at all
 * afterwards. No GAME_DIR, and it writes nothing.
 */
import {flagValue, hasFlag} from "../modules/Argv.js";
import {run} from "../modules/AliceTools.js";
import {readRBreaks} from "../modules/RBreaks.js";

const quote = (text) => JSON.stringify(text ?? null);

/** What an open separator will do to a slot, against what its Japanese asked for. */
const showFinding = (finding) => {
    const written = finding.english === undefined ? "not translated here"
        : `wants ${finding.wanted} break${finding.wanted === 1 ? "" : "s"}, draws ${finding.drawn}`;
    console.log(`  s[${finding.slot}] -- ${written}`);
    console.log(`     jp ${quote(finding.japanese)}`);
    if (finding.english !== undefined) {
        console.log(`     en ${quote(finding.english)}`);
    }
};

/** An open separator draws a break the Japanese never asked for. */
const broken = (finding) => finding.english !== undefined && finding.drawn !== finding.wanted;

/**
 * With every separator closed, a break is drawn where the text holds CR or LF
 * and nowhere else -- so a line that still spells its break with the letter,
 * or that dropped it on the way into English, is one the fix cannot save.
 */
const wouldLose = (finding) =>
    finding.english !== undefined && finding.wanted > 0 && !["\\r", "\\n"].includes(finding.escape);

await run(async () => {
    const limit = hasFlag("all") ? Infinity
        : flagValue("limit") === undefined ? 8 : Number(flagValue("limit"));

    const {dumped, separators, reached, marked} = await readRBreaks();
    if (dumped) {
        console.log("Dumped the game's code into build/ -- later runs read it from there.\n");
    }

    const sites = separators.reduce((total, entry) => total + entry.sites.length, 0);
    console.log(`${sites} places in the .ain read the letter r as a line break,`
        + ` and they push ${separators.length} separator slots between them:`);
    for (const entry of separators) {
        const slot = entry.slot === null
            ? `pushed by ${entry.slots.length} slots, so no one line decides it`
            : `s[${entry.slot}]`;
        const state = entry.override === undefined
            ? entry.open ? "OPEN -- the cherry-picks do not override it" : "no r in it to begin with"
            : `cherry-picked as ${quote(entry.override)}${entry.open ? " -- STILL OPEN" : ", so the letter is out"}`;
        console.log(`\n  ${quote(entry.separator)} ${slot}: ${state}`);
        for (const site of entry.sites) {
            console.log(`     ${site.functionName}`);
        }
    }

    const open = separators.filter(entry => entry.open);
    if (!open.length) {
        console.log("\nNo separator still holds the letter, so no English is cut apart at an r.");
    } else {
        const damaged = reached.filter(broken);
        console.log(`\nWalking the callers of the ${open.length === 1 ? "open separator" : "open separators"}`
            + ` above reaches ${reached.length} slots handed in as literals,`
            + ` ${damaged.length} of which are translated and break in the wrong places:`);
        for (const finding of damaged.slice(0, limit)) {
            showFinding(finding);
        }
        if (damaged.length > limit) {
            console.log(`  ... ${damaged.length - limit} more, --all for every one`);
        }
    }

    const marks = marked.filter(finding => finding.english !== undefined);
    console.log(`\n${marked.length} further slots carry the marker in their own Japanese, so each is drawn`
        + ` on one of these paths whether or not the walk above reached it, and ${marks.length} of them`
        + " are translated in the cherry-picks.");

    const lost = marks.filter(wouldLose);
    console.log(`\nWith every separator closed a break is drawn where the English holds CR (\\r) or LF (\\n)`
        + ` and nowhere else. ${marks.length - lost.length} of those ${marks.length} lines say it that way;`
        + ` ${lost.length} do not, and would be drawn as one long line:`);
    for (const finding of lost.slice(0, limit)) {
        showFinding(finding);
    }
    if (lost.length > limit) {
        console.log(`  ... ${lost.length - limit} more, --all for every one`);
    }

    console.log("\nNothing here is read by a build, and nothing here has been written.");
    return 0;
});
