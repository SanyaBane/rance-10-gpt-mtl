# How wide a line is

Text in this game does not wrap, anywhere. **The panels do not clip either** --
a caption too wide for its panel runs out over the frame, over the buttons and
off the screen edge -- so every place that has to fit, the synopsis rows and the
`.pactex` layouts, measures first and warns. What follows is what that
measurement should be, and why the one the repository started with was wrong.

The message window is the exception and was measured separately: it clips, at
about 38.6 full-width characters, and the backlog clips earlier, at 35.4, which
is the one a translation is actually held to. `docs/message-window.md` has the
rulers that settled both. Where a panel loses the
end of a caption off the screen, the window loses it silently at the frame --
which is why the two are worth keeping apart in one's head.

## Meiryo is not the game's font, and the error is not a scale

`getTextWidth` in `modules/TextNormalization.js` measures with a canvas at
`14px Meiryo`. The game ships its own font, `Rance10Font.fnl` in the game
directory, and its proportions are not Meiryo's. In Meiryo a capital `M` is
0.83 of a full-width glyph; in the game's font it is **0.98** -- nearly as wide
as a kanji. Narrow letters go the other way.

So the error cannot be fixed with one multiplier. Measured against the synopsis
panel, whose box is twenty full-width characters:

| | the game's font | Meiryo |
|---|---|---|
| `The Monster Army finally overruns them` | **115%** | 99% |
| `Leazas pushes the shaken Monster Army` | **116%** | 100% |
| forty-eight `i` | 85% | 61% |

Meiryo understates capital-heavy English by about a sixth, which is exactly the
English that fills a panel: every Monster Army, Free Cities and Demon King line.
Of the 4458 synopsis captions, `getTextWidth` reports **none** too wide for the
panel and the real font makes it **around 570**.

## What is in Rance10Font.fnl

133 MB, magic `FNA\0`, a glyph atlas with the advances in the index. The index
is what we want; the bitmaps are not.

```
0x00  "FNA\0"
0x08  u32  size of the glyph data
0x0c  u32  where it starts
0x10  u32  2       faces
0x14  u32  33      the first character code, '!'
0x1c  u32  14
0x20  u32  8994    glyphs in a block
0x26        the first block
```

A block is 8994 records of `{u32 offset, u32 size, u16 advance}`, each offset
the previous one plus its size, then a short header and the next block. There
are **41** blocks: 33 of one face and 8 of another, one per size, the face
telling itself apart by the ratio above -- 0.97 in the first, 0.84 in the
second.

Two things confirm the reading. The glyphs run in code order from `!`, so the
ten digits land together as ten identical advances, which they do. And the
commonest advance in a block is shared by 8819 of its 8994 glyphs -- the CJK
ones, all one em wide.

## The two numbers that are not in the file

A glyph advance is not the whole width. The layout charges a tracking per
character on top (`字間隔`, 4 at `フォントサイズ` 48 in
`SceneSummary.pactex.x`), and the space has no glyph at all -- the table starts
at `!`.

Both were measured in the game, by putting rulers into one synopsis event and
reading where they crossed the edge of the box. In the units of the first block,
where a full-width glyph is 45:

| | measured | as a fraction of a full-width glyph |
|---|---|---|
| tracking | 3.05 … 5.80 | 0.106 |
| space | 13.25 … 21.50 | 0.406 |

The layout's own `字間隔 = 4` at font 48 is 3.75 in these units, which lands
inside the measured range -- the two agree without having been fitted to each
other.

Eleven readings over two screenshots leave a range rather than a point, and it
does not close by measuring harder: the readings that separate tracking from
space are the same readings either way. What the range does not move is the
part that gets used.

## What to hold a line to

- **Thirty characters or fewer always fits**, at every point in the measured
  range. That is the safe rule when there is no measurement to hand.
- **Thirty-three** is the edge for ordinary prose; thirty-four crosses.
- Neither is a substitute for measuring the actual string. The longest caption
  that fits is 37 characters, and `The Monster Army finally overruns them` does
  not fit at 37.

## Measuring it again

The method, for when a panel other than the synopsis needs settling.

Put rulers in place of real text, build to a scratch directory, and read the
screenshot. Every ruler ends in a `|` after a known number of characters, so the
reading is "which pipe is left of the edge" rather than counting glyphs off a
screenshot, which is worth a character or two either way.

What separates the two unknowns is choosing rulers whose character counts differ
wildly at the same width: twenty full-width glyphs fill the same box as about
fifty-seven `i`, and the tracking is most of what decides which. Then a ruler
that is half spaces -- `a a a a …` -- leaves the space as the only thing still
unknown.

`local/` carried the throwaway scripts for the synopsis round of this and is
gitignored; nothing here depends on them.

## Where the table lives

A build never reads `GAME_DIR` -- that is what makes `--out` safe (`CLAUDE.md`,
and `outputDir` in `modules/AliceTools.js`). So a width check cannot open
`Rance10Font.fnl` where it sits. The advances are extracted once, into a small
committed table, the way `game/extracted/` already holds the two tables a build
reads back out of the `.ain`:

```
npm run regenerate-font-widths      # game/extracted/font_advances.v1.04.tsv
```

`scripts/extract_font_widths.js` reads the font out of `GAME_DIR` -- no build
does, and nothing writes to it, so the copy there is the one the game shipped --
and writes the printable ASCII, plus one row for a full-width glyph standing for
everything that is not ASCII. Ninety-five rows rather than 8994: past ASCII the
glyphs run in the game's own character order rather than Unicode's, and 8819 of
them share the one advance anyway, so naming them individually would mean
guessing at an encoding to learn nothing. Two kilobytes against the font's
133 MB.

`modules/GameFont.js` is what reads it. `gameTextWidth(text)` is the measure,
and the two numbers that are not in the file are named constants at the top of
it -- `TRACKING = 4.75` and `SPACE = 18.25`, the middle of the ranges above.
Compare a width against a string of full-width characters rather than against a
number, the way `modules/SummaryLines.js` compares against `LONGEST_LINE`, and
the units never have to be thought about.

`getTextWidth` in `modules/TextNormalization.js` stays where it is: the dialogue
wrapping hangs on it, and rewriting that wrap would rewrite the whole `en_grok`
patch. The dialogue window itself is settled now — 24 full-width characters by
three rows, and 31 by two for the `●…Ｅ` commands' window — in
`docs/message-window.md`, along with what that wrap costs: held against the
backlog's measured edge, 2279 of the 10 576 messages a build folds would have
been drawn whole, and folding on `gameTextWidth` instead would take 2280 of
those folds away without putting a row past that edge.

One thing from there that applies to any panel: **the tracking is per layout.**
`TRACKING` here is the synopsis panel's `字間隔 4` at font 48. The message window
says `文字間隔 -2` at font 57, which is negative, and measuring it with the
default overstates every line by an eighth of a character. `trackingFor` exists
for exactly that.

That is worth more than a convenience, because it is the whole of one puzzle
this method left behind. Four rulers -- full-width digits, English, dots and `i`
-- stopped at one place in the backlog and disagreed by 27% about how wide that
place was, which read as `gameTextWidth` not describing a window across
character classes at all. They had been quoted in the ordinary window's tracking
while standing in the backlog's; read in the right one they agree to about 5%,
and `docs/message-window.md` has the table.

**About 5%, and not to the character.** A later run says which way the remainder
goes: at one edge a row of dots measuring 35.60 is cut where a row of `M`
measuring 35.61 is drawn whole, so wide glyphs are overstated a little and
narrow ones understated. English falls between, about 1.4% narrow -- the box
that draws 36 full-width digits stops English at 35.4. So a panel settled by a
ruler wants the ruler written in the class the panel actually carries, and a
couple of percent of margin on top of the reading.
