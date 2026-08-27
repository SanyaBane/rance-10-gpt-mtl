/**
 * What each card is worth at ★0, in brackets on the back of the card, beside
 * the numbers its rank has grown that into.
 *
 * One folder is one feature: the two files that make the change, and this
 * manifest naming them. The folder's name -- base-stats-on-card -- is the name
 * --with=, --without= and the release folder use, and modules/Features.js finds
 * it by reading features/, so no list anywhere else mentions it.
 *
 * The order below is required and is the order alice-tools is handed them in:
 * the .jam resolves BaseStatsOnCardEnabled by name, and alice-tools stops with
 * "Unable to resolve function" if it assembles before it has compiled the .jaf
 * that defines that name. Each of the two files says why it is the kind of file
 * it is.
 *
 * Nothing about the game's arithmetic moves. The figure in the brackets is the
 * ＨＰ / ＡＴＫ column the game has been multiplying all along, times the five it
 * multiplies by at ★0 -- docs/card-base-stats.md has the formula, and why that
 * figure rather than the bare column -- so this is information the screen was
 * withholding rather than a change to what any of it means.
 */
export default {
    summary: "what each card is worth at rank 0, in brackets on the card back beside the numbers its rank has"
        + " grown that into",
    /*
     * The switch the player owns: the file the game looks for, and what is
     * different once it is on. Both are player-facing prose --
     * modules/CustomMods.js puts them in the README a release folder ships and
     * in the one inside custom_mods.
     *
     * whenOn is spent on the one thing the summary cannot say and the player
     * would otherwise find out by experiment: this switch, alone among them,
     * does not take effect on a card the same session has already drawn,
     * because the layer it guards is cached under the card Id. The .jam has the
     * reasoning.
     */
    switch: {
        file: "base_stats_on_card_on",
        whenOn: "Cards already looked at this session keep the face they were drawn with, so this one is best"
            + " set before starting the game rather than switched while it runs.",
    },
    patches: ["base_stats_on_card.jaf", "base_stats_on_card.jam"],
    default: true,
};
