/**
 * The +50 treasure bonus for a first killing blow, on every battle rather than
 * once per character per quest.
 *
 * One folder is one feature: the file that makes the change, and this manifest
 * naming it. The folder's name -- always-first-finisher -- is the name --with=,
 * --without= and the release folder use, and modules/Features.js finds it by
 * reading features/, so no list anywhere else mentions it.
 *
 * One file, where the other two features are a .jaf and a .jam apiece: the hook
 * is a property getter that needs neither `this` nor a caller's argument, which
 * is the whole of what sent those two to hand-written assembly. So there is no
 * ordering requirement here either -- the .jaf defines the switch and overrides
 * the getter in the same compilation unit.
 *
 * The bonus itself, and why the getter is the place to reach it rather than the
 * bonus collection or the total, is in the file's own comment and in
 * docs/treasure-chest-chance.md.
 *
 * Building it in is not the same as turning it on. Like the other two, this has
 * a switch the player owns -- custom_mods\always_first_finisher_on in the game
 * folder -- so an .ain with this feature in it behaves exactly like one without
 * until that file appears.
 */
export default {
    summary: "the +50 First Finisher treasure bonus on every battle, whoever lands the kill,"
        + " instead of once per character per quest",
    /*
     * Said to the player rather than to the build: it is what the README in a
     * release folder prints under the summary above, because a feature that
     * does nothing until a file exists has to say so somewhere the player
     * looks.
     */
    howToTurnOn: "Create an empty file called `custom_mods\\always_first_finisher_on` beside `Rance10.exe` to"
        + " turn it on, and delete it to turn it off. It is read as the battle result is calculated, so neither"
        + " takes a restart. With the file there, the result screen lists First Finisher +50 after every won"
        + " battle instead of only the first time each character takes a killing blow in a quest.",
    patches: ["always_first_finisher.jaf"],
    default: true,
};
