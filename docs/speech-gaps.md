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

## The five classes

Counted over `en_grok` at `WRAP_SAFETY_MARGIN` 0.95, before and after the
bracket passes [docs/speech-brackets.md](speech-brackets.md) describes. A speech
is reported once, under the worst class it answers, so the counts add up to
speeches rather than to signals -- and because it is reported once, mending one
class moves speeches into another rather than straight out of the report.
Raising the budget from 0.9 to 0.95 once took `overflow` from 4469 to 3348, and
90 of those 1121 speeches came back under `blank` and `bracket` for exactly that
reason.

| class | before | after | what it is |
|---|---|---|---|
| `shifted` | 18 | 19 | the English on a row belongs to a different row |
| `overflow` | 3347 | 3346 | the speech draws in more lines than its window has |
| `blank` | 1333 | 1331 | the game says something on a row and the English does not |
| `bracket` | 3491 | 65 | the speech opens 「 or closes 」 in Japanese and not in English |
| `untranslated` | 25 | 25 | no English anywhere in the speech |

`bracket` emptied without `overflow` filling, which is the check worth making
after any pass like that: the speeches left the report rather than moving to a
worse class. And `shifted` went **up** by one, which is a finding rather than a
regression -- see below.

**shifted** is the one worth reading first and the one that is not cosmetic. Two
signals: a row whose Japanese is a thought （…） answered with speech 「…」 or the
reverse, and a row whose English is nothing but dots over real Japanese, which is
the padding a run of shifted rows ends with. `031792.tsv` has both -- the
narrator's third row carries Tilde's thought, her thought carries the line after
it, and the run ends on `............`.

There is a third signal, and it lives in the bracket report rather than here: a
shifted run cuts every `「…」` in half, so a speech starts with the closer of the
one before it and ends with the opener of the one after. `033355.tsv`
`m[230508]`-`m[230530]` is 23 shifted rows that neither signal above can see and
that shape found at once. The nineteenth finding here arrived the other way
round -- `033503.tsv` `m[247236]` was padded with `「............」`, its Japanese
has no brackets, the bracket pass took them off, and the dots signal could
finally fire. Both signals need the wrong row to *look* wrong, and two brackets
the draft invented were enough to hide one.

**overflow** is the one a player cannot miss: the speech is drawn in more lines
than its window has, so the end of it runs off the box. `modules/SpeechRows.js`
takes 2507 of them back by laying the same words out across the rows the
bytecode gives them -- `ネルソン／キャライベントＣ` is three rows drawn in five,
and balanced across those three it fits. The other 839 hold more English than
their rows can draw whatever the layout, and want shortening by meaning, the way
the synopsis panel's overlong captions do.

**blank** is the fork's own way of translating: it answered a whole utterance on
the utterance's first row and left the rest empty, which is the same shape
`modules/SceneTranslations.js` writes on purpose. What is in this class fits the
window as it stands, so it is a bubble with a gap in it rather than one that runs
off. 93 of them have that gap in the middle, where a player sees it; 47 more sit
in `overflow`, which is worse in both ways at once.

**bracket** used to be the largest class and is now the smallest that is a
fault. The text is on its own row; a quotation mark fell off the end of one row
or the start of the next. It is a floor rather than a measurement, because a
speech that also runs off the window is reported as `overflow` and its missing
bracket never counted -- 3491 here against 5412 when every speech was asked.
Which is why the question moved to a report of its own:
[docs/speech-brackets.md](speech-brackets.md) is the six buckets, the rules that
decide four of them, and the post-condition that made writing them safe. 4972
speeches were mended there and 440 are left for somebody to read.

39 of the 65 here are among those 440. **The other 26 are a class that report
cannot see and this one catches by accident**, which is worth knowing in both
directions. It asks the speech, so `030380.tsv` `m[4033]` -- `「.....」` on the
first row and `Gufu` hanging outside the quote on the second, where the game
closes on the second -- has the brackets the Japanese has and passes. This
report tests the last character of the rows joined together, which is the last
row's, so it fails. Two reports disagreeing is how the class was found at all;
`docs/speech-brackets.md` has what it measures to.

**untranslated** is not a fault to fix but a decision to take: a row with no
English is left unnamed by the build, and an unnamed row plays in Japanese.

## What it cannot see

A shift whose English is plausible where it landed. Both signals need the wrong
row to *look* wrong -- a bracket on the wrong side, a row of dots -- and a
misplaced sentence that is neither is invisible here. So `shifted`'s count is a
floor and not a measurement, and the report is worth re-running after any pass
that moves English between rows.

## The one it did not ask about

The three traps below are false positives, and every one of them was found by
running the report. The costly mistake was the opposite kind, and no run of the
report could have shown it: **whether a speech fits its window was a flag on one
class rather than a question of its own.** Only speeches already suspect for
having a blank row were ever measured, so 4193 speeches with every row filled
and simply too much English in them were never asked about at all -- the report
was silent about `ネルソン／キャライベントＣ`, which draws in five lines where the
window has three, until a screenshot of it arrived.

A flag on a class answers the question for the members of that class. If the
question stands on its own -- and "does the player see the end of this line"
does -- it wants a class of its own.

## Three traps it was written into

All three were false positives, and all three are the same mistake: asking what
a cell holds instead of what the row is for.

**A row the game itself left blank owes a translation nothing.** 954 speeches
hold one -- a beat inside a bubble, or text positioned across the screen with
runs of full-width spaces, as `m[6638]` does with twenty of them under 「ふ」.
Read as gaps they made 954 speeches into findings that were not, and made the
layout look worse than it is: asked to fill rows the author left empty,
`layOutSpeech` could not fit 101 of the speeches it was then offered, where
asked to fill only the rows the game speaks on it could not fit one of them. A
layout that took those rows would pour a sentence into a pause and flatten the
screen positioning.

The two below are the same mistake about a character rather than a row.

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
