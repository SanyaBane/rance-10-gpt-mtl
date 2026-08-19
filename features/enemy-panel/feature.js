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
    summary: "the enemy status panel at the start of every round, not only after アナライズ",
    /*
     * Said to the player rather than to the build: it is what the README in a
     * release folder prints under the summary above, because a feature that
     * does nothing until a file exists has to say so somewhere the player
     * looks. A feature with no switch leaves this out and the README says it is
     * on as soon as it is installed.
     */
    howToTurnOn: "Create an empty file called `custom_mods\\enemy_panel_on` beside `Rance10.exe` to turn it"
        + " on, and delete it to turn it off. It is read at the start of every round, so neither takes a restart.",
    patches: ["enemy_info_panel.jaf", "enemy_info_panel.jam"],
    default: true,
};
