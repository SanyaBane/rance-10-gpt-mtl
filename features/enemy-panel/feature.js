/**
 * The enemy status panel at the start of every round, not only after アナライズ.
 *
 * One folder is one feature: the two files that make the change, and this
 * manifest naming them. The folder's name -- enemy-panel -- is the name
 * --with=, --without= and the release folder use, and modules/Features.js
 * finds it by reading features/, so no list anywhere else mentions it.
 *
 * The order below is required and is the order alice-tools is handed them in:
 * the .jam resolves EnemyInfoPanelEnabled by name, and alice-tools stops with
 * "Unable to resolve function" if it assembles before it has compiled the .jaf
 * that defines that name. Each of the two files says why it is the kind of
 * file it is.
 *
 * Only those two. The same panel's card Ids in English are
 * patches/enemy_panel_cards.jam, which scripts/ain.js applies whatever is
 * selected here -- that is translation rather than a change to how the game
 * plays, and it stays out of this folder for the same reason it stopped
 * sharing a file with the .jam next to it: leaving the feature out must not
 * cost anybody the English.
 *
 * Building it in is not the same as turning it on. The panel also has a switch
 * the player owns -- custom_mods\enemy_panel_on in the game folder, read at
 * the start of every round -- so an .ain with this feature in it behaves
 * exactly like one without until that file appears.
 */
export default {
    /* Analyze rather than アナライズ: the summary is player-facing, and the release READMEs are English. */
    summary: "the enemy status panel at the start of every round, not only after Analyze",
    /*
     * The switch the player owns: the file the game looks for, and what is
     * different once it is on. Both are player-facing prose --
     * modules/CustomMods.js puts them in the README a release folder ships and
     * in the one inside custom_mods. There is no whenOn here because the summary
     * above is already the whole of what changes, and how to switch a feature at
     * all is said once under the list rather than inside every feature. What
     * reads the file is the .jaf next door, and modules/Features.js checks the
     * name below against it.
     */
    switch: {
        file: "enemy_panel_on",
    },
    patches: ["enemy_info_panel.jaf", "enemy_info_panel.jam"],
    default: true,
};
