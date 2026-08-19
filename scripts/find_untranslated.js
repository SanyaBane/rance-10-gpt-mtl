/**
 * What a build still leaves in Japanese, read back out of the .ain it wrote.
 *
 *   node scripts/find_untranslated.js -o build/scratch   # a build made to check
 *   node scripts/find_untranslated.js --game             # the one installed
 *   node scripts/find_untranslated.js some/other.ain     # any .ain, by name
 *
 * Against the built file rather than against the patches, for the reason
 * CLAUDE.md gives for everything else here: a patch that renders is not a patch
 * that applied. Three of the enemy panel's strings had been translated for a
 * long time and the panel had been drawing the Japanese, because
 * patches/enemy_panel_cards.jam reassembles the function that draws it and a
 * literal in a .jam is assembled against the table the text patch has already
 * edited. Nothing that reads the sources could have seen that. A dump of the
 * output shows it in one line.
 *
 * The report is candidates. What each one is -- a word, a key, a CG name, a
 * token the enemy AI compares against -- is the reading CLAUDE.md describes,
 * and the categories below only decide what to read first.
 */
import * as fs from "fs/promises";
import * as path from "path";
import {withoutFlags} from "../modules/Argv.js";
import {alice, outputDir, run} from "../modules/AliceTools.js";
import {BUILD, ensureBuild} from "../modules/Env.js";
import {countByCategory, findUntranslated} from "../modules/Untranslated.js";

/**
 * The .ain to read: whichever one is named, or the Rance10.ain in the directory
 * a build would have installed into -- so the flags that sent the build
 * somewhere send the scan after it.
 *
 * Named as a path rather than as a flag because the other thing worth scanning
 * is a file that was never installed anywhere: a release folder, or a copy kept
 * to compare against.
 */
const scanned = () => {
    const [named] = withoutFlags(process.argv.slice(2), ["out", "o"], ["game"]);
    return named ? path.resolve(named) : path.join(outputDir(), "Rance10.ain");
};

/**
 * The functions against one slot, short enough to read. A word the game keeps a
 * lot of -- 魔法 is pushed by 108 of them, most of them scenario functions --
 * makes a line nothing can be read out of, and the count is the part that
 * matters anyway: a slot with a hundred pushers is a key, whatever any one of
 * them is called.
 */
const pushers = (functions) => {
    const shown = functions.slice(0, 3).join(" / ");
    return functions.length > 3 ? `${shown} +${functions.length - 3} more` : shown;
};

const REPORT = path.join(BUILD, "untranslated.tsv");
const DUMP = path.join(BUILD, "untranslated.dump.txt");

run(async () => {
    const ain = scanned();
    ensureBuild();
    console.log(`Reading ${ain}`);
    const dumped = alice(["ain", "dump", "-t", "-o", DUMP, ain]);
    if (dumped !== 0) {
        return dumped;
    }

    const entries = findUntranslated(await fs.readFile(DUMP, "utf-8"));
    const counts = countByCategory(entries);

    /*
     * Every category, not only the interesting one. A scan that printed the
     * display strings alone would read as "this is what is left", and what is
     * left is 12000 slots of which these are the ones a name suggests somebody
     * reads -- the line below is what says how much was set aside to get there.
     */
    await fs.writeFile(REPORT, entries
        .map(({category, functions, slot, text}) =>
            [category, `s[${slot}]`, JSON.stringify(text), functions.length, pushers(functions)].join("\t"))
        .join("\n") + "\n", "utf-8");

    console.log(`${entries.length} of the .ain's s[] strings still read Japanese:`
        + ` ${[...counts].map(([name, count]) => `${count} ${name}`).join(", ")}`);
    console.log(`  asset: a path to an activity, a CG or a sound, rather than a line`);
    console.log(`  engine: System 4's own widgets, whose Japanese names parts in the layout`);
    console.log(`  debug: a developer's screen`);
    console.log(`  display: a function whose name says it draws text -- read these`);
    console.log(`  other: everything else, mostly data keyed by its Japanese`);
    console.log(`Written to ${path.relative(process.cwd(), REPORT)}`);

    /*
     * The display ones on the console too, since that is the list this exists
     * for and a file is a step further away. Whoever is going to act on it is
     * reading the terminal it was run in.
     */
    for (const {functions, slot, text} of entries.filter(entry => entry.category === "display")) {
        console.log(`  ${pushers(functions)}\ts[${slot}]\t${text}`);
    }
    return 0;
});
