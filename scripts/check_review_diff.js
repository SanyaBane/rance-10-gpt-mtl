/**
 * What the wave changed, counted by character rather than read by eye.
 *
 *   node scripts/check_review_diff.js
 *
 * Run after scripts/accept_scene_reviews.js and before the commit. Two numbers,
 * and both of them have caught something:
 *
 * **The count of changed m[] numbers has to equal the count of touched rows.**
 * That is `scripts/effective_map.js diff` against `git diff --numstat`, and it
 * is the check CLAUDE.md insists on -- a duplicate `s[N]` is invisible in a
 * patch diff and decisive in a build. This prints the numstat half, so the two
 * can be held against each other without arithmetic by hand.
 *
 * **Every wide character that left the diff has to come back.** A correction
 * changes English; the Japanese column sits on the same row, so a kanji the
 * English dropped shows as `2 -> 1` rather than `1 -> 0` and that is normal. A
 * bracket repair shows as exactly the pairs that were repaired -- one wave added
 * six `「` and seven `」` and the five mended speeches accounted for every one.
 * Anything else is the finding: a bracket pass once ate the tabs the scene
 * format escapes on purpose, and 1622 rows edited against 1620 numbers changed
 * was the only check that noticed.
 *
 * The `　` line is usually the layout putting a continuation indent back on a
 * row that gained one, which is benign; the census prints how many of them are
 * something else.
 */
import {execFileSync} from "child_process";
import * as path from "path";
import {ROOT} from "../modules/Env.js";
import {textLangName} from "../modules/TextLanguages.js";

/** Above the ASCII and punctuation the English is made of, so a census of the rest. */
const WIDE = 0x2000;

const git = (...args) => execFileSync("git", args, {cwd: ROOT, encoding: "utf-8", maxBuffer: 1 << 28});

const main = () => {
    const scenes = path.posix.join("text_languages", textLangName(), "scenes");

    const numstat = git("diff", "--numstat", "--", scenes).split(/\r?\n/).filter(Boolean);
    let added = 0;
    let removed = 0;
    for (const line of numstat) {
        const [plus, minus] = line.split("\t");
        added += Number(plus);
        removed += Number(minus);
    }
    console.log(`${numstat.length} files, ${added} rows added, ${removed} removed`);
    console.log("Hold that against `node scripts/effective_map.js diff before after`:"
        + " equal is the answer.");

    const before = new Map();
    const after = new Map();
    for (const line of git("diff", "-U0", "--", scenes).split(/\r?\n/)) {
        if (line.startsWith("---") || line.startsWith("+++")) {
            continue;
        }
        const into = line.startsWith("-") ? before : line.startsWith("+") ? after : null;
        if (!into) {
            continue;
        }
        for (const character of line.slice(1)) {
            if (character.codePointAt(0) > WIDE) {
                into.set(character, (into.get(character) ?? 0) + 1);
            }
        }
    }

    const moved = [...new Set([...before.keys(), ...after.keys()])]
        .filter(one => (before.get(one) ?? 0) !== (after.get(one) ?? 0))
        .sort();
    if (!moved.length) {
        console.log("No wide character moved.");
        return;
    }
    console.log("");
    for (const one of moved) {
        const from = before.get(one) ?? 0;
        const to = after.get(one) ?? 0;
        const code = one.codePointAt(0).toString(16).toUpperCase().padStart(4, "0");
        console.log(`U+${code} ${JSON.stringify(one)}  ${from} -> ${to}`);
    }
    console.log("");
    console.log("A kanji going 2 -> 1 is one column of one row: the Japanese beside it stays."
        + " Brackets have to add up to the repairs you read. Anything else wants explaining.");
};

main();
