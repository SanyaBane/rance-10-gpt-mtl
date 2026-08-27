/**
 * The two .jam that replace the back of a card, and the check that keeps them
 * agreed.
 *
 * CardConstructProcessCacheBackCard@Create (FUNC 23037) is replaced twice over:
 *
 *   patches/card_back_names.jam                            the faction in English
 *   features/base-stats-on-card/base_stats_on_card.jam     that, plus the brackets
 *
 * They cannot be merged and they cannot be split. Not merged, because the
 * English has to reach a build the feature is left out of -- the rule
 * patches/enemy_panel_cards.jam exists for. Not split, because alice-tools
 * applies the *last* --jam it is given and says nothing about the earlier one:
 * scripts/ain.js hands it the features after the English, so with the feature
 * built in its copy runs and the other is overwritten whole, and with the
 * feature left out the roles swap. Each file therefore has to be correct on its
 * own, which means both carry the same body.
 *
 * So this compares them. Two marked regions -- the function up to where the
 * feature's block goes, and the tail after it -- have to match byte for byte,
 * and the build stops if they do not. Which is the cheap half of the bargain:
 * the duplication is real, but it cannot rot silently, and the alternative
 * (generating both from one source) buys nothing a comparison does not, at the
 * price of a generated file nobody can read in a diff.
 *
 * Run early, before a build renders a line of dialogue -- a mismatch is a
 * mistake in this repository and the message is worth more than the minute.
 */
import * as fs from "fs/promises";
import * as path from "path";
import {ROOT} from "./Env.js";

export const CARD_BACK_NAMES = path.join(ROOT, "patches", "card_back_names.jam");
export const CARD_BACK_STATS = path.join(ROOT, "features", "base-stats-on-card", "base_stats_on_card.jam");

/**
 * The markers, spelled the same in both files so that neither is the original.
 * A region is the lines strictly between its two, which is what lets each file
 * carry its own explanation above and around them.
 */
const REGIONS = [
    ["; >>>>>> SHARED CARD-BACK BODY -- HEAD", "; <<<<<< SHARED CARD-BACK BODY -- HEAD"],
    ["; >>>>>> SHARED CARD-BACK BODY -- TAIL", "; <<<<<< SHARED CARD-BACK BODY -- TAIL"],
];

/**
 * The lines between one pair of markers.
 *
 * Line endings are stripped before comparing, because these two files are
 * committed with CRLF and a checkout with different settings would otherwise
 * fail a check about content with a complaint about \r.
 */
const region = (text, file, [open, close]) => {
    const lines = text.split(/\r?\n/);
    const from = lines.indexOf(open);
    const to = lines.indexOf(close);
    if (from < 0 || to < 0) {
        throw new Error(`${path.relative(ROOT, file)} has no ${from < 0 ? open : close} line.`
            + " Both card-back .jam carry two marked regions, and modules/CardBack.js compares them;"
            + " removing a marker would make the check pass by comparing nothing.");
    }
    if (to < from) {
        throw new Error(`${path.relative(ROOT, file)} closes ${close} before it opens.`);
    }
    return lines.slice(from + 1, to);
};

/**
 * Stop the build if the two files' shared regions have drifted, naming the
 * first line that differs -- the whole point is to be told which edit was made
 * to one file and not the other.
 */
export const checkCardBack = async () => {
    const [names, stats] = await Promise.all([
        fs.readFile(CARD_BACK_NAMES, "utf-8"),
        fs.readFile(CARD_BACK_STATS, "utf-8"),
    ]);
    for (const markers of REGIONS) {
        const a = region(names, CARD_BACK_NAMES, markers);
        const b = region(stats, CARD_BACK_STATS, markers);
        const at = a.findIndex((line, index) => line !== b[index]);
        if (at >= 0 || a.length !== b.length) {
            const line = at >= 0 ? at : Math.min(a.length, b.length);
            const shown = (list) => list[line] === undefined ? "(the region ends here)" : JSON.stringify(list[line]);
            throw new Error(`The two card-back .jam have drifted, in ${markers[0].replace("; >>>>>> ", "")},`
                + ` at line ${line + 1} of the region:\n`
                + `  ${path.relative(ROOT, CARD_BACK_NAMES)}: ${shown(a)}\n`
                + `  ${path.relative(ROOT, CARD_BACK_STATS)}: ${shown(b)}\n`
                + "Both replace FUNC 23037, and alice-tools applies whichever comes last, so each has to be"
                + " right on its own. modules/CardBack.js says why they are two files.");
        }
    }
};
