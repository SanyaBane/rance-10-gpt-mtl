/**
 * The First Finisher treasure bonus paid as +100 instead of +50 -- enough to
 * make a battle that pays it a certain chest on its own.
 *
 * One folder is one feature: the two files that make the change, and this
 * manifest naming them. The folder's name -- first-finisher-100 -- is the name
 * --with=, --without= and the release folder use, and modules/Features.js finds
 * it by reading features/, so no list anywhere else mentions it.
 *
 * The order below is required and is the order alice-tools is handed them in:
 * the .jam resolves FirstFinisher100Value by name, and alice-tools stops with
 * "Unable to resolve function" if it assembles before it has compiled the .jaf
 * that defines that name. The pair, and why the figure has to be changed in
 * assembly rather than a plain .jaf override, is in the two files.
 *
 * WHERE IT SITS. The chest after a won battle is RAND(100) <= a sum of five
 * bonuses, guaranteed at 100 -- docs/treasure-chest-chance.md. The First
 * Finisher is one of the five and ships worth 50; at 100 it clears the roll by
 * itself. It is a sibling of always-first-finisher, which decides how *often*
 * that line is paid: this one decides how *much*. On its own it makes the first
 * kill of each character a sure chest, once per quest. With always-first-finisher
 * on as well, the line is paid every won battle, so every won battle is a chest.
 *
 * Building it in is not the same as turning it on. Like the others, it has a
 * switch the player owns -- custom_mods\first_finisher_100_on in the game
 * folder -- so an .ain with this feature in it behaves exactly like one without
 * until that file appears.
 */
export default {
    summary: "the First Finisher treasure bonus paid as +100 instead of +50, enough to make a battle"
        + " that pays it a certain chest -- a certain chest every won battle with always-first-finisher on too",
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
        file: "first_finisher_100_on",
        whenOn: "The First Finisher +50 line on the result screen reads +100 instead, and a battle that shows"
            + " it gives a chest for certain.",
    },
    patches: ["first_finisher_100.jaf", "first_finisher_100.jam"],
    default: true,
};
