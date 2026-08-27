# Where a speech and its English came apart

```
node scripts/find_speech_gaps.js                    # the report
node scripts/find_speech_gaps.js --class=shifted    # one class, all of it
node scripts/find_speech_gaps.js --overflowing      # only what does not fit the window
```

Two things kept turning up while playing the patch. A bubble with a gap in the
middle of it -- a line, an empty row, another line. And, rarer and worse, a
narrator saying something that belongs to the character after them. Neither had
a report; both were found by somebody noticing, which for 269677 lines is not a
method.

`modules/SpeechGaps.js` is the method. It reads `text_languages/<lang>/scenes/`
and nothing else -- no alice-tools, no `GAME_DIR`, no corpus -- and asks of every
speech whether the English in its rows belongs to those rows.

## Why this could not be asked before

A corpus record is a line number, a Japanese line and an English one. Nothing in
it says which speech the line is part of, which row of that speech it is, or who
is speaking, so there was no shape for the English to be wrong against. The
alignment check in [corpus-alignment.md](corpus-alignment.md) reads 0 and is not
wrong: it compares a record's Japanese against the game's dump, and in every
case here the Japanese is right. What moved is the English.

A scene file has the shape. The Japanese comes from the game's own dump, the
speaker from the bytecode, and the row boundaries are the `MSG` operands, so a
row's English can be held against the row it sits on.

## The four classes

Counted over `en_grok` as of the pass that wrote this. A speech is reported once,
under the worst class it answers, so the counts add up to speeches rather than to
signals.

| class | speeches | what it is |
|---|---|---|
| `shifted` | 18 | the English on a row belongs to a different row |
| `blank` | 2502 | English on some rows of a speech and not others |
| `bracket` | 3693 | the speech opens 「 or closes 」 in Japanese and not in English |
| `untranslated` | 36 | no English anywhere in the speech |

**shifted** is the one worth reading first and the one that is not cosmetic. Two
signals: a row whose Japanese is a thought （…） answered with speech 「…」 or the
reverse, and a row whose English is nothing but dots over real Japanese, which is
the padding a run of shifted rows ends with. `031792.tsv` has both -- the
narrator's third row carries Tilde's thought, her thought carries the line after
it, and the run ends on `............`.

**blank** is mostly the fork's own way of translating: it answered a whole
utterance on the utterance's first row and left the rest empty, which is the same
shape `modules/SceneTranslations.js` writes on purpose. Most of it is harmless.
The part that is not: **592 of the 2502 already draw in more lines than their
window allows**, because the whole speech sits in row one and the build folds it.
Laying those out again with `modules/SpeechRows.js` fixes 491; the remaining 101
are too long for their rows whatever the layout and want shortening by meaning,
the way the synopsis panel's overlong captions do.

**bracket** is the largest class and the least urgent. The text is on its own
row; a quotation mark fell off the end of one row or the start of the next.

**untranslated** is not a fault to fix but a decision to take: a row with no
English is left unnamed by the build, and an unnamed row plays in Japanese.

## What it cannot see

A shift whose English is plausible where it landed. Both signals need the wrong
row to *look* wrong -- a bracket on the wrong side, a row of dots -- and a
misplaced sentence that is neither is invisible here. So `shifted`'s count is a
floor and not a measurement, and the report is worth re-running after any pass
that moves English between rows.

## Two traps it was written into

Both were false positives in the first run, and both are the same mistake:
reading a character for what it looks like rather than what it is.

**A cell holding nothing but the continuation indent is a blank row.** `　` is a
full-width space; it draws as an empty line, it reads as a dot to a
padding-detector, and `assemblePatch` would take it for a translation -- three
wrong answers to one whitespace. The first run called those rows `shifted` where
it saw them at all and counted the rest as filled: 95 `shifted` and 1711 `blank`,
against 18 and 2502 once a row's English counted only when it held something
besides whitespace. The 700-odd that appeared were speeches with a hole in them
that no class had been reporting.

**The katakana middle dot is a letter by codepoint and a dot by eye.** `・` sits
inside the katakana block, so a range written as `[぀-ヿ]` says a row of
`………………・` is real Japanese and its English of `..............・` is padding.
It is a translation. The class now asks for kana or kanji proper and leaves
U+30FB out.
