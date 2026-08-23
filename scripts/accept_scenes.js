/**
 * Take the answered scenes back in.
 *
 *   node scripts/accept_scenes.js --text-lang=en_opus
 *
 * Reads every build/scene-work/<scene>.answer.tsv, holds it against the scene
 * it was asked about with modules/SceneAcceptance.js, and writes the ones that
 * pass into text_languages/<lang>/scenes/. A scene lands whole or not at all --
 * the game is handed one English line per m[] number, so an answer that came
 * back short does not lose its tail, it shifts it, and every line after the gap
 * goes out under the previous line's number.
 *
 * What acceptance already checks is in that module and is deliberately not
 * repeated here: missing, duplicated and unasked-for numbers, a tab or a line
 * break inside a line, an empty English against a non-empty Japanese, a dropped
 * ＜エール＞, a speech that needs more rows than the window draws, a gender
 * branch flattened into one sentence, a row wider than the window, and English
 * that gives El a gender the game does not.
 *
 * This decides only what to do about the answer:
 *
 *   accepted   written into the translation, the work files deleted
 *   refused    the complaints kept beside the scene, so the next prompt opens
 *              with them
 *   declined   no rows came back at all, only prose -- a translator saying no,
 *              which is a clean answer and not retried. 131 scenes are flagged
 *              "cg" in the index and are not asked for by default; the flag is
 *              a routing hint and not a guarantee, so this is the half that
 *              does not guess.
 *
 * A row wider than the window is a warning in the acceptance module and a
 * refusal here on every attempt but the last. It has to be a warning there
 * because 18% of the existing en_grok draft is over -- it was written to a wrap
 * budget of about 31 characters, fitted in the wrong font -- so refusing would
 * refuse the house style. A fresh translation has no such excuse and can be
 * written to the real window from the first scene. It relents on the last
 * attempt rather than looping forever on a line that will not shorten, and says
 * so in the report.
 */
import * as fs from "fs/promises";
import * as path from "path";
import {flagValue, hasFlag} from "../modules/Argv.js";
import {run} from "../modules/AliceTools.js";
import {ROOT} from "../modules/Env.js";
import {acceptTranslation} from "../modules/SceneAcceptance.js";
import {parseSceneFile} from "../modules/SceneFile.js";
import {sceneDir} from "../modules/SceneIndex.js";
import {writeTranslatedScene} from "../modules/SceneTranslations.js";
import {answerFile, appendLog, clearWork, readState, REPORT, setAside, workInProgress, writeState}
    from "../modules/SceneWork.js";
import {DEFAULT_TEXT_LANG, isTranslated, textLangName} from "../modules/TextLanguages.js";

const DEFAULT_ATTEMPTS = 3;

/** The warning acceptance raises per over-wide row. Matched, not re-measured. */
const TOO_WIDE = "is wider than the message window";

await run(async () => {
    const lang = textLangName();
    if (!isTranslated(lang)) {
        throw new Error(`"${lang}" is the game's own Japanese: there is nothing to write into it.`);
    }
    if (lang === DEFAULT_TEXT_LANG) {
        throw new Error(`"${lang}" is the text language every patch is rendered on top of.`
            + " Name the one being written, --text-lang=en_opus.");
    }
    const source = flagValue("source") ?? DEFAULT_TEXT_LANG;
    const attempts = Number(flagValue("attempts") ?? DEFAULT_ATTEMPTS);
    /* Off for a run that is only trying to get the scenes in. */
    const strictWidth = !hasFlag("allow-wide");

    const held = await workInProgress();
    const answered = [...held.values()].filter(work => work.answer).map(work => work.fileName).sort();
    if (!answered.length) {
        console.log(`Nothing has been answered: ${held.size} scenes are out.`
            + " node scripts/request_scenes.js hands more out.");
        return 0;
    }

    const outcomes = [];
    for (const fileName of answered) {
        const scene = parseSceneFile(await fs.readFile(path.join(sceneDir(source), fileName), "utf-8"));
        const returned = await fs.readFile(answerFile(fileName), "utf-8");
        const {accepted, declined, english, problems, warnings} = acceptTranslation(scene, returned);
        const previous = await readState(fileName);
        const attempt = (previous?.attempts ?? 0) + 1;

        const wide = warnings.filter(warning => warning.includes(TOO_WIDE));
        const held_ = strictWidth && attempt < attempts ? wide : [];
        const allProblems = [...problems, ...held_];

        if (accepted && !held_.length) {
            const written = await writeTranslatedScene(lang, scene, english);
            await clearWork(fileName);
            outcomes.push({
                fileName, scene, attempt,
                status: "accepted",
                note: wide.length ? `${wide.length} rows wider than the window, let through on the last attempt` : "",
                warnings,
            });
            await appendLog(`accepted\t${fileName}\t${scene.rows.length}\t${attempt}`
                + `\t${path.relative(ROOT, written).replaceAll("\\", "/")}`);
            continue;
        }

        const status = declined ? "declined" : "refused";
        await writeState({
            fileName,
            // A decline is not retried: asking the same translator the same
            // question again is the one thing certain not to change the answer.
            attempts: declined ? attempts : attempt,
            status,
            problems: allProblems,
            warnings,
        });
        await setAside(fileName);
        outcomes.push({fileName, scene, attempt, status, problems: allProblems, warnings});
        await appendLog(`${status}\t${fileName}\t${scene.rows.length}\t${attempt}`
            + `\t${JSON.stringify(allProblems[0] ?? "")}`);
    }

    const of = (status) => outcomes.filter(outcome => outcome.status === status);
    for (const outcome of outcomes) {
        console.log(`${outcome.status.padEnd(8)} ${outcome.fileName}  ${outcome.scene.name}`);
        for (const problem of outcome.problems ?? []) {
            console.log(`    ${problem}`);
        }
        if (outcome.note) {
            console.log(`    ${outcome.note}`);
        }
    }

    /*
     * The report is every scene the work folder is still holding, rewritten
     * whole: what is in flight is what it is about, and a file that only grows
     * disagrees with the folder within a run or two. The log beside it is
     * append-only and is the trail a killed run leaves.
     */
    const rows = ["# file\tstatus\tattempts\tlines\tscene\tfirst problem"];
    for (const fileName of [...(await workInProgress()).keys()].sort()) {
        const state = await readState(fileName);
        const scene = await parseSceneFile(await fs.readFile(path.join(sceneDir(source), fileName), "utf-8"));
        rows.push([
            fileName,
            state?.status ?? "out",
            state?.attempts ?? 0,
            scene.rows.length,
            scene.name.replaceAll("\t", " "),
            (state?.problems?.[0] ?? "").replaceAll("\t", " "),
        ].join("\t"));
    }
    await fs.writeFile(REPORT, rows.join("\n") + "\n", "utf-8");

    console.log(`\n${of("accepted").length} accepted, ${of("refused").length} refused,`
        + ` ${of("declined").length} declined.`);
    console.log(`${path.relative(ROOT, REPORT).replaceAll("\\", "/")} lists what is still out.`);
    if (of("accepted").length) {
        console.log(`Assemble when you are ready: npm run assemble-scenes -- --text-lang=${lang}`);
    }
    return 0;
});
