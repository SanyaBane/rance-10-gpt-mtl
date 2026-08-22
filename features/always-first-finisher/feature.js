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
        file: "always_first_finisher_on",
        whenOn: "You will see it as the First Finisher +50 line on the result screen after a won battle.",
    },
    patches: ["always_first_finisher.jaf"],
    default: true,
};
