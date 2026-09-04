/**
 * Report the scene files that no longer say what the game says.
 *
 *   node scripts/check_scenes.js                      # the whole text language
 *   node scripts/check_scenes.js --scene=033243       # one scene
 *   node scripts/check_scenes.js --class=structure    # one class, all of it
 *   node scripts/check_scenes.js --limit=20           # more of each class
 *   node scripts/check_scenes.js --text-lang=en_opus  # another translation
 *
 * The check to run after anything edits a scene file that is not the driver in
 * docs/scene-driver.md -- an agent handed the `.tsv` and asked to improve the
 * English, a hand edit, a sweep. Only the English column is anybody's to write;
 * modules/SceneIntegrity.js is what the other four are held against and why.
 *
 * Exits 1 when a file has moved away from the game, so it can stand in a hook
 * or before a commit. The "english" class does not count towards that: 18 of
 * its findings on en_grok are deliberate, and docs/scene-integrity.md says
 * which.
 *
 * Not in package.json, the way scripts/check_skill_widths.js is not -- it
 * answers a question rather than building anything, and no build depends on it.
 *
 * The structural half wants build/scenes/<lang>/, which npm run extract-scenes
 * writes; everything else reads the committed dump and needs neither
 * alice-tools nor GAME_DIR.
 */
import {flagValue} from "../modules/Argv.js";
import {run} from "../modules/AliceTools.js";
import {CLASSES, FAULTS, WHAT, checkScenes, countByClass} from "../modules/SceneIntegrity.js";
import {textLangName} from "../modules/TextLanguages.js";

/** "1 scene", "5 scenes" -- this report counts four different things out loud. */
const count = (many, word) => `${many} ${word}${many === 1 ? "" : "s"}`;

await run(async () => {
    const only = flagValue("class");
    if (only && !CLASSES.includes(only)) {
        console.error(`--class takes one of ${CLASSES.join(", ")}.`);
        return 1;
    }
    const limit = flagValue("limit") === undefined ? 6 : Number(flagValue("limit"));
    const scene = flagValue("scene");

    const lang = textLangName();
    const {findings, scenes, rows, gameLines, uncovered, reference} = await checkScenes(lang, scene);
    if (!scenes) {
        console.log(scene
            ? `text_languages/${lang}/scenes/ has no scene called ${JSON.stringify(scene)}.`
            : `text_languages/${lang}/scenes/ holds no scene files, so there is nothing to check.`);
        return 1;
    }

    const wanted = only ? findings.filter(finding => finding.class === only) : findings;
    const counts = countByClass(wanted);
    const faults = wanted.filter(finding => FAULTS.includes(finding.class));

    console.log(`${count(scenes, "scene")} and ${count(rows, "row")} of the "${lang}" text language,`
        + ` against the game's ${gameLines} messages`);
    if (reference) {
        console.log(`  structure held against ${reference.borrowed
            ? `build/scenes/${reference.lang}/, borrowed -- this language has no extraction of its own`
            : `build/scenes/${reference.lang}/`}`);
    } else {
        console.log("  structure not checked: there is no extraction to hold it against."
            + " npm run extract-scenes writes one.");
    }
    if (uncovered) {
        console.log(`  ${uncovered} of the game's messages are in no scene file`
            + (uncovered === gameLines - rows ? "" : ", and some rows here are not the game's"));
    }

    if (!wanted.length) {
        console.log("\nNothing to report: every column but the English is the game's own.");
        return 0;
    }

    console.log(`\n${count(wanted.length, "finding")} in`
        + ` ${count(new Set(wanted.map(finding => finding.file)).size, "scene")}`);
    for (const name of CLASSES) {
        if (counts[name]) {
            console.log(`  ${String(counts[name]).padStart(5)}  ${name} -- ${WHAT[name]}`);
        }
    }

    for (const name of CLASSES) {
        const group = wanted.filter(finding => finding.class === name);
        if (!group.length) {
            continue;
        }
        console.log(`\n--- ${group.length} ${name} ---`);
        for (const finding of group.slice(0, only ? group.length : limit)) {
            console.log(`${finding.file}${finding.lineNumber ? ` m[${finding.lineNumber}]` : ""}`
                + ` -- ${finding.kind}`);
        }
        if (!only && group.length > limit) {
            console.log(`  ... ${group.length - limit} more, --class=${name} for all of them`);
        }
    }

    if (faults.length) {
        console.log(`\n${faults.length} of these are the file disagreeing with the game rather than`
            + " with taste. What to do about each is docs/scene-integrity.md; the fix for a whole"
            + " scene is to take its four game columns from build/scenes/ again.");
    }
    return faults.length ? 1 : 0;
});
