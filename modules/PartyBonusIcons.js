/**
 * The icon on a party bonus button, which its English name would otherwise take
 * away.
 *
 * `PartyBonusButton@InitParts` (FUNC 24325) builds the icon's CG name out of the
 * bonus's own name:
 *
 *     ActivityCg@SetCg("シス／部隊ボーナス／アイコン／%s" % PartyBonus@GetIconSubName())
 *
 * and `GetIconSubName` (27851) has one case of its own -- type 5 returns
 * s[4039] 全アイテム強化, because the name of that bonus carries a ★ and the CG
 * cannot -- and otherwise returns `GetName()`, which is s[4020]..s[4035]. So
 * those sixteen slots are a label *and* half of a file name:
 * archives/Rance10CG2_manifest.txt lists シス／部隊ボーナス／アイコン／リーダー枠追加.ajp
 * and fourteen more by exactly the words `GetName` returns. Translating them --
 * which patches/system_cherry_picks.v1.04.ain.txt has done for as long as it has
 * existed -- asks the game for シス／部隊ボーナス／アイコン／Add Leader Slot, which
 * no archive has.
 *
 * The label is worth keeping in English, so the slots stay translated and this
 * puts the Japanese back on the way to `SetCg`: the override reads what the
 * original returned and maps it back. Which is why the table is keyed on the
 * *English* rather than on the type -- `super()` hands over a string, and the
 * .jaf compiler cannot read a struct's properties anyway, so `this.Type` is not
 * available to switch on. See docs/party-bonus-icons.md.
 *
 * Generated from the cherry-picks rather than from a glossary of its own,
 * because there is no decision in it: the English is whatever that file says
 * today, and pairing it with the Japanese of the same slot out of the committed
 * dump is the whole of the table. A name edited there cannot go stale here.
 */
import * as path from "path";
import {readSlotEnglish, readSlotJapanese} from "./CherryPicks.js";
import {BUILD, ROOT} from "./Env.js";
import * as fs from "fs";

/** Generated, so it goes to build/ beside the two other generated .jaf. */
export const PARTY_BONUS_ICON_JAF = path.join(BUILD, "party_bonus_icons.jaf");

/** The archive the icons are packed in, and the only list of them anywhere here. */
export const CG2_MANIFEST = path.join(ROOT, "archives", "Rance10CG2_manifest.txt");

/** What `SetCg` is handed, with the name substituted in. */
const ICON_PREFIX = "シス／部隊ボーナス／アイコン／";

/**
 * The slots `PartyBonus@GetName` returns, one per PartyBonusType.
 *
 * In the enum's order -- `PartyBonusType@String` (FUNC 36320) names them
 * AddLeader, ApMaxUp, ApHealUp, ChangeLeader, Jinma, ItemStar2Times,
 * TreasureLuckUp, HannyZippo, BoostPer, OverkillEnable, StatusHpPerUp,
 * StatusAtkPhysicalUp, StatusAtkMagicalUp, StatusExpUp, StatusAllPerUp,
 * StatusMaxUp -- which is not the order the switch lists them in.
 */
const NAME_SLOTS = [4020, 4021, 4022, 4023, 4024, 4031, 4032, 4033,
    4025, 4026, 4027, 4028, 4029, 4030, 4034, 4035];

/**
 * The one slot whose English never reaches `SetCg`.
 *
 * 全アイテム★強化 is type 5, and `GetIconSubName` answers that type with
 * s[4039] 全アイテム強化 instead of the name -- the ★ is not in any file name.
 * So it needs no row, and it would be the only Japanese in the table that the
 * manifest has no icon for.
 */
const NOT_AN_ICON = 4031;

/** Every CG the party bonus panel has an icon file for. */
const readIconNames = () => {
    const manifest = fs.readFileSync(CG2_MANIFEST, "utf-8");
    const names = new Set();
    for (const line of manifest.split(/\r?\n/)) {
        // A name with a space in it is quoted in the manifest; none of these are,
        // but the pack list holds one that is, so the quotes come off first.
        const entry = line.trim().replace(/^"(.*)"$/, "$1");
        if (entry.startsWith(ICON_PREFIX) && entry.endsWith(".ajp")) {
            names.add(entry.slice(ICON_PREFIX.length, -".ajp".length));
        }
    }
    return names;
};

/**
 * The override, as text.
 *
 * A name the table does not know comes back unchanged, which is what the
 * untranslated slots want: s[4039] and s[4040] are Japanese where they sit and
 * are the two strings `GetIconSubName` returns without going through `GetName`
 * at all.
 */
export const renderPartyBonusIconsJaf = async () => {
    const japaneseOf = readSlotJapanese();
    const englishOf = readSlotEnglish();
    const icons = readIconNames();

    const cases = [];
    const stale = [];
    const misnamed = [];
    let untranslated = 0;
    const claimed = new Map();
    for (const slot of NAME_SLOTS) {
        if (slot === NOT_AN_ICON) {
            continue;
        }
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
        if (!icons.has(japanese)) {
            stale.push(japanese);
        }
        /*
         * Two bonuses under one English word would make the second one's icon
         * the first one's. Reported rather than resolved: which of the two is
         * wrong is a decision about the label.
         */
        const already = claimed.get(english);
        if (already !== undefined) {
            misnamed.push(`s[${slot}] and s[${already}] are both ${JSON.stringify(english)},`
                + ` so one of the two would draw the other's icon`);
            continue;
        }
        claimed.set(english, slot);
        cases.push([`\tif (name == ${JSON.stringify(english)}) return ${JSON.stringify(japanese)};`, slot]);
    }

    /*
     * The slot each line answers to, in a column, so that reading this against
     * the cherry-picks is reading down rather than across. Measured in columns
     * rather than in characters: every one of these lines carries Japanese, and
     * padEnd would count a kanji as one of the two it draws.
     */
    const columns = (line) => [...line]
        .reduce((width, character) =>
            width + (/[\u3000-\u30ff\uff00-\uffef\u4e00-\u9fff]/.test(character) ? 2 : 1), 0);
    const column = Math.max(0, ...cases.map(([code]) => columns(code))) + 2;
    const body = cases.map(([code, slot]) =>
        code + " ".repeat(Math.max(1, column - columns(code))) + `// s[${slot}]`);

    const text = [
        "/*",
        " * The Japanese behind a party bonus's English name, for its icon.",
        " *",
        " * GENERATED by the build from patches/system_cherry_picks.v1.04.ain.txt and the",
        " * Japanese of the same slots -- edit that file, not this one.",
        " * modules/PartyBonusIcons.js says why the icon needs the Japanese at all, and",
        " * docs/party-bonus-icons.md has the whole of it.",
        " */",
        "",
        "/*",
        " * One bonus name, back the way the CG is filed under it. Anything this does",
        " * not know comes back unchanged, so a bonus nobody has translated -- and the",
        " * two strings GetIconSubName returns without asking GetName, 全アイテム強化 and",
        " * 部隊強化 -- reaches SetCg exactly as it did unpatched.",
        " */",
        "string PartyBonusIconName(string name)",
        "{",
        ...body,
        "\treturn name;",
        "}",
        "",
        "/*",
        " * super() is the original, so the type 5 case and the empty-name fallback",
        " * inside it are kept rather than reimplemented. What comes back is the CG",
        " * name PartyBonusButton@InitParts substitutes into",
        " * シス／部隊ボーナス／アイコン／%s -- never anything drawn as text.",
        " */",
        "override string PartyBonus@GetIconSubName(void)",
        "{",
        "\treturn PartyBonusIconName(super());",
        "}",
        "",
    ].join("\n");

    return {
        text,
        report: `${body.length} of ${NAME_SLOTS.length - 1} party bonus icons`
            + (untranslated ? `, ${untranslated} whose name is still Japanese` : "")
            + (misnamed.length ? `, ${misnamed.length} sharing an English name` : "")
            + (stale.length ? `, ${stale.length} the archive has no icon for` : ""),
        overlong: [],
        misnamed,
        stale,
    };
};
