# The indent a row of a bubble begins with

```
node scripts/fix_speech_indent.js                      # the report, nothing written
node scripts/fix_speech_indent.js --scene=031581.tsv   # one scene, all of it
node scripts/fix_speech_indent.js --bucket=ascii-space # one bucket, all of it
node scripts/fix_speech_indent.js --limit=20
node scripts/fix_speech_indent.js --write
```

The game indents the rows of a speech after the first, so the text sits under
the `「` that opened the quote rather than flush against the window edge:

```
89751  「以前にカオスとは会ったことがあるので、  「Having crossed paths with Chaos before, I did sometimes
89752  　いずれはこんな日が……                    wonder if such a reunion
89753  　と思ったこともありましたが」             might eventually happen...」
```

Three rows of one bubble, two of which the game starts a character in and the
English did not. The player sees a paragraph whose second and third lines hang
out to the left of the first, and the backlog replays it that way.

`modules/SpeechIndent.js` is the question. It reads
`text_languages/<lang>/scenes/` and nothing else -- no alice-tools, no
`GAME_DIR`, no dump -- and the dry run is the report: it prints every row it
would change with the Japanese beside it, so the listing is what gets read
rather than the diff afterwards.

**2926 rows in 515 scene files** were that shape, and are not any more.

## It is not the wrap

A row too wide for the window is folded at render time -- `wrapAt` in
`modules/TextNormalization.js` -- and the line it folds onto carries no indent
because the game's own row does not have one there either. That is the build
deciding where to break a row it was handed. This is the other thing: the indent
the corpus is missing on rows that are already the rows the bytecode gave them,
written into the scene file the way every other repair to a baked corpus is.
`docs/baked-name-repairs.md` is why it is written in rather than applied on the
way out -- **a file reads the way a build of it reads**.

## The question is asked of the row

Which is the opposite of `modules/SpeechBrackets.js`, and the difference is
about the mark rather than about the report. A bracket belongs to the utterance:
`「` on one row and `」` three rows later are one pair, and asked row by row both
rows are findings and both are wrong. An indent belongs to the row it is drawn
on. The game's own row states where its text starts, and the English on that row
answers the same statement with nothing around it to be wrong about.

That is also what leaves no judgement in the class. The Japanese column of a
scene file is the game's own, held against the dump at every extraction
(`docs/scene-integrity.md`), so "this row starts one full-width space in" is a
fact read off the game rather than a rule somebody wrote about English. It is
the one pass here whose findings did not need triaging.

## Two buckets

**`missing`** -- 2883 rows, the English simply flush where the game is indented.

**`ascii-space`** -- 43 rows answer `　` with `" "`. That draws a third of the
width, and on the rows long enough to be wrapped it does not draw at all: `wrap`
keeps `^　*` on purpose and splits the rest on whitespace, so a leading ASCII
space is dropped exactly where it was standing in for an indent. Same fault,
different character, same fix.

**A leading tab is neither**, and is never touched. The scene format escapes tabs
because 2929 of the game's messages hold one, and a pass that normalised
`[\s　]+` has already eaten fifteen of them once -- `docs/speech-brackets.md` is
that lesson and CLAUDE.md states it as a rule. No row in the class begins with a
tab today; the guard is there for the next translation rather than for this one,
and a row that does begin with one is named and left.

## The whole run, not one space

228 rows begin with two or more full-width spaces. Six are the game's own --
`　　＜ぺちーん＞` is a sound effect positioned across the window -- and the rest
are the scenario documents, where the indent is an outline level. Mirroring the
run keeps the English row starting where the Japanese row starts, which is what
those spaces say; mirroring a single space would move the sound effect left and
leave the report with a class it could never close.

## What it leaves alone

**A row the game says nothing on.** 954 speeches hold one -- a beat inside a
bubble, or text positioned across the screen with runs of full-width spaces --
and a translation owes it nothing, an indent included. One row in the corpus is
that shape with English on it anyway: `m[134063]`, `　` answered with `.`, which
is a shifted run's padding and `modules/SpeechGaps.js`'s finding rather than
this one's. Which is the same rule that report learned the expensive way --
**ask what the row is for, not what the cell holds**.

**An indent the English carries and the Japanese does not.** 141 rows, and most
of them are this repository's own doing: `layOutSpeech` indents every
continuation of a speech that opens with a bracket, whatever the Japanese under
it says, and `scripts/bake_speech_rows.js` writes that into the corpus. Taking
those off would be undoing the layout rather than repairing the text, so the
pass runs one way only. The report counts them and says so, because a report
that only names what it changes reads as though the rest had been looked at and
found right.

**A leading ASCII space on a row whose Japanese has no indent.** 75 rows. A
stray character rather than an indent written wrong, and nothing in the Japanese
says what should be there instead.

## An indent is a character wide

So the third rule `modules/SpeechBrackets.js` carries applies here too: a speech
that fits its window today can stop fitting once the indent is back. **43 did**
-- the widest row of each was within a full-width space of the fold -- and they
are named at the end of the run rather than quietly accepted.

20 of the 43 are in `t…` scenario documents the game never draws, which is
nobody's overflow. The other 23 moved `modules/SpeechGaps.js`'s `overflow` class
from 750 to 773 and its `fold` class from 736 to 752.

Worth being clear about what that number is. The overflow was always the game's:
it draws those rows a character further right than the English did, so what
changed is that the corpus stopped hiding it. What takes it out is a layout
rather than an edit to this pass -- `scripts/bake_speech_rows.js` lays the same
words back into the same rows, and it fits 38 of the 43.

## What was checked

The corpus is baked, so an edit to it is checked against the built patch rather
than against the diff (CLAUDE.md, "Verify against the built `.ain`"):

```
node scripts/regenerate_aai_txt.js && node scripts/effective_map.js save before
# ... the pass runs ...
node scripts/regenerate_aai_txt.js && node scripts/effective_map.js save after
node scripts/effective_map.js diff before after
```

**2926 changed, 0 gone, 0 added**, against 2926 rows edited. Equal is the answer,
and it is the check a diff of the patch cannot give.

Three more held:

- `node scripts/check_scenes.js` -- 13 findings, the same 13 as before the pass,
  none of them in a row it touched. The four columns that are the game's did not
  move.
- the name-repair invariant, `normalizeNames` over the corpus: 37 rows before,
  37 rows after. `docs/baked-name-repairs.md`.
- every line of the diff read back as a diff: 2926 removed and 2926 added, each
  one the same five columns with the English's leading ASCII spaces replaced by
  the Japanese's own run of full-width spaces, and nothing else on any row.
