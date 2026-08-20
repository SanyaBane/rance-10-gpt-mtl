/**
 * Build Rance10.ain from one of the text languages.
 *
 *   npm run regenerate-ain                      # the language .env names, or en_gpt
 *   npm run regenerate-ain -- --text-lang=en_grok
 *   node scripts/ain.js --text-lang=jp          # the features, over the game's own Japanese
 *
 * Rendering the patch and applying it are two steps, and they used to be a &&
 * chain in package.json -- which cannot take the flag: npm appends whatever
 * follows `--` to the *end* of the chain, so --text-lang would reach alice-tools
 * rather than the generator that needs it. One entry point reads it once.
 */
import * as fs from "fs/promises";
import * as path from "path";
import {spawnSync} from "child_process";
import {AIN} from "../modules/AinFiles.js";
import {alice, run} from "../modules/AliceTools.js";
import {ENEMY_PARTY_JAF, renderEnemyPartyNamesJaf} from "../modules/EnemyPartyNames.js";
import {ROOT} from "../modules/Env.js";
import {featureArgs, selectedFeatures} from "../modules/Features.js";
import {RACE_JAF, renderRaceNamesJaf} from "../modules/RaceNames.js";
import {isTranslated, regeneratedTxt, textLangName} from "../modules/TextLanguages.js";

/**
 * A child process rather than an import: the generator holds both ain.json
 * dumps in memory, some hundreds of megabytes, and this way that is released
 * before alice-tools starts.
 */
const node = (args) => {
    const result = spawnSync(process.execPath, args, {stdio: "inherit"});
    if (result.error) {
        throw result.error;
    }
    return result.status ?? 1;
};

/**
 * The two translations that patch a function rather than a string: the race on
 * the enemy status panel, and the name over the enemy's HP bar. Both are
 * generated from a hand-written glossary, by modules/RaceNames.js and
 * modules/EnemyPartyNames.js, and each says why it cannot be a translated
 * string -- the words are keys somewhere else.
 *
 * Written here rather than by the dialogue generator because neither is
 * dialogue and neither varies by text language; alice-tools takes as many --jaf
 * as it is given.
 */
const GENERATED_JAF = [
    {
        render: renderRaceNamesJaf,
        file: RACE_JAF,
        overlong: "too wide for the enemy status panel",
        stale: (japanese) => `the game has no race called ${JSON.stringify(japanese)}`,
    },
    {
        render: renderEnemyPartyNamesJaf,
        file: ENEMY_PARTY_JAF,
        overlong: "wider than the HP bar it labels",
        stale: (japanese) => `the game has no enemy called ${JSON.stringify(japanese)}`,
    },
];

const renderGeneratedJaf = async () => {
    for (const {render, file, overlong, stale} of GENERATED_JAF) {
        const rendered = await render();
        await fs.writeFile(file, rendered.text, "utf-8");
        console.log(`Translated ${rendered.report}`);
        for (const english of rendered.overlong) {
            console.warn(`  ${overlong}: ${JSON.stringify(english)}`);
        }
        for (const complaint of rendered.misnamed) {
            console.warn(`  ${complaint}`);
        }
        for (const japanese of rendered.stale) {
            console.warn(`  ${stale(japanese)}`);
        }
    }
};

run(async () => {
    const textLang = textLangName();
    /*
     * Which optional patches this build takes, --with= and --without= away.
     * What they are is one folder apiece under features/, which
     * modules/Features.js reads, and nothing is spelled out here -- so the
     * next one is a folder rather than two more lines below.
     *
     * Read before anything is rendered, because a misspelled feature is a
     * message rather than a build and a minute of dialogue would go by first.
     */
    const features = selectedFeatures();
    console.log(`Building ${textLang}`
        + (features.length > 0 ? ` with: ${features.join(", ")}` : " with no optional features"));

    /*
     * Everything below the features is translation, and the Japanese is the
     * absence of one: no dialogue to render, no race names to generate, and
     * none of the three patches that write English into the .ain. What is left
     * is the game's own script with the features over it -- and with no
     * features either, the game's own .ain byte for byte, which is how you get
     * back out of a modified one.
     */
    const english = [];
    if (isTranslated(textLang)) {
        const rendered = node([path.join(import.meta.dirname, "regenerate_aai_txt.js"), `--text-lang=${textLang}`]);
        if (rendered !== 0) {
            return rendered;
        }
        await renderGeneratedJaf();
        english.push(
            "-t", path.relative(ROOT, regeneratedTxt(textLang)),
            "--jaf", "patches/card_names.jaf",
            /*
             * The achievement names, read out of the ex-tree the same way the
             * card names are -- both Ids are save keys. The English itself is
             * written in by npm run regenerate-ex, so this changes nothing at
             * all until that has been run over the same game directory.
             */
            "--jaf", "patches/trophy_names.jaf",
            "--jaf", path.relative(ROOT, RACE_JAF),
            /*
             * The name over the enemy's HP bar. Nothing else resolves against
             * it, so its place in this list is free; it sits by the other
             * generated .jaf.
             */
            "--jaf", path.relative(ROOT, ENEMY_PARTY_JAF),
            /*
             * The enemy panel's two card Ids in English. Not optional -- it is
             * translation -- and after the .jaf above, whose CardEnglishLabel
             * and 表示種族 it resolves by name; the other order stops with
             * "Unable to resolve function". The features come last for the same
             * reason: the one there is now resolves a name out of its own .jaf.
             */
            "--jam", "patches/enemy_panel_cards.jam",
            /*
             * The four states the battle log names. A .jam rather than three more
             * lines of text because one of the four, ダウン, is a slot the enemy AI
             * conditions are compared against -- the file says which and why.
             */
            "--jam", "patches/leader_state_names.jam",
        );
    } else if (features.length === 0) {
        console.log("  which is the game's own Rance10.ain: no text and no features is nothing to apply");
    }
    return alice([
        "ain", "edit",
        ...english,
        ...featureArgs(features),
        "-o", "{game}/Rance10.ain",
        path.relative(ROOT, AIN),
    ]);
});
