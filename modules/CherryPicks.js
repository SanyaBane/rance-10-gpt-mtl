/**
 * The hand-translated system text, and the Japanese it overwrites.
 *
 * patches/system_cherry_picks.v1.04.ain.txt is the menu labels, the battle log,
 * the war situation screen and the character epithets, written by hand rather
 * than translated from the corpus. scripts/regenerate_aai_txt.js appends it
 * after the whole rendered dialogue and alice-tools keeps the last assignment
 * it reads, so nothing in it merely adds text: it beats whatever the corpus put
 * in the same slot. docs/system-cherry-picks.md is what that has cost.
 *
 * The file carries no Japanese, which is why no check ever ran over it. Every
 * slot has one in the dump game/ain/ already carries, and pairing the two gives
 * createNameChecker exactly what it wants -- 88 complaints the first time it was
 * done by hand, 61 of them real. Done at every build now, so the next one
 * arrives as a build warning rather than as a session of reading.
 */
import * as fs from "fs";
import * as path from "path";
import {AIN_TXT} from "./AinFiles.js";
import {ROOT} from "./Env.js";
import {createNameChecker} from "./NameNormalizer.js";

/** The system text translated by hand, appended last and therefore winning. */
export const CHERRY_PICKS = path.join(ROOT, "patches", "system_cherry_picks.v1.04.ain.txt");

/**
 * The Japanese of every string slot, out of the dump game/ain/ already carries.
 *
 * docs/system-cherry-picks.md said for a while to take this from a fresh
 * alice ain dump -t, on the grounds that the committed dump is messages only.
 * It is not: the .json is, and the .txt has all 15 770 slots commented out
 * beside the messages, byte for byte what a fresh dump writes. So nothing here
 * needs alice-tools or GAME_DIR to run.
 *
 * A slot pushed from several places appears several times and keeps every
 * distinct Japanese it is pushed with.
 */
export const readSlotJapanese = () => {
    const bySlot = new Map();
    const dump = fs.readFileSync(AIN_TXT, "utf-8");
    for (const match of dump.matchAll(/^;s\[(\d+)\]\s*=\s*"((?:[^"\\\n]|\\.)*)"\r?$/gm)) {
        const slot = +match[1];
        const japanese = match[2].replace(/\\(.)/g, (_, character) =>
            character === "n" ? "\n" : character === "t" ? "\t" : character === "r" ? "\r" : character);
        const already = bySlot.get(slot);
        if (!already) {
            bySlot.set(slot, [japanese]);
        } else if (!already.includes(japanese)) {
            already.push(japanese);
        }
    }
    return bySlot;
};

/**
 * The complaints this file answers on purpose, so that a new one is one line
 * rather than the eighteenth.
 *
 * Every one of them is a thing createNameChecker cannot decide, and every one
 * has been read. What it cannot decide divides into four shapes: a Japanese
 * name with two entries, where whichever a line uses the other objects; an
 * entry holding the full name where this file writes the short one along with
 * all its neighbours; a name that is not spelled at all because the English
 * says it another way; and かろ, which mentions() cannot guard because the word
 * is hiragana rather than katakana.
 *
 * What is *not* in here is a slot disagreeing with a spelling the repository
 * has settled. Four of those were sitting among these until they were read
 * properly -- 源五郎's "Gengoro", 闘将's "Excavation General", 自由都市's "Free
 * City" and 魔軍's bare "monsters" -- so a complaint is only settled once
 * glossaries/mistranslated_names.json, glossaries/card_name_glossary.tsv and
 * archives/Rance10EX_v1_04/48_立ち絵名札マッピング情報.x have been asked.
 */
const SETTLED = new Map([
    ["3211 レリコフ", "FriendPanel@Name::get, where all nine neighbours are bare given names"],
    ["9187 スシヌ", "the English names nobody, which is better English than repeating him"],
    ["10690 フル", "the table holds Full Kalar; this file's house form is the short one"],
    ["10702 リア", "the Lia entry is satisfied; the Queen Lia entry is the one objecting"],
    ["10813 政宗", "the table holds Dokuganryuu Masamune; the epithet writes the short form"],
    ["10814 政宗", "the table holds Dokuganryuu Masamune; the epithet writes the short form"],
    ["10815 政宗", "the table holds Dokuganryuu Masamune; the epithet writes the short form"],
    ["10816 政宗", "the table holds Dokuganryuu Masamune; the epithet writes the short form"],
    ["10851 リア", "the Lia entry is satisfied; the Queen Lia entry is the one objecting"],
    ["10943 リア", "the Lia entry is satisfied; the Queen Lia entry is the one objecting"],
    ["14799 リア", "it does say Queen Lia -- the separator is the ideographic space this block"
        + " puts between a title and a name, so no plain includes() can see it"],
    ["14811 アギレダ", "the table holds Agireda Kosabusshi Zonna Abona; the roster writes short forms"],
    ["14830 トルストイ", "the table holds Tolstoy Bato; the roster writes short forms"],
    ["14852 チョチョマン", "the table holds Chochoman Publy; the roster writes short forms"],
    ["14930 かろ", "かろうじて, and mentions() cannot guard a hiragana word the way it guards katakana"],
    ["15032 トルストイ", "the table holds Tolstoy Bato; the war report writes the short form"],
]);

/** { "<japanese>" : "<english>" } is not the shape here -- a slot is the key. */
const ASSIGNMENT = /^s\[(\d+)]\s*=\s*"((?:[^"\\\n]|\\.)*)"/gm;

/**
 * Every cherry-picked string held to glossaries/mistranslated_names.json.
 *
 * Reported rather than repaired, like checkNameplates: this file's English is
 * a label with a width and a house style, so what a complaint wants is a
 * decision about the phrase rather than a substitution.
 *
 * A slot pushed from more than one place is asked of each of its Japanese
 * lines, and the same complaint from two of them is one complaint.
 */
export const checkCherryPickNames = async () => {
    const check = await createNameChecker();
    const slots = readSlotJapanese();
    const text = fs.readFileSync(CHERRY_PICKS, "utf-8");

    const misnamed = [];
    const answered = new Set();
    let assignments = 0;
    for (const match of text.matchAll(ASSIGNMENT)) {
        ++assignments;
        const slot = +match[1];
        const said = new Set();
        for (const japanese of slots.get(slot) ?? []) {
            for (const complaint of check(japanese, match[2])) {
                if (said.has(complaint)) {
                    continue;
                }
                said.add(complaint);
                // The name the checker complained about, which is the half of
                // its sentence that a settled entry is keyed on.
                const name = complaint.match(/ is (\S+), which the game calls/)?.[1];
                const key = `${slot} ${name}`;
                if (SETTLED.has(key)) {
                    answered.add(key);
                    continue;
                }
                misnamed.push(`s[${slot}] ${complaint}`);
            }
        }
    }

    /*
     * An entry that no longer fires. The same reason renderEnemyInfo reports a
     * glossary row the game no longer has: a list of accepted complaints that
     * nobody ever takes anything out of stops describing the file.
     */
    const stale = [...SETTLED.keys()].filter(key => !answered.has(key))
        .map(key => `s[${key.split(" ")[0]}] no longer complains about ${key.split(" ")[1]},`
            + ` so its entry in SETTLED is stale: ${SETTLED.get(key)}`);

    return {
        report: `${assignments} cherry-picked strings against the name table,`
            + ` ${answered.size} of its ${SETTLED.size} settled complaints still there`,
        misnamed,
        stale,
    };
};
