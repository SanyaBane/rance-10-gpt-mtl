/**
 * Folding a generated paragraph into lines somebody can read in Notepad.
 *
 * The pages this repository hands to a player -- a release folder's README.md
 * and the one in custom_mods beside it -- are read as often in a text editor
 * with no word wrap as on a page that reflows. Every line of prose written by
 * hand here is folded at 80 columns for that reason, and a generated one has to
 * be folded by something: a feature's summary and the sentence about its switch
 * come to some 300 characters, which is one line off the right of the screen.
 *
 * Not for anything the game reads. A dialogue line is folded to a pixel width
 * in the game's own font, which is modules/GameFont.js and a different question
 * entirely -- this counts characters, because a README is read in whatever font
 * the reader has.
 *
 * A word longer than the width is left over the edge rather than broken: the
 * long words here are `custom_mods\rank_up_keep_progress_on` and the like, and
 * a path broken across two lines is a path nobody can copy.
 */

/** What a hand-folded line in these pages is folded at. */
export const WIDTH = 80;

/**
 * One paragraph as an array of lines. `indent` goes in front of the first line
 * and `hanging` in front of the rest, which is what a bullet is: "- " then two
 * spaces, so the second line sits under the first word rather than under the
 * dash.
 */
export const wrap = (text, indent = "", hanging = indent, width = WIDTH) => {
    const lines = [];
    let line = "";
    for (const word of text.split(/\s+/).filter(Boolean)) {
        const prefix = lines.length === 0 ? indent : hanging;
        const next = line ? `${line} ${word}` : word;
        if (line && (prefix + next).length > width) {
            lines.push(prefix + line);
            line = word;
        } else {
            line = next;
        }
    }
    return line ? [...lines, (lines.length === 0 ? indent : hanging) + line] : lines;
};
