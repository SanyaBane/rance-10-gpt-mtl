# `jp` — the game's own Japanese

This folder holds no text. It is a text language the way the two beside it are,
but what it selects is the absence of a translation: `node scripts/ain.js
--text-lang=jp` builds `Rance10.ain` out of the game's own script with the
`features/` patches over it, and nothing else — no dialogue, no system strings,
no card or race names, no enemy status lines.

It exists so that a change to how the game *behaves* can be played, or tested,
without installing an English patch along with it. `text_language.js` beside
this file is what tells the build that, and `docs/text-languages.md` has the
rest.

Two things follow from there being no untranslated `archives/`:

- a Japanese build is one file. `Rance10EX.ex` and `Rance10Pact.afa` are only
  ever built with the English in them, so whatever the game folder holds is
  what stays — if the English patch was installed, those two are still English;
- with no features selected, the file this builds is the game's own
  `Rance10.ain`, byte for byte. That is the way back out of a modified `.ain`,
  and the reason a release folder skips this language when a build takes no
  features at all.
