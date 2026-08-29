/**
 * The stutter that still names the title the honorific pass took away.
 *
 *   node scripts/fix_honorific_stutters.js            # what it would do
 *   node scripts/fix_honorific_stutters.js --write    # do it
 *
 * scripts/fix_honorifics.js replaced 1087 occurrences of "Lord <Name>" with
 * "<Name>-sama", and 32 of them stood behind a stutter -- 「ヨ、ヨシフ様が！？」
 * had come back as "L-Lord Joseph!?", where the "L-" is the speaker tripping
 * over the English word "Lord". Take the word away and the letter is left
 * naming nothing: "L-Joseph-sama".
 *
 * **The Japanese stutters the name, not the title.** ヨ、ヨシフ, ガ、ガルティア,
 * け、ケイブリス, ら、ランス -- every one repeats the first mora of the name
 * itself, so the English wants the name's own initial: "J-Joseph-sama". That is
 * also what the corpus does everywhere else, 3113 stutters against 147 that
 * repeat something other than the word they stand in front of.
 *
 * 11 of the 32 need nothing, because the name begins with L and the letter is
 * still right by luck: ル、ルメイ is "L-LeMay-sama" and り、リア is "L-Lia-sama".
 * Which is the whole reason this asks whether the letter matches rather than
 * whether the pass touched the row.
 *
 * **The question is narrow on purpose.** Asked of every mismatched stutter in
 * the corpus it reads 147, and 126 of those are not stutters at all: "M-Land"
 * and "Ho-Raga" and "Yo-Zef" and "Vi-Lord" are hyphenated names, and "GU-OHHHH"
 * and "A-Hya" are noises where the second half was never meant to repeat the
 * first. A rule wide enough to catch those would rewrite a place name into
 * "L-Land". So the question is asked only where the answer is already known:
 * an "L-" in front of a "<Name>-sama" whose name does not begin with L. The
 * honorific is what makes it decidable -- nothing else in the corpus puts an
 * L-stutter there.
 */

/**
 * The stutter, the name, and the honorific that makes the pair decidable.
 *
 * `[A-Za-z]{1,2}` because a stutter is written "L-" and occasionally "Lo-";
 * the lookbehind keeps it off the tail of a hyphenated word, so that the "Pi"
 * of "Pi-R-sama" is not read as a stutter over a name called "R".
 */
export const STUTTER = /(?<![A-Za-z-])([A-Za-z]{1,2})-(?=([A-Z][A-Za-z]*)-sama\b)/g;

/** Whether this stutter still spells the word it stands in front of. */
export const agrees = (prefix, name) => name.toLowerCase().startsWith(prefix.toLowerCase());

/**
 * Whether the letter is the "Lord"/"Lady" the honorific pass removed.
 *
 * Both halves matter. A prefix that is not an L was never a title -- "Y-Joseph"
 * is somebody rendering the Japanese mora ヨ and is a different question. And a
 * name that begins with L is the case where the letter came out right anyway.
 */
export const leftByTheTitle = (prefix, name) =>
    /^l$/i.test(prefix) && !agrees(prefix, name);

/**
 * Every stutter in a row that still names the title, with the fix for each.
 *
 * @param {string} english
 * @return {{index: number, length: number, before: string, after: string, name: string}[]}
 */
export const stutterFixes = (english) => {
    const fixes = [];
    for (const match of english.matchAll(STUTTER)) {
        const [whole, prefix] = match;
        const name = match[2];
        if (!leftByTheTitle(prefix, name)) {
            continue;
        }
        fixes.push({
            index: match.index,
            length: whole.length,
            before: whole,
            after: `${name[0]}-`,
            name,
        });
    }
    return fixes;
};

/** The row a set of fixes produces, spliced from the end so indices hold. */
export const rewriteRow = (english, fixes) => {
    let text = english;
    for (const fix of [...fixes].sort((a, b) => b.index - a.index)) {
        if (text.slice(fix.index, fix.index + fix.length) !== fix.before) {
            throw new Error(`${JSON.stringify(fix.before)} is not at ${fix.index}`);
        }
        text = text.slice(0, fix.index) + fix.after + text.slice(fix.index + fix.length);
    }
    return text;
};

/** The quotes and parentheses of a row, in the order they are written. */
const bracketsOf = (text) =>
    [...text].filter(character => "「」『』（）〈〉《》()".includes(character)).join("");

/**
 * What has to be true of the rewritten row, asked of the row rather than of
 * the rule that made it.
 *
 * A stutter fix swaps one letter for another, so the length is the length: any
 * other difference is a bug. The brackets are compared **in order** because 「」
 * and 」「 hold the same characters and only one of them is a speech, and the
 * leading indent is compared as bytes because the continuation indent is a
 * full-width space that belongs to the row.
 */
export const holds = (before, after, fixes) =>
    after.length === before.length
    && after !== before
    && !after.includes("\t")
    && after.startsWith(before.match(/^[\s　]*/)[0])
    && bracketsOf(after) === bracketsOf(before)
    && stutterFixes(after).length === 0
    && fixes.every(fix => after.includes(`${fix.after}${fix.name}-sama`));
