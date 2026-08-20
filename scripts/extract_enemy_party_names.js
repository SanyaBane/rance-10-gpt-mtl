/**
 * Find the names that go over an enemy's HP bar, and write them down.
 *
 *   npm run regenerate-enemy-party-names
 *
 * Every enemy in the game is defined in one function, Ｔ敵本体生成, which sets
 * a handful of locals and hands them to Ｔ敵本 178 times. One of those locals is
 * ▲名前 -- the display name, as against コード名 and ▲ＣＧ名 beside it, which
 * are keys -- and it ends up in Enemy@Id, which is what the plate, the battle
 * log and the two battle info screens draw.
 *
 * In the ain.txt dump those names are indistinguishable from the code names and
 * the AI presets they sit among; the code says which is which, and with
 * --no-macros a string assigned to a local looks like this:
 *
 *     PUSHLOCALPAGE / PUSH <local> / REF / S_PUSH <string> / S_ASSIGN
 *
 * So this reads which local ▲名前 is out of the function's own header, walks the
 * body for that shape, and writes what it finds to
 * game/extracted/enemy_party_names.v1.04.tsv. The English lives in
 * glossaries/enemy_party_glossary.tsv and the build renders the two into a .jaf;
 * modules/EnemyPartyNames.js says why a .jaf rather than translated strings,
 * and docs/enemy-party-names.md has the whole of it.
 *
 * The slot each name sits in is written down too, with how many other places
 * push it. Nothing here uses those numbers -- they are the argument for the
 * .jaf, not an input to it: 45 of these names share a slot with something else,
 * and 14 of those are keys, so translating the strings would break a card box
 * or a flag lookup rather than change a label.
 */
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import * as readline from "readline";
import {createReadStream} from "fs";
import {AIN, AIN_TXT} from "../modules/AinFiles.js";
import {alice, run} from "../modules/AliceTools.js";
import {readAinStrings} from "../modules/EnemyInfo.js";
import {ENEMY_PARTY_FUNCTION, ENEMY_PARTY_NAMES, ENEMY_PARTY_VARIABLE} from "../modules/EnemyPartyNames.js";
import {ROOT} from "../modules/Env.js";

/**
 * Which local ▲名前 is, and which string slots the function assigns to it.
 *
 * Both come out of the same pass. The header alice-tools writes above each
 * function lists its arguments and locals by name and number -- "; VAR  2:
 * ▲名前 : string" -- and the number is what the body refers to, so the header
 * is read on the way in rather than the numbering being assumed.
 *
 * Every other S_PUSH in the dump is counted as well, so that the table can say
 * which of these names is also something else somewhere.
 */
const scanCode = async (dumpPath) => {
    const assigned = [];          // string slots assigned to ▲名前, in the order they appear
    const otherUses = new Map();  // string slot -> how many times it is pushed anywhere else
    let local = null;
    let inHeader = false;
    let heading = null;
    let inFunction = false;
    const window = [];
    const input = createReadStream(dumpPath);
    for await (const line of readline.createInterface({input, crlfDelay: Infinity})) {
        if (line.startsWith("; ")) {
            if (!inHeader) {
                heading = line.slice(2);
            }
            inHeader = true;
            if (heading === ENEMY_PARTY_FUNCTION) {
                const declaration = line.match(/^;\s+(?:ARG|VAR)\s+(\d+):\s+(\S+)\s+:/);
                if (declaration && declaration[2] === ENEMY_PARTY_VARIABLE) {
                    local = Number(declaration[1]);
                }
            }
            continue;
        }
        if (inHeader) {
            inHeader = false;
            if (line.startsWith("FUNC ")) {
                inFunction = heading === ENEMY_PARTY_FUNCTION;
                continue;
            }
        }
        if (line.startsWith("ENDFUNC") || line.startsWith("EOF ")) {
            inFunction = false;
        }
        const match = line.match(/^0x[0-9A-F]+:\s+(.*)$/);
        if (!match) {
            continue;
        }
        const instruction = match[1].trim();
        window.push(instruction);
        if (window.length > 4) {
            window.shift();
        }
        const pushed = instruction.match(/^S_PUSH 0x([0-9a-f]+)$/);
        if (!pushed) {
            continue;
        }
        const slot = parseInt(pushed[1], 16);
        const target = window[1]?.match(/^PUSH 0x([0-9a-f]+)$/);
        const isName = inFunction
            && local !== null
            && window.length === 4
            && window[0] === "PUSHLOCALPAGE"
            && window[2] === "REF"
            && target
            && parseInt(target[1], 16) === local;
        if (isName) {
            assigned.push(slot);
        } else {
            otherUses.set(slot, (otherUses.get(slot) ?? 0) + 1);
        }
    }
    if (local === null) {
        throw new Error(`${ENEMY_PARTY_FUNCTION} has no ${ENEMY_PARTY_VARIABLE} in ${AIN}.`
            + " The enemy names are somewhere else in this version.");
    }
    if (!assigned.length) {
        throw new Error(`${ENEMY_PARTY_FUNCTION} never assigns a literal to ${ENEMY_PARTY_VARIABLE}`
            + ` in ${AIN}. The enemy names are built some other way in this version.`);
    }
    return [assigned, otherUses];
};

run(async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "rance10-enemy-party-names-"));
    const codeDump = path.join(tempDir, "code.jam");
    try {
        const status = alice(["ain", "dump", "-C", "--no-macros", "-o", codeDump, AIN]);
        if (status !== 0) {
            return status;
        }
        const [assigned, otherUses] = await scanCode(codeDump);
        const strings = await readAinStrings(AIN_TXT);

        /*
         * In the order the function defines them, which is the order the game
         * introduces them -- the Monster Army first, the Fiends last -- so that
         * the glossary beside this reads as the campaign rather than as a
         * sorted list. A name assigned twice appears once.
         */
        const seen = new Set();
        const rows = [];
        for (const slot of assigned) {
            const japanese = strings.get(slot) ?? "";
            if (!japanese || seen.has(japanese)) {
                continue;
            }
            seen.add(japanese);
            rows.push(`${JSON.stringify(japanese)}\t${slot}\t${otherUses.get(slot) ?? 0}`);
        }

        const shared = rows.filter(row => Number(row.split("\t")[2]) > 0);
        const header = [
            `# The names ${ENEMY_PARTY_FUNCTION} gives the enemy party -- what the plate over its HP`,
            "# bar says. Generated by scripts/extract_enemy_party_names.js -- edit",
            "# glossaries/enemy_party_glossary.tsv to change the English, not this file.",
            "#",
            "# Columns: the Japanese, JSON-quoted <TAB> its string slot <TAB> how many other",
            "# places push that slot.",
            "#",
            "# The last column is here to be read, not used: it is why the English is a .jaf",
            `# overriding Enemy@Id::get rather than ${rows.length} translated strings.`,
            `# ${shared.length} of these names share their slot with something else, and for some of`,
            "# them that something is a key -- ジャハルッカス is a card Id, マエリータ隊 a flag name.",
            "",
        ].join("\n");
        await fs.writeFile(ENEMY_PARTY_NAMES, header + rows.join("\n") + "\n", "utf-8");

        console.log(`Found ${rows.length} enemy names in ${assigned.length} assignments`
            + ` -> ${path.relative(ROOT, ENEMY_PARTY_NAMES)}`);
        return 0;
    } finally {
        await fs.rm(tempDir, {recursive: true, force: true});
    }
});
