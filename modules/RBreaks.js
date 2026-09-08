/**
 * Where the game reads the letter r as a line break, and what English that eats.
 *
 * The marker is the ASCII letter r -- not CR, not an escape. The game's own
 * data says so:
 *
 *     game/ex/Rance10EX.v1.04.ex.txt   { 1003, "全力突撃", …, "攻撃(2倍)r　ＡＰ累積" }
 *     game/ain/Rance10.v1.04.ain.txt   ;s[15018] = "リーザス城に…侵入するも撃退r"
 *
 * and it is a letter rather than a mis-dumped control character, because the
 * same dump escapes a real CR: `;s[802] = "\r\n"`. Round-tripping one slot
 * through `alice ain edit -t` confirms the other direction -- `\r` in a patch
 * puts CR in the .ain and comes back out as `\r`, a bare r stays a bare r.
 * Latin letters do not occur in the Japanese, so the marker is free there and
 * unaffordable in English: every r of "are restored" is a line break.
 *
 * The bytecode has two shapes for it, and LF is what both produce:
 *
 *     S_PUSH "|r" / PUSH 0      / CALLHLL String Split    -- a set of characters
 *     S_PUSH "r"  / S_PUSH "\n" / CALLHLL String Replace  -- straight to LF
 *
 * What makes this fixable rather than a fact of life is that the separator is
 * itself a string slot. Three of them serve all thirteen sites -- s[2527] "r",
 * s[3501] "|r", s[3717] "r|" -- and nothing else in the .ain pushes any of the
 * three, so writing CR into a separator takes the letter out of the set without
 * touching a line of code. Two of the three were already cherry-picked that way
 * years ago, which is why the fault appears on some screens and not others.
 *
 * So there are two questions, and this module answers both:
 *
 *   - which separators still hold the letter, which is the fix. findBreakSites
 *     reads the code and separatorSlots pairs each site with the slot it pushes
 *     and with whatever the cherry-picks have made of it.
 *   - what an open separator is damaging, which is the size of the fault.
 *     reachedLiterals walks the callers of an open site to the strings handed in
 *     -- this is what finds a slot whose Japanese has no break at all,
 *     友情を取得しました。, and whose English still gets cut apart -- and
 *     readMarkedSlots finds the other half, every slot whose Japanese carries
 *     the marker, which is on such a path whether the walk reached it or not.
 *
 * Nothing here is read by a build and nothing here writes; docs/r-line-breaks.md
 * is what the numbers mean.
 */
import * as fs from "fs/promises";
import {AIN_TXT} from "./AinFiles.js";
import {readSlotEnglish, readSlotJapanese} from "./CherryPicks.js";
import {CODE_JAM, ensureCodeDump} from "./CodeDump.js";

/** The line break the game's data is written with, and the one it draws. */
export const MARKER = "r";
const LF = "\n";

/** `S_PUSH "…"`, and the escapes alice-tools writes inside one. */
const S_PUSH = /^S_PUSH "((?:[^"\\]|\\.)*)"$/;
const unquote = (literal) => literal.replace(/\\(.)/g, (_, character) =>
    character === "n" ? "\n" : character === "r" ? "\r" : character === "t" ? "\t" : character);

/** A function opens with its number and is introduced by the comment above it. */
const FUNC = /^FUNC (\d+)$/;
const HEADER = /^; (?!(?:ARG|VAR|RETURN)\b)(.+)$/;

/** The end of one source file's worth of functions: `EOF 1547`. */
const EOF = /^EOF \d+$/;

/**
 * Every function whose body turns a character out of a set into a line break.
 *
 * Both shapes are read off the three lines around the call rather than by
 * tracking the stack: the separator of String Split and String Replace is a
 * literal pushed immediately before it in all 52 of the calls this .ain makes,
 * and a shape that pushed it further back would be a miss rather than a wrong
 * answer.
 *
 * Only a set holding the marker is reported. The other 39 split on ／, ＜＞, a
 * comma, an ideographic space -- characters an English line does not produce by
 * accident -- and listing them buries the three that matter. A set is judged by
 * the letter it was compiled with rather than by what the cherry-picks have
 * made of it, because a separator already closed is the answer to the question,
 * not something to leave out of it.
 *
 * @return {{
 *     kind: "split" | "replace",
 *     separator: string,
 *     line: number,
 *     functionName: string,
 * }[]}
 */
export const findBreakSites = (lines, functions) => {
    const sites = [];
    const literalAt = (index) => {
        const match = lines[index]?.match(S_PUSH);
        return match ? unquote(match[1]) : null;
    };
    for (let index = 0; index < lines.length; index++) {
        const line = lines[index];
        let kind = null;
        let separator = null;
        if (line === "CALLHLL String Split -1" || line === "CALLFUNC splitToken") {
            // (source, separators, keepEmpty) -- the separators are the middle one.
            kind = "split";
            separator = literalAt(index - 2);
        } else if (line === "CALLHLL String Replace -1") {
            // (source, search, replacement), and only a replacement of LF is a
            // line break rather than an ordinary substitution.
            if (literalAt(index - 1) === LF) {
                kind = "replace";
                separator = literalAt(index - 2);
            }
        }
        if (kind && separator?.includes(MARKER)) {
            const owner = functions.enclosing(index);
            sites.push({
                kind,
                separator,
                line: index + 1,
                functionId: owner?.id ?? -1,
                functionName: owner?.name ?? "?",
            });
        }
    }
    return sites;
};

/**
 * The functions of the dump, and which line belongs to which.
 *
 * A lambda is emitted inside the function that creates it and closed with
 * ENDFUNC, so the enclosing function is a stack rather than "the nearest FUNC
 * above" -- the four instructions after `ENDFUNC "<lambda : …RunImageDialog…>"`
 * are RunImageDialog's own, and reading them as the lambda's would lose the
 * only call site it has. The stack is cleared at each EOF, which is where one
 * source file's functions end, so a top-level ENDFUNC cannot pop into the
 * previous file.
 */
const indexFunctions = (lines) => {
    const byId = new Map();
    const byName = new Map();
    const owners = new Array(lines.length).fill(null);
    const stack = [];
    let pendingName = null;
    for (let index = 0; index < lines.length; index++) {
        const line = lines[index];
        const header = line.match(HEADER);
        if (header) {
            pendingName = header[1].replace(/^"(.*)"$/, "$1");
        }
        const opens = line.match(FUNC);
        if (opens) {
            const entry = {id: +opens[1], name: pendingName ?? `FUNC ${opens[1]}`, start: index};
            byId.set(entry.id, entry);
            if (!byName.has(entry.name)) {
                byName.set(entry.name, entry);
            }
            stack.push(entry);
            pendingName = null;
        }
        owners[index] = stack[stack.length - 1] ?? null;
        if (line.startsWith("ENDFUNC")) {
            stack.pop();
        } else if (EOF.test(line)) {
            stack.length = 0;
        }
    }
    return {byId, byName, enclosing: (index) => owners[index]};
};

/**
 * Where a function is called or referenced.
 *
 * `CALLFUNC <name>` is exact. A method or a delegate arrives as its number --
 * `PUSH 37197` some lines above a `DG_NEW_FROM_METHOD`, `PUSH 29150` above a
 * `CALLMETHOD 1` -- so that half is a window: a PUSH of a number this .ain
 * defines a function for, with a call or a delegate within eight lines. The
 * window is what makes this a heuristic; a PUSH that is really an array index
 * happening to equal a function number widens the caller set and never narrows
 * it, which is the direction a report can afford.
 */
const indexReferences = (lines, functions) => {
    const sites = new Map();
    const add = (id, index) => {
        const already = sites.get(id);
        if (already) {
            already.push(index);
        } else {
            sites.set(id, [index]);
        }
    };
    for (let index = 0; index < lines.length; index++) {
        const line = lines[index];
        if (line.startsWith("CALLFUNC ")) {
            const called = functions.byName.get(line.slice("CALLFUNC ".length));
            if (called) {
                add(called.id, index);
            }
            continue;
        }
        const pushed = line.match(/^PUSH (\d+)$/);
        if (!pushed || !functions.byId.has(+pushed[1])) {
            continue;
        }
        for (let ahead = index + 1; ahead <= index + 8 && ahead < lines.length; ahead++) {
            if (/^(CALLMETHOD|DG_)/.test(lines[ahead])) {
                add(+pushed[1], index);
                break;
            }
        }
    }
    return sites;
};

/**
 * The literal strings that reach a function, walking up through its callers.
 *
 * At a call site the text is the last string pushed before it: RunImageDialog
 * takes (imageName, caption, desc) and it is desc that gets split, the two
 * information dialogs take (caption, text). A path that hands its text in some
 * other position is a miss rather than a wrong answer, which is why this reads
 * one literal per site instead of all of them -- taking every S_PUSH in the
 * window would file the illustration's CG name and the caption as text about to
 * be cut apart, and three quarters of the report would be wrong.
 *
 * A site that yields a literal is where the text is written, so that branch
 * stops there. Walking past it is what turned nine call sites into twenty-six
 * slots: the scene function above RunImageDialog pushes a sound name and a CG
 * name of its own, and neither is the text.
 */
const reachedLiterals = (lines, functions, references, startId, depth = 6) => {
    const found = new Map();
    const seen = new Set();
    let frontier = [startId];
    for (let level = 0; level < depth && frontier.length; level++) {
        const next = [];
        for (const id of frontier) {
            if (seen.has(id)) {
                continue;
            }
            seen.add(id);
            for (const index of references.get(id) ?? []) {
                const owner = functions.enclosing(index);
                const floor = Math.max(owner?.start ?? 0, index - 12);
                let literal = null;
                for (let back = index - 1; back >= floor; back--) {
                    // A lambda is emitted inside the function that creates it,
                    // so a window that walks back past an ENDFUNC reads the
                    // lambda's own arguments as its creator's -- which is how
                    // the separator "|r" came back as the text of the dialog
                    // that splits on it.
                    if (FUNC.test(lines[back]) || lines[back].startsWith("ENDFUNC")) {
                        break;
                    }
                    const match = lines[back].match(S_PUSH);
                    if (match) {
                        literal = unquote(match[1]);
                        break;
                    }
                }
                if (literal) {
                    if (!found.has(literal)) {
                        found.set(literal, owner?.name ?? "?");
                    }
                } else if (owner) {
                    next.push(owner.id);
                }
            }
        }
        frontier = next;
    }
    return found;
};

/**
 * A marker r, told apart from the r of an English word the Japanese quotes.
 *
 * The marker never has a Latin letter beside it, because the text around it is
 * Japanese; ランスJr. is the counter-example, and the only one this .ain has.
 * Substitution tokens come out first -- <Target>, {255,200,0}, %s -- because the
 * game replaces them before drawing, so their own letters are never on screen.
 */
const TOKEN = /<[^<>]*>|\{[^{}]*\}|%[sd]/g;
export const countMarkers = (text) =>
    (text.replace(TOKEN, "").match(/(?<![A-Za-z])r(?![A-Za-z])/g) ?? []).length;

/** Every r a still-open separator will break on, marker or not. */
export const countBreaks = (text) => (text.replace(TOKEN, "").match(/r/g) ?? []).length;

/**
 * How many breaks a separator draws in a line.
 *
 * The two counts are not the same question and must not share an answer. Asked
 * of the Japanese it is intent, so the letter is counted only where it stands
 * between Japanese -- ランスJr. means no break. Asked of the English it is what
 * the game does, and the game splits on every r there is.
 */
export const countWith = (text, separator, intent) => {
    const stripped = text.replace(TOKEN, "");
    let total = 0;
    for (const character of new Set(separator)) {
        total += character === MARKER
            ? (intent ? countMarkers(text) : countBreaks(text))
            : stripped.split(character).length - 1;
    }
    return total;
};

/** How a line writes the break it means, which is the half a person can fix. */
export const escapeOf = (english) =>
    english.includes("\\r") ? "\\r" : english.includes("\\n") ? "\\n" : countMarkers(english) ? "r" : null;

/**
 * Which slot each separator literal is, out of the dump game/ain/ carries.
 *
 * By the text rather than by the function it is pushed in, because the two
 * dumps do not name a lambda the same way and a wrong join is worse than none:
 * each of the three literals belongs to exactly one slot in this .ain, and a
 * literal that ever belonged to two would be reported as undecided rather than
 * guessed at.
 */
export const separatorSlots = async (separators) => {
    const wanted = new Set(separators);
    const found = new Map();
    const dump = await fs.readFile(AIN_TXT, "utf-8");
    for (const match of dump.matchAll(/^;s\[(\d+)]\s*=\s*"((?:[^"\\\n]|\\.)*)"\r?$/gm)) {
        const text = unquote(match[2]);
        if (!wanted.has(text)) {
            continue;
        }
        const already = found.get(text);
        if (!already) {
            found.set(text, new Set([+match[1]]));
        } else {
            already.add(+match[1]);
        }
    }
    return found;
};

/**
 * Every string slot whose Japanese carries the marker, whether or not the code
 * walk reached the function that draws it.
 */
export const readMarkedSlots = () => {
    const marked = new Map();
    for (const [slot, texts] of readSlotJapanese()) {
        // A slot pushed from several places keeps every Japanese it is pushed
        // with; the one that carries the marker is the one saying the slot is
        // drawn on such a path.
        const marks = texts.map(text => ({text, wanted: countMarkers(text)}))
            .sort((left, right) => right.wanted - left.wanted)[0];
        if (marks?.wanted) {
            marked.set(slot, {japanese: marks.text, wanted: marks.wanted});
        }
    }
    return marked;
};

/**
 * The whole report: the separators, and what the open ones are damaging.
 *
 * @return {Promise<{
 *     dumped: boolean,
 *     separators: {
 *         separator: string,
 *         slot: number | null,
 *         effective: string,
 *         open: boolean,
 *         override: string | undefined,
 *         sites: object[],
 *     }[],
 *     reached: object[],
 *     marked: object[],
 * }>}
 */
export const readRBreaks = async () => {
    const dumped = await ensureCodeDump();
    const lines = (await fs.readFile(CODE_JAM, "utf-8")).split(/\r?\n/).map(line => line.trim());
    const functions = indexFunctions(lines);
    const sites = findBreakSites(lines, functions);
    const references = indexReferences(lines, functions);

    const slots = await separatorSlots(sites.map(site => site.separator));
    const english = readSlotEnglish();
    const japanese = readSlotJapanese();
    const slotsByText = new Map();
    for (const [slot, texts] of japanese) {
        for (const text of texts) {
            const already = slotsByText.get(text);
            if (already) {
                already.push(slot);
            } else {
                slotsByText.set(text, [slot]);
            }
        }
    }

    /**
     * What one slot asks for and what it will get. `asked` is the separator the
     * game was compiled with and `drawn` the one a build ends up with, so a
     * closed separator reports the same line as fixed rather than as broken.
     */
    const describe = (slot, text, how, asked = MARKER, drawnWith = asked) => {
        const written = english.get(slot);
        return {
            slot,
            japanese: text,
            english: written,
            wanted: countWith(text, asked, true),
            drawn: countWith(written ?? text, drawnWith, written === undefined),
            escape: written === undefined ? null : escapeOf(written),
            how,
        };
    };

    /** One entry per separator, with every site that pushes it. */
    const separators = [];
    for (const site of sites) {
        let entry = separators.find(candidate => candidate.separator === site.separator);
        if (!entry) {
            const numbers = [...slots.get(site.separator) ?? []];
            const slot = numbers.length === 1 ? numbers[0] : null;
            // The separator a build ends up with: the cherry-picks are appended
            // last, so an override of the slot is what the game reads.
            const override = slot === null ? undefined : english.get(slot);
            const effective = override === undefined ? site.separator : unquote(override);
            entry = {
                separator: site.separator,
                slot,
                slots: numbers,
                override,
                effective,
                open: effective.includes(MARKER),
                sites: [],
            };
            separators.push(entry);
        }
        entry.sites.push(site);
    }

    /** What the still-open separators are cutting apart. */
    const reached = [];
    for (const entry of separators.filter(candidate => candidate.open)) {
        for (const site of entry.sites) {
            for (const [literal, via] of reachedLiterals(lines, functions, references, site.functionId)) {
                for (const slot of slotsByText.get(literal) ?? []) {
                    if (!reached.some(finding => finding.slot === slot)) {
                        const finding = describe(slot, literal, site.functionName,
                            entry.separator, entry.effective);
                        reached.push({...finding, via});
                    }
                }
            }
        }
    }

    const seen = new Set(reached.map(finding => finding.slot));
    const marked = [];
    for (const [slot, {japanese: text}] of readMarkedSlots()) {
        if (!seen.has(slot)) {
            marked.push(describe(slot, text, "its Japanese carries the marker"));
        }
    }

    return {dumped, separators, reached, marked};
};
