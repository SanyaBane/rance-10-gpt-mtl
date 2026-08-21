/**
 * A rank-up keeps the experience the character had already accumulated,
 * instead of resetting the bar to empty.
 *
 * One folder is one feature: the three files that make the change, and this
 * manifest naming them. The folder's name -- rank-up-keep-progress -- is the
 * name --with=, --without= and the release folder use, and modules/Features.js
 * finds it by reading features/, so no list anywhere else mentions it.
 *
 * The order below is required and is the order alice-tools is handed them in:
 * both .jam files resolve RankUpExpToConsume by name, and alice-tools stops
 * with "Unable to resolve function" if either assembles before it has compiled
 * the .jaf that defines that name. Each of the three files says why it is the
 * kind of file it is, and the .jaf is where the arithmetic lives.
 *
 * TWO SITES, ONE SWITCH. The game gives a rank away in two places, and both
 * hand over exactly the shortfall and nothing more -- so a character who was
 * 99% of the way to the next rank collects one point of experience from it:
 *
 *     SceneQuestMapExp@ShowExpUpEffect (23856)   quest_map_exp.jam
 *     SkillEffectProcessRankUp@Process (27510)   skill_rank_up.jam
 *
 * Both are patched, because leaving one behind would mean the same rank-up is
 * worth different things depending on where it came from, and because the two
 * expressions differ by one instruction. docs/rank-up-keep-progress.md has the
 * comparison with the alternative -- carrying the *percentage* rather than the
 * points -- and why this one is a subtraction instead of float arithmetic;
 * docs/battle-experience.md has the call chains and everything else that reads
 * these numbers.
 *
 * The friendship screen's own rank-ups (FriendPanel@RankUp 24773 and
 * RankUpOtherCharacter 24774) are deliberately not here. They pay a flat
 * amount rather than a shortfall, so there is nothing in them to carry: they
 * already leave whatever they do not spend in the bar.
 *
 * Nothing here touches a string, which is what lets it build under
 * --text-lang=jp along with everything else. The rank-up banner the map tile
 * draws is unchanged, because what changed is a number and not what is said
 * about it.
 *
 * Building it in is not the same as turning it on. Like the other three, this
 * has a switch the player owns -- custom_mods\rank_up_keep_progress_on in the
 * game folder -- so an .ain with this feature in it behaves exactly like one
 * without until that file appears.
 */
export default {
    summary: "a rank-up keeps the experience already accumulated toward it, instead of emptying the bar",
    /*
     * Said to the player rather than to the build: it is what the README in a
     * release folder prints under the summary above, because a feature that
     * does nothing until a file exists has to say so somewhere the player
     * looks.
     */
    howToTurnOn: "Create an empty file called `custom_mods\\rank_up_keep_progress_on` beside `Rance10.exe` to"
        + " turn it on, and delete it to turn it off. It is read as the rank is awarded, so neither takes a"
        + " restart. With the file there, an EXP tile on a quest map and the in-battle rank-up skill both leave"
        + " the experience a character had already earned in the bar rather than clearing it, so spending them on"
        + " someone who is nearly ranked up no longer wastes the progress.",
    patches: ["rank_up_keep_progress.jaf", "quest_map_exp.jam", "skill_rank_up.jam"],
    default: true,
};
