/**
 * What a rendered patch actually says: each number against the **last**
 * assignment naming it, which is what alice-tools applies.
 *
 *   node scripts/regenerate_aai_txt.js
 *   node scripts/effective_map.js save before
 *   ... edit the corpus ...
 *   node scripts/regenerate_aai_txt.js
 *   node scripts/effective_map.js save after
 *   node scripts/effective_map.js diff before after
 *
 * `CLAUDE.md` says to verify against the built file rather than against the
 * patch, and this is that check one step earlier and far cheaper: no
 * alice-tools, no `GAME_DIR`, and it answers the only question a corpus edit
 * has to answer -- **did exactly the intended numbers change, and no others.**
 *
 * Reading the diff of the patch cannot answer it, for two reasons that have
 * both cost something here. A duplicate `s[N]` or `m[N]` is invisible in a
 * diff and decisive in a build, because the last one read wins and says
 * nothing about the earlier ones -- `docs/enemy-status-lines.md` is 25 pairs
 * that had picked that up, and `docs/system-cherry-picks.md` is the file that
 * silently beats the dialogue by being appended after it. And a diff of the
 * patch agrees with itself by construction: it shows what was written, not
 * what arrived.
 *
 * The second of those is how the bracket passes found a rule that was eating
 * tabs. The pass edited 1622 rows and this reported 1620 changed, because two
 * of the rows it "fixed" render identically either way -- the edit was real,
 * unintended, and invisible to every other check that ran, including the
 * pass's own post-condition. **A count that does not match the count of edits
 * is the finding**, whichever way it misses.
 *
 * A comment or a blank line is neither an assignment nor a failure: the
 * cherry-picks file is half prose. They are counted and reported, so a parse
 * that quietly stopped matching is not mistaken for a patch that got smaller.
 */
import * as fs from "fs/promises";
import * as path from "path";
import {flagValue} from "../modules/Argv.js";
import {run} from "../modules/AliceTools.js";
import {BUILD, ensureBuild} from "../modules/Env.js";
import {regeneratedTxt, textLangName} from "../modules/TextLanguages.js";

/** `m[123] = "..."` or `s[45] = "..."`, which is every line that is not prose. */
const ASSIGNMENT = /^([ms])\[(\d+)\] = (.*)$/;

const snapshotFile = (name) => path.join(BUILD, `effective.${name}.json`);

/**
 * The patch read into the map alice-tools would end up with.
 *
 * Later wins, which is the whole point: `Map.set` on a key that is already
 * there is exactly what applying the file does.
 */
const readEffectiveMap = async (file) => {
    const text = await fs.readFile(file, "utf-8");
    const map = new Map();
    let prose = 0;
    for (const line of text.split(/\r?\n/)) {
        const match = ASSIGNMENT.exec(line);
        if (match) {
            map.set(`${match[1]}[${match[2]}]`, match[3]);
        } else if (line.trim()) {
            ++prose;
        }
    }
    return {map, prose};
};

const load = async (name) => {
    const file = snapshotFile(name);
    try {
        return new Map(JSON.parse(await fs.readFile(file, "utf-8")));
    } catch (error) {
        if (error.code === "ENOENT") {
            throw new Error(`No snapshot called "${name}": ${file} is not there.`
                + " node scripts/effective_map.js save <name> writes one.");
        }
        throw error;
    }
};

const save = async (name) => {
    const textLang = textLangName();
    const patch = regeneratedTxt(textLang);
    let rendered;
    try {
        rendered = await fs.stat(patch);
    } catch {
        throw new Error(`${patch} is not there. node scripts/regenerate_aai_txt.js writes it,`
            + " and this reads what that wrote rather than rendering its own.");
    }
    const {map, prose} = await readEffectiveMap(patch);
    ensureBuild();
    await fs.writeFile(snapshotFile(name), JSON.stringify([...map]), "utf-8");
    console.log(`${map.size} effective assignments of the "${textLang}" patch saved as "${name}"`);
    // The one way this check goes quietly wrong is being run against a patch
    // from before the edit, so the render's age is part of the answer.
    console.log(`  from ${patch}, rendered ${rendered.mtime.toISOString()}`);
    console.log(`  ${prose} lines of the file are comments rather than assignments`);
};

const diff = async (before, after, show) => {
    const was = await load(before);
    const is = await load(after);
    const changed = [];
    const gone = [];
    for (const [key, value] of was) {
        if (!is.has(key)) {
            gone.push(key);
        } else if (is.get(key) !== value) {
            changed.push([key, value, is.get(key)]);
        }
    }
    const added = [...is.keys()].filter(key => !was.has(key));

    console.log(`${was.size} -> ${is.size} effective assignments, "${before}" to "${after}"`);
    console.log(`  ${changed.length} changed, ${gone.length} gone, ${added.length} added`);
    console.log("\nHold the changed count against the number of rows the edit touched. Equal is the"
        + " answer; anything else is the finding, and a number that went away or appeared is one"
        + " whichever direction it went.");
    for (const [key, from, to] of changed.slice(0, show)) {
        console.log(`\n  ${key}\n     was ${from}\n     is  ${to}`);
    }
    if (changed.length > show) {
        console.log(`\n  ... ${changed.length - show} more, --show=${changed.length} for all of them`);
    }
    for (const [name, keys] of [["gone", gone], ["added", added]]) {
        if (keys.length) {
            console.log(`\n  ${name}: ${keys.slice(0, 20).join(", ")}`
                + (keys.length > 20 ? ` and ${keys.length - 20} more` : ""));
        }
    }
    // Deliberately not an exit code: a changed count is the answer to a
    // question this script does not know, which is how many rows were edited.
    return 0;
};

await run(async () => {
    const [mode, first, second] = process.argv.slice(2).filter(arg => !arg.startsWith("-"));
    if (mode === "save" && first) {
        await save(first);
        return 0;
    }
    if (mode === "diff" && first && second) {
        return diff(first, second, Number(flagValue("show") ?? 6));
    }
    console.error("node scripts/effective_map.js save <name>          # after regenerate_aai_txt.js");
    console.error("node scripts/effective_map.js diff <before> <after> [--show=N]");
    return 1;
});
