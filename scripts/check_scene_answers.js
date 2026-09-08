/**
 * Read the answers in build/scene-review/ before the acceptance does.
 *
 *   node scripts/check_scene_answers.js
 *   node scripts/check_scene_answers.js --fix
 *
 * scripts/accept_scene_reviews.js has gates of its own and they are the ones
 * that matter. These are the faults it lets through, every one of them seen in a
 * real answer:
 *
 * - **a prompt with no answer beside it.** A scene with no file is not recorded
 *   as read and will be handed out again, and a reviewer that reports "read it,
 *   nothing to say" without writing the empty file is how that happens.
 * - **Japanese in the corrected-English column.** Two runs have done it. The
 *   check is only interesting where the character was **not already in the line
 *   being corrected**: ＜エール＞ has to stay, and the stray `一` standing in for
 *   a dash is a corpus class of 3694 cells that a correction copies through
 *   unchanged. Both used to be noise a person read past, which is how the two
 *   real ones nearly went by.
 * - **an ASCII `"` inside a speech.** The acceptance reads it as a bracket the
 *   Japanese does not have and refuses the row -- late, and with the rest of the
 *   answer already applied around it.
 * - **a reason that does not open with `meaning:`, `english:` or `name:`.**
 *   Without one the correction is a rewrite and is refused.
 * - **a curly apostrophe where the line being corrected has a straight one.**
 *   This is the quiet one. A reviewer rewriting a sentence brings `’` along with
 *   it; the corpus is 69 734 straight against 987 curly, but what decides is the
 *   speech being corrected, not the corpus. It reaches the wide-character census
 *   of the diff eventually, which is one step too late -- the file is written by
 *   then. `--fix` straightens them in place.
 *
 * A number that names no speech of its scene is reported too: the acceptance
 * refuses it, but seeing it here is the difference between a reviewer that
 * invented a number and one that answered the wrong scene.
 */
import * as fs from "fs/promises";
import * as path from "path";
import {hasFlag} from "../modules/Argv.js";
import {SUBSTITUTIONS} from "../modules/SceneAcceptance.js";
import {readDeclined, REVIEW} from "../modules/SceneReview.js";
import {textLangName} from "../modules/TextLanguages.js";

const JAPANESE = /[぀-ゟ゠-ヿ㐀-鿿]/u;
const KINDS = ["meaning:", "english:", "name:"];
const CURLY = "’";

/** The prompt's scene block: number, speaker, Japanese, the English there is now. */
const readPrompt = async (file) => {
    const rows = new Map();
    for (const line of (await fs.readFile(file, "utf-8")).split(/\r?\n/)) {
        const columns = line.split("\t");
        if (columns.length >= 4 && /^\d+$/.test(columns[0])) {
            rows.set(columns[0], columns[3]);
        }
    }
    return rows;
};

/** Characters a correction may carry because the line it replaces carried them. */
const carriedOver = (before) => {
    const kept = new Set(before);
    for (const token of SUBSTITUTIONS) {
        for (const character of token) {
            kept.add(character);
        }
    }
    return kept;
};

const main = async () => {
    const declined = await readDeclined(textLangName());
    const names = (await fs.readdir(REVIEW).catch(() => [])).sort();
    const prompts = names.filter(name => name.endsWith(".prompt.md"))
        .map(name => name.replace(".prompt.md", ""));
    const answers = new Set(names.filter(name => name.endsWith(".answer.tsv"))
        .map(name => name.replace(".answer.tsv", "")));

    let complaints = 0;
    const say = (what) => {
        complaints += 1;
        console.log(what);
    };

    /*
     * A prompt with no answer is either one a reviewer never wrote the empty
     * file for or one no reviewer was ever given, and nothing on disk tells the
     * two apart -- scripts/pack_scene_reviews.js leaves what did not fit exactly
     * where an unanswered scene sits. So they are counted apart from the faults
     * in the answers: after a wave the list should hold only what the pack
     * printed as NO FIT.
     */
    const silent = prompts.filter(id => !answers.has(id) && !declined.has(id));

    for (const id of [...answers].sort()) {
        const answerFile = path.join(REVIEW, `${id}.answer.tsv`);
        const promptFile = path.join(REVIEW, `${id}.prompt.md`);
        const before = await readPrompt(promptFile).catch(() => new Map());
        const text = await fs.readFile(answerFile, "utf-8");
        const lines = text.split(/\r?\n/);
        let straightened = false;

        for (const [index, line] of lines.entries()) {
            if (!line.trim()) {
                continue;
            }
            const columns = line.split("\t");
            const where = `${id}:${index + 1}`;
            if (columns.length < 3) {
                say(`${where}  not three tab-separated columns: ${line.slice(0, 90)}`);
                continue;
            }
            const [number, english, why] = columns;
            const was = before.get(number);

            if (before.size && was === undefined) {
                say(`${where}  m[${number}] is not a speech of this scene`);
            }
            if (!KINDS.some(kind => why.startsWith(kind))) {
                say(`${where}  the reason opens with none of ${KINDS.join(" ")}: ${why.slice(0, 60)}`);
            }
            if (english.includes("\"")) {
                say(`${where}  an ASCII quote inside the speech: ${english.slice(0, 80)}`);
            }
            const kept = carriedOver(was ?? "");
            const brought = [...english].filter(one => JAPANESE.test(one) && !kept.has(one));
            if (brought.length) {
                say(`${where}  Japanese the line did not have: ${[...new Set(brought)].join(" ")}`
                    + `  in ${english.slice(0, 80)}`);
            }
            if (was !== undefined && english.includes(CURLY) && !was.includes(CURLY)) {
                say(`${where}  a curly apostrophe where the speech has a straight one`
                    + `${hasFlag("fix") ? " -- straightened" : ""}`);
                if (hasFlag("fix")) {
                    lines[index] = [number, english.replaceAll(CURLY, "'"), ...columns.slice(2)].join("\t");
                    straightened = true;
                }
            }
        }
        if (straightened) {
            await fs.writeFile(answerFile, lines.join("\n"), "utf-8");
        }
    }

    if (silent.length) {
        console.log("");
        console.log(`${silent.length} prompts with no answer beside them: ${silent.join(" ")}`);
        console.log("Each is a scene a reviewer read without writing its empty file, or one no"
            + " reviewer was given. After a wave this list should hold only what"
            + " scripts/pack_scene_reviews.js printed as NO FIT.");
    }
    console.log("");
    console.log(complaints
        ? `${complaints} to look at in ${answers.size} answers.`
        : `${answers.size} answers, nothing to look at.`);
};

await main();
