/**
 * The game's own Japanese: no translation at all.
 *
 * A text language whose folder holds no text, because the text is already in
 * the .ain this repository patches. What it selects is the *absence* of the
 * English -- no rendered dialogue, no cherry-picked system strings, no card
 * names, no race names, no enemy status lines -- so what a build makes of it is
 * the game's own script with the features over it and nothing else.
 *
 * That is what it is for: playing, or testing, a change to how the game behaves
 * without taking a translation with it. With no features selected it is the
 * game's Rance10.ain unmodified, which is the way back out.
 *
 * Rance10EX.ex and Rance10Pact.afa have no such build. The tables under
 * archives/ are the game's data with the English written into them, and there
 * is no untranslated copy here to build from -- so a Japanese build is one
 * file, Rance10.ain, and the other two are whatever the game folder already
 * has.
 */
export default {
    summary: "the game's own Japanese, with the features and no translation",
    translated: false,
};
