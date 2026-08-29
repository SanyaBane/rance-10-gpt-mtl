# The scenes became the corpus

`en_grok`'s dialogue used to be 4891 JSON chunk files, one record per line, with
no speech around a line for anything to be wrong about. It is 5433 scene files
now, and the build reads them. This is what that cost, what is left of it, and
the traps that are cheap to repeat.

`modules/SceneFile.js` is the format, `modules/Corpus.js` is how a language is
read, `docs/speech-gaps.md` is the report that found what the move made visible.

## Why the scenes are strictly better, measured

Every corpus line number is in the scene tree, none of them twice, and the
English agreed on all of them the day the tree was committed:

| | chunk files | scenes |
|---|---|---|
| files / size | 4891 / 76 MB | 5433 / 36 MB |
| unique line numbers | 269 617 | **269 677** |
| the same number, twice | 5679 records, resolved by last-wins | **impossible** — one message, one scene function |
| numbering | v1.00 plus a second folder for v1.04 | the game's own |
| the Japanese | retyped by a model, 5081 disagree with the dump | the dump's, checked at every extraction |
| context | a number and two lines | the scene, the speaker, the portrait's state, the row boundaries |

Rendering the patch from either gives the same 269 617 lines: the Japanese
column only ever fed the name repairs, and those were baked into the text years
ago.

## Done

| commit | |
|---|---|
| `5cbdf91c` | the scene tree committed under `text_languages/en_grok/scenes/` |
| `afbaa068` | the guard that data-only commit tripped |
| `1992f5c8` | `develop` merged — 30 commits, no conflicts |
| `41592050` | develop's 304 refined lines and 438 renamed speakers carried into the scenes |
| `3e8bce87` | a fifth column: what the portrait is doing |
| `bab4bbed`, `4078614f`, `37be0edb` | `scripts/find_speech_gaps.js` and two rounds of correcting it |
| `eedf7563` | thirteen lines given back the bubble they belong to |
| `1581d8e4` | **the build reads the scenes** |
| `12cdff1c`, `ffc2660c` | the message window measured: it clips at 36, the backlog at 30.8 |
| five passes | the brackets, 4972 speeches — [docs/speech-brackets.md](speech-brackets.md) |
| `42168774` | a re-extraction carries the scenes forward instead of the draft |
| `15c8d53c` | the four reports read the scenes, and say which file to open |
| `b05c7bcf` | the chunk shape dropped from the build, the chunk-era translator deleted |
| `1e6c56c5` | **`gpt_outputs*/` deleted** — 4891 files, 76 MB, in git and nowhere else |
| `2d1baad7` | the v1.00 mapping called on purpose rather than paid for every run |
| `caf5acc0`, `d4dfe066` | **the row layout baked** — 4535 speeches, 19826 rows, 2649 files |

The reader's rule, in one line: **the speech decides and the row is written.** A
speech with no English is left out whole, so its rows play in Japanese; every row
of a speech that has some is written, blanks included, because the draft answers
a whole utterance on its first row and skipping the remainder would put English
on one row of a bubble and Japanese on the next.

## Left to do, in the order worth doing it

### 1. Carry the format to `develop`

The one thing that actually blocks future work. `develop` is still in the chunk
format, and now that the folders are gone from this branch a "Refine
translation" commit there cannot be merged here at all. Worse, and silently:
**develop still spells the player's name literally on all 1504 lines where this
branch restored `＜エール＞`**, and nothing in a merge
would catch a commit putting one back — `SceneAcceptance` guards a translation
coming in, not a corpus merge.

### 2. The text repairs the report found

| | | |
|---|---|---|
| speeches too long for any layout | 839 | shorten by meaning, by hand: `find_speech_gaps --class=overflow` is the list |
| ~~a 「 or 」 lost at a row boundary~~ | ~~3609~~ | **done** — 4972 speeches over five passes, [docs/speech-brackets.md](speech-brackets.md) |
| a bracket on the wrong row of the right speech | 191 | 100 row patterns; the 21 largest are the game's own marks a row too early, the rest a decision about which words are quoted |
| shifted English | 19 | by hand; 12 are one scene, `031792.tsv`, a letter whose English is fifteen rows of dots and wants translating |
| a whole shifted run no report sees | 23 rows | `033355.tsv`, held out of the bracket rules by `SHIFTED_RUNS` |
| untranslated scenario notes | 61 rows | decide whether they are wanted at all |

The first is what the bake leaves behind. It laid 4535 speeches into the rows
the bytecode gave them and took `overflow` from 3346 to 839 and `blank` from
1331 to 2; what is left in `overflow` holds more English than its rows can draw
whatever the layout, so the edit is fewer words rather than a different
division. The brackets deliberately went **before** the bake: they are written
glued to a word, so a bake carries them along, and doing them first meant it
started from bubbles that close.

What the bake taught, and it generalises past this migration: **a pass that
rewrites what is not broken cannot be reviewed.** Asked of every speech rather
than of the report's findings, it offered 62 261 speeches across 141 941 rows,
almost all of it turning one good division into another, because the layout
minimises the widest row and hand-made divisions rarely do. The work list has to
be somebody's finding.

### Left open on purpose

- `index.tsv` lives only under `build/`. The scene driver reads it; decide
  whether it belongs beside the committed scenes.
- `en_opus` still stands with an empty `scenes/`. Whether the retranslation stays
  a second language layered over `en_grok` or the two collapse into one is
  undecided, and nothing here forces it.
- The wrap budget is **settled at 31.2** and should not be reopened without a new
  measurement: `docs/message-window.md` has why.

## The traps, which are one trap

Four corrections were needed to `find_speech_gaps` before its numbers meant
anything, and every one of them was the same mistake in a different costume:
**it asked what a cell held instead of what the row was for.**

- A row the game left blank owes a translation nothing. 954 speeches.
- A cell holding only the continuation indent is a blank row, not a translation
  and not padding.
- `………………・` answered with `..............・` is a translation, not padding:
  U+30FB is a letter by codepoint and a dot by eye. That middle dot has now cost
  this repository a finding in two different reports.
- And the expensive one, which was the opposite kind: **whether a speech fits its
  window was a flag inside one class rather than a question of its own**, so
  4193 speeches with every row filled were never asked. No run of the report
  could show that — a check that is never reached reports nothing, and nothing
  looks like a clean report. It took a screenshot from the game.

None of those heuristics reaches a build. In a report a false positive costs a
look; in the patch it costs a line of dialogue.

## How to verify anything in this migration

Never by reading the patch. Render, then compare the effective mapping against a
copy taken before the change, and read the built `.ain` back for anything that
matters:

```
node scripts/regenerate_aai_txt.js && node scripts/effective_map.js save before
... the edit ...
node scripts/regenerate_aai_txt.js && node scripts/effective_map.js save after
node scripts/effective_map.js diff before after

node scripts/ain.js --out=build/scratch     # never into the game while testing
alice ain dump -t -o built.txt build/scratch/Rance10.ain
```

`scripts/effective_map.js` is that comparison, and the number to hold the answer
against is the count of rows the edit touched. Equal is the answer; a number
that went away or appeared is a finding whichever direction it went. Two passes
have come out one short of their own edit count and both times the missing row
was one the build renders identically either way -- 1622 rows edited against
1620 changed for the brackets, 19 826 against 19 825 for the bake, where
`m[252383]` is folded by `wrapAt` and the change fell inside the fold.

The comparison is per line number against the *last* assignment naming it. The
patch grew 5676 lines shorter when the reader landed, because reading by number
drops the duplicate assignments the overlapping chunks used to write, and a file
diff would have called that 5676 regressions.
