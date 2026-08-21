/**
 * The two cooking skills always work, instead of failing a quarter of the time.
 *
 * One folder is one feature: the two files that make the change, and this
 * manifest naming them. The folder's name -- reliable-cooking -- is the name
 * --with=, --without= and the release folder use, and modules/Features.js finds
 * it by reading features/, so no list anywhere else mentions it.
 *
 * The order below is required and is the order alice-tools is handed them in:
 * the .jam resolves CookingSkillPercent by name, and alice-tools stops with
 * "Unable to resolve function" if it assembles before it has compiled the .jaf
 * that defines that name. Each of the two files says why it is the kind of file
 * it is.
 *
 * Nothing here touches archives/Rance10EX_v1_04/11_スキルデータ.x, and that is
 * deliberate rather than an omission. The skill's own description is in that
 * table, so it still reads Buff: <75%> with the switch on -- but a .x edit
 * cannot be left out of a build the way a .jaf and a .jam can, and a feature
 * that is on for everybody is not a feature.
 *
 * Building it in is not the same as turning it on. Like the enemy panel, this
 * has a switch the player owns -- custom_mods\reliable_cooking_on in the game
 * folder -- so an .ain with this feature in it behaves exactly like one without
 * until that file appears.
 */
export default {
    summary: "Meal Preparation and Sweets Making always work, instead of failing a quarter of the time",
    /*
     * Said to the player rather than to the build: it is what the README in a
     * release folder prints under the summary above, because a feature that
     * does nothing until a file exists has to say so somewhere the player
     * looks.
     */
    howToTurnOn: "Create an empty file called `custom_mods\\reliable_cooking_on` beside `Rance10.exe` to turn"
        + " it on, and delete it to turn it off. It is read as the skill fires, so neither takes a restart."
        + " The skill descriptions still say 75% and 80%; with the file there, both always succeed.",
    patches: ["cooking_skill_chance.jaf", "cooking_skill_chance.jam"],
    default: true,
};
