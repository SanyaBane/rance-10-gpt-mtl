/**
 * The title under the speaker's name, for the characters whose key we
 * translated.
 *
 * `Ｔ肩書き(string ▲名前)` is a chain of 313 compares -- one per character --
 * that answers with the slot holding that character's title, and
 * `AdvNamePlate@InnerCreate` is the only thing that calls it. It asks three
 * times, in this order:
 *
 *     jobName = Ｔ肩書き(faceCgName);                              // 立ち／乱義／基本
 *     if (jobName == "") jobName = Ｔ肩書き(GetCharacterNameFromCgName(faceCgName));
 *     if (jobName == "") jobName = Ｔ肩書き(name);                 // what ●台詞 passed
 *
 * The second of those is the one that fires for a character speaking behind a
 * standing portrait, and what it hands over is Japanese: the CG name comes out
 * of the archive, and `GetCharacterNameFromCgName` is a String.Split on ／
 * taking element 0 -- the same `<name>／` prefix that keys
 * archives/Rance10EX_v1_04/48_立ち絵名札マッピング情報.x.
 *
 * So a character's key has to stay Japanese for the compare to hit, and twelve
 * of them are not: they are also the name `FriendPanel@Name::get` returns, or
 * the `name` argument of a ●台詞, or a buff's desc in `Ｐ支援状態追加`, and the
 * cherry-picks translate them for those. Every one of the twelve lost its title
 * the moment it was translated, and nothing said so -- the plate still drew a
 * name, from the table above, with the line under it simply gone.
 *
 * Three more were pure keys with no second role at all -- the Kalar ghosts
 * s[10684], s[10687] and s[10690] -- and those went back to Japanese in
 * patches/system_cherry_picks.v1.04.ain.txt rather than here. This file is for
 * the ones whose English is wanted somewhere.
 *
 * The override maps the Japanese the CG name gives back to the English the slot
 * now holds, and hands *that* to `super()`, so the original chain compares two
 * strings that agree again. The third arm keeps working untouched: it is
 * handed the English already, which is not in the table and reaches `super()`
 * unchanged.
 *
 * Generated from the cherry-picks rather than from a glossary, the way
 * modules/PartyBonusIcons.js is and for the same reason: there is no decision
 * here. The English is whatever that file says today, and pairing it with the
 * Japanese of the same slot out of the committed dump is the whole of the
 * table, so a name edited there cannot go stale here. What is *not* derivable
 * from either is which slots are keys at all -- that is in the code -- so
 * scripts/extract_title_keys.js reads it out once into
 * game/extracted/title_keys.v1.04.tsv.
 *
 * See docs/title-keys.md.
 */
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import {createReadStream} from "fs";
import {readSlotEnglish, readSlotJapanese} from "./CherryPicks.js";
import {BUILD, ROOT} from "./Env.js";

/** The function whose compares this is about. */
export const TITLE_FUNCTION = "Ｔ肩書き";

/** Read out of the code by scripts/extract_title_keys.js; nobody edits it. */
export const TITLE_KEYS = path.join(ROOT, "game", "extracted", "title_keys.v1.04.tsv");

/** Generated, so it goes to build/ beside the three other generated .jaf. */
export const TITLE_KEY_JAF = path.join(BUILD, "title_keys.jaf");

/** The four instructions that put the argument on the stack, in order. */
const ARGUMENT = ["PUSHLOCALPAGE", "PUSH 0x0", "REF", "A_REF"];

/**
 * The slots one function compares its first argument against, in the order the
 * chain tests them.
 *
 * A slot tested twice -- two flag branches under one character -- is one key,
 * so the same number is never written twice.
 */
export const scanTitleKeys = async (dumpPath, functionName) => {
    const slots = [];
    const seen = new Set();
    const recent = [];
    let inComment = false;
    let inFunction = false;
    let seenName = false;
    let pendingSlot = null;
    const input = createReadStream(dumpPath);
    for await (const line of readline.createInterface({input, crlfDelay: Infinity})) {
        if (line.startsWith("; ")) {
            if (!inComment) {
                seenName = line.slice(2) === functionName;
            }
            inComment = true;
            continue;
        }
        inComment = false;
        if (line.startsWith("FUNC ")) {
            inFunction = seenName;
            continue;
        }
        if (!inFunction) {
            continue;
        }
        if (line.startsWith("ENDFUNC")) {
            break;
        }
        const match = line.match(/^0x[0-9A-F]+:\s+(.*)$/);
        if (!match) {
            continue;
        }
        const instruction = match[1].trim();
        const string = instruction.match(/^S_PUSH 0x([0-9a-f]+)$/);
        if (string) {
            pendingSlot = recent.join("\n") === ARGUMENT.join("\n") ? parseInt(string[1], 16) : null;
        } else if (instruction === "S_EQUALE" && pendingSlot !== null) {
            if (!seen.has(pendingSlot)) {
                seen.add(pendingSlot);
                slots.push(pendingSlot);
            }
            pendingSlot = null;
        }
        recent.push(instruction);
        if (recent.length > ARGUMENT.length) {
            recent.shift();
        }
    }
    if (!slots.length) {
        throw new Error(`${functionName} is not in the code dump, or no longer decides anything by`
            + ` comparing its argument. The nameplate titles are somewhere else in this version.`);
    }
    return slots;
};

/**
 * The slots Ｔ肩書き compares its argument against.
 *
 * The Japanese in the table is there to be read; what the .jaf is built from is
 * the Japanese of the same slot in the dump, so that the two cannot disagree.
 */
export const readTitleKeySlots = () => {
    const table = fs.readFileSync(TITLE_KEYS, "utf-8");
    const slots = [];
    for (const line of table.split(/\r?\n/)) {
        if (!line || line.startsWith("#")) {
            continue;
        }
        const [slot] = line.split("\t");
        slots.push(+slot);
    }
    return slots;
};

/**
 * The override, as text.
 *
 * A name the table does not know comes back unchanged, so the 301 keys nobody
 * translated -- and the English the third arm hands over -- reach the original
 * exactly as they did unpatched.
 */
export const renderTitleKeysJaf = async () => {
    const japaneseOf = readSlotJapanese();
    const englishOf = readSlotEnglish();

    const cases = [];
    const stale = [];
    const misnamed = [];
    let untranslated = 0;
    const claimed = new Map();
    const slots = readTitleKeySlots();
    for (const slot of slots) {
        const [japanese] = japaneseOf.get(slot) ?? [];
        if (japanese === undefined) {
            stale.push(`s[${slot}]`);
            continue;
        }
        const english = englishOf.get(slot);
        if (english === undefined || english === japanese) {
            ++untranslated;
            continue;
        }
        /*
         * Two characters under one English name would give the second one the
         * first one's title. Reported rather than resolved: which of the two is
         * wrong is a decision about the name.
         */
        const already = claimed.get(japanese);
        if (already !== undefined) {
            misnamed.push(`s[${slot}] and s[${already}] are both ${JSON.stringify(japanese)},`
                + ` so one of the two would draw the other's title`);
            continue;
        }
        claimed.set(japanese, slot);
        cases.push([`\tif (name == ${JSON.stringify(japanese)}) return ${JSON.stringify(english)};`, slot]);
    }

    /*
     * The slot each line answers to, in a column, so that reading this against
     * the cherry-picks is reading down rather than across. Measured in columns
     * rather than in characters: every one of these lines carries Japanese, and
     * padEnd would count a kanji as one of the two it draws.
     */
    const columns = (line) => [...line]
        .reduce((width, character) =>
            width + (/[　-ヿ＀-￯一-鿿]/.test(character) ? 2 : 1), 0);
    const column = Math.max(0, ...cases.map(([code]) => columns(code))) + 2;
    const body = cases.map(([code, slot]) =>
        code + " ".repeat(Math.max(1, column - columns(code))) + `// s[${slot}]`);

    const text = [
        "/*",
        " * The Japanese behind a character's English name, for the title on their plate.",
        " *",
        " * GENERATED by the build from game/extracted/title_keys.v1.04.tsv and",
        " * patches/system_cherry_picks.v1.04.ain.txt -- edit that file, not this one.",
        " * modules/TitleKeys.js says why the lookup needs the Japanese at all, and",
        " * docs/title-keys.md has the whole of it.",
        " */",
        "",
        "/*",
        " * One character's name, back the way Ｔ肩書き files their title under it.",
        " * Anything this does not know comes back unchanged, so a key nobody translated",
        " * -- and the already-English name AdvNamePlate@InnerCreate asks with on its",
        " * third try -- reaches the original compares exactly as it did unpatched.",
        " */",
        "string TitleLookupKey(string name)",
        "{",
        ...body,
        "\treturn name;",
        "}",
        "",
        "/*",
        " * super() is the original chain of compares, so every character the table says",
        " * nothing about keeps the title it had, and one it has never heard of still",
        " * comes back as the empty string rather than as anything drawn.",
        " */",
        `override string ${TITLE_FUNCTION}(string name)`,
        "{",
        "\treturn super(TitleLookupKey(name));",
        "}",
        "",
    ].join("\n");

    return {
        text,
        report: `${body.length} of ${slots.length} nameplate title keys`
            + (untranslated ? `, ${untranslated} whose name is still Japanese` : "")
            + (misnamed.length ? `, ${misnamed.length} sharing a Japanese name` : "")
            + (stale.length ? `, ${stale.length} the dump has no string for` : ""),
        overlong: [],
        misnamed,
        stale,
    };
};
