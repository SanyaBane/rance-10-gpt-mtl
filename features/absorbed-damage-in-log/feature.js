/**
 * The damage a 制限装甲 enemy swallowed, said in the battle log instead of only
 * flashed over the enemy.
 *
 * One folder is one feature: the two files that make the change, and this
 * manifest naming them. The folder's name -- absorbed-damage-in-log -- is the
 * name --with=, --without= and the release folder use, and modules/Features.js
 * finds it by reading features/, so no list anywhere else mentions it.
 *
 * The order below is required and is the order alice-tools is handed them in:
 * the .jam resolves AbsorbedDamageInLogEnabled by name, and alice-tools stops
 * with "Unable to resolve function" if it assembles before it has compiled the
 * .jaf that defines that name.
 *
 * WHERE IT SITS. 制限装甲 is skill effect 107: an enemy carrying it takes
 * nothing at all from a hit under its threshold N, and exactly 100 from a hit
 * over it. Either way the number the player actually rolled is thrown away --
 * DamageInformation@TotalDamage answers 0 or 100 from then on. The game draws
 * that number over the enemy on an absorbed hit and counts it down to zero, and
 * on a break does not draw it at all, so a player who blinks has no way back to
 * it and no way to tell a hit that fell just short from one that fell far
 * short. The threshold itself is already readable -- it is in the support
 * state's own description, "Damage <5,000 is completely blocked", which
 * features/enemy-panel puts on screen every round -- so the player's own damage
 * is the only half missing.
 *
 * The .jam beside this file is the whole of the change, and it says which
 * function and why that one. docs/absorbed-damage-log.md is the write-up.
 *
 * Building it in is not the same as turning it on. Like the others, it has a
 * switch the player owns -- custom_mods\absorbed_damage_in_log_on in the game
 * folder -- so an .ain with this feature in it behaves exactly like one without
 * until that file appears.
 */
export default {
    /*
     * Player-facing, like whenOn below: modules/CustomMods.js puts both in the
     * README a release folder ships. Which is why neither of them names the
     * buff. 制限装甲 has no English anywhere in this repository -- no glossary
     * row, and s[12708] is one of the support state names the translation never
     * reached -- so a player reads the Japanese on the panel and would have
     * nothing to match an invented name against. What they do read in English
     * is the log line, "Cannot deal damage！(Limit Break)", and the hint under
     * the enemy's stats, "Takes no damage unless a single hit clears a certain
     * threshold". Both of these are worded off those.
     */
    summary: "the damage an enemy blocked written into the battle log, for the ones that take nothing at all"
        + " unless a hit clears their threshold -- where the game only ever flashes it over them, and on a"
        + " Limit Break shows it nowhere at all",
    /*
     * The switch the player owns: the file the game looks for, and what is
     * different once it is on. Both are player-facing prose --
     * modules/CustomMods.js puts them in the README a release folder ships and
     * in the one inside custom_mods -- so whenOn describes what somebody sees
     * rather than the file that switched it. How to switch a feature at all is
     * said once under the list rather than inside every feature, so it is not
     * here. What reads the file is the .jaf next door, and modules/Features.js
     * checks the name below against it.
     */
    switch: {
        file: "absorbed_damage_in_log_on",
        whenOn: "The battle log follows \"Limit Broken！\" with \"(7340 raw)\" and \"Cannot deal damage！\""
            + " with \"(1780 absorbed)\", so the damage such an enemy blocked can be read back instead of"
            + " only caught as it flashes over them.",
    },
    patches: ["absorbed_damage_in_log.jaf", "absorbed_damage_in_log.jam"],
    default: true,
};
