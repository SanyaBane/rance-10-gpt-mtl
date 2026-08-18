/**
 * The optional patches: the ones that change what the game *does* rather than
 * what it says, each under a name you can build with or without.
 *
 * A feature is a line saying what it does and the arguments that apply it, and
 * that is the whole of what anything here knows about it. scripts/ain.js
 * applies whichever are selected, scripts/release.js builds one extra .ain per
 * feature without being told any names, and adding the next one is an entry in
 * the table below.
 *
 * They are on by default, because the .ain a build installs into the game is
 * the one that gets played. The release folder is the other way round: its
 * Rance10.ain is the translation and nothing else, and each feature is a
 * separate file to copy over it, so that installing the English does not mean
 * taking modified game logic with it. scripts/release.js is where that layout
 * is written down.
 */
import {flagValue} from "./Argv.js";

export const FEATURES = {
    "enemy-panel": {
        summary: "the enemy status panel at the start of every round, not only after アナライズ",
        /*
         * The .jaf is the switch and the .jam is the call, and this order is
         * required: the .jam resolves EnemyInfoPanelEnabled by name, and
         * alice-tools stops with "Unable to resolve function" if it assembles
         * before it has compiled. Each of the two files says why it is the kind
         * of file it is.
         *
         * Only those two. The same panel's card Ids in English are
         * patches/enemy_panel_cards.jam, which scripts/ain.js applies whatever
         * is selected here -- the two were one file until this table needed to
         * leave the feature out without taking a translation with it.
         *
         * Building it in is not the same as turning it on. The panel also has a
         * switch the player owns -- custom_mods\enemy_panel.on in the game
         * folder, read at the start of every round -- so an .ain with this
         * feature in it behaves exactly like one without until that file
         * appears.
         */
        args: ["--jaf", "patches/enemy_info_panel.jaf", "--jam", "patches/enemy_info_panel.jam"],
        default: true,
    },
};

export const FEATURE_NAMES = Object.keys(FEATURES);

/** --with=a,b and --without=a,b, both spellings each, empty entries ignored. */
const listed = (flag) => (flagValue(flag) ?? "")
    .split(",")
    .map(name => name.trim())
    .filter(Boolean)
    .map(name => {
        if (!(name in FEATURES)) {
            throw new Error(`There is no "${name}" feature. modules/Features.js has: ${FEATURE_NAMES.join(", ")}.`);
        }
        return name;
    });

/**
 * What this run builds: the defaults, less what --without names, plus what
 * --with names. A feature in both flags is a contradiction rather than a
 * precedence question, so it is reported instead of resolved.
 */
export const selectedFeatures = () => {
    const added = listed("with");
    const removed = listed("without");
    const both = added.filter(name => removed.includes(name));
    if (both.length > 0) {
        throw new Error(`--with and --without both name ${both.join(", ")}. Pass each feature to one of them.`);
    }
    return FEATURE_NAMES.filter(name => (FEATURES[name].default || added.includes(name)) && !removed.includes(name));
};

/**
 * Their arguments for `alice ain edit`, in the order the table lists them.
 * Takes the selection so that a caller which has already read it -- to report
 * it, or to refuse a name -- does not read the command line twice.
 */
export const featureArgs = (names = selectedFeatures()) => names.flatMap(name => FEATURES[name].args);
