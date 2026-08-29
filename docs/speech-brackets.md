# The brackets a speech opens and closes with

```
node scripts/find_speech_brackets.js                          # the report
node scripts/find_speech_brackets.js --scene=030521.tsv       # one scene, all of it
node scripts/find_speech_brackets.js --bucket=closing-lost    # one bucket, all of it
node scripts/fix_speech_brackets.js --bucket=closing-lost     # what the pass would write
node scripts/fix_speech_brackets.js --bucket=closing-lost --write
```

`「かっ……か、かかか、かない！？」` came back as `「W-wife!?` and the player saw a
bubble that never closed. The mirror happens too, and so does losing both, and
so does the opposite: 759 speeches closed `」` at the end of *every* row rather
than the last, which draws a closing quote in the middle of a bubble.

`modules/SpeechBrackets.js` is the question. It reads
`text_languages/<lang>/scenes/` and nothing else -- no alice-tools, no
`GAME_DIR`, no corpus.

## Why this is its own report

`modules/SpeechGaps.js` has had a `bracket` class since it was written, and it
was reading 3491. But a speech is reported there **once, under the worst class
it answers**, so a speech that also runs off the window is counted as `overflow`
and its missing bracket is invisible. 3491 was a floor rather than a
measurement; asking every speech found 5412.

That is the general shape of the thing: a report that files each finding once is
answering "what is the worst thing about this speech", and a question that
stands on its own -- as `overflow` had to be split out of `blank` for the same
reason -- wants a pass of its own over everything.

## Three rules it is built on

**A symbol is owed to the English literally only if it is a bracket.** `。！？、…`
all have to change on the way in, and `replaceUnicode` turns `…` into `...`
itself, so a check that asks for the Japanese character back reports the whole
game and buries what matters. Three pairs are owed -- `「」`, `『』`, `（）` -- and
`（` is owed as either `（` or `(`, which is what `swapsThoughtAndSpeech` in
`SpeechGaps` already reads.

`〈〉《》【】` are deliberately out: nothing in the draft loses one, and accepting
`<` `>` `[` `]` as their English forms makes a finding of `＜エール＞` and of
every bracketed aside. `♪ ☆ 〜` are out for the opposite reason -- they are not
paired, so there is no boundary for them to fall off, and `〜` counted against
the `ー` the draft also writes as `~` is 1482 speeches of noise.

**The question is asked of the speech, not of the row.** `m[12754]` and
`m[12755]` are one speech with `「` on the first row and `」` on the second; asked
row by row both are findings and both are wrong. A row the game itself left
blank is not part of the question either -- 954 speeches hold one, and it owes a
translation nothing.

**A bracket is a character wide.** `」` is +1 on a row that may already sit at
the edge of the window, so the fix is measured as well as made. Four speeches
that fit before the pass do not after it, and the report names them rather than
accepting them quietly; three of the four are English packed into two rows of
three with the third left empty, which is `layOutSpeech`'s to redistribute when
the row layout is baked.

## The six buckets

Counted over `en_grok` at `2aff37041`, before the passes below.

| bucket | speeches | the shape | |
|---|---|---|---|
| `closing-lost` | 2194 | `「」` → `「` | a rule decides it |
| `opening-lost` | 823 | `「」` → `」` | a rule decides it |
| `both-lost` | 654 | `「」` → *(none)* | a rule decides it |
| `straight-quotes` | 21 | `「」` → `""` | a convention decides it |
| `extra` | 1440 | `「」` → `「」」` | a rule decides most of it |
| `other` | 280 | anything else | somebody reads it |

The first three are decidable without reading the line: the English shape is the
Japanese one with a bracket taken off an end, so putting it back is the only
edit that makes the two agree. `extra` and `straight-quotes` are rules rather
than deductions, and what makes them safe is not the rule but the post-condition
below.

## Where a fix is written

On the English of a row, **glued to a word**: the opener onto the first row that
has English, the closer onto the last. Glued rather than placed, because the row
layout is about to be baked into the `.tsv` and a bake moves words between the
rows of a speech -- a bracket stuck to a word travels with the word, and one
written into a row of its own does not.

The continuation indent in front of an opener comes from **the game's own row**
and not from the English cell. 862 of the rows that took an opener carried a `　`
on a row the game does not indent, and `　「` would draw a full-width space and
then the bracket, which is a row the game never writes.

`extra` is the same rule read backwards, per row: **a row may carry a bracket at
an end only where the game's own row carries one there**, asked of that row's own
Japanese and never of its neighbours. It leaves the middle of a row alone, so a
draft that put `（…）` inside a sentence the game did not fails the post-condition
and is reported rather than rewritten -- which is the right answer, because that
one is a choice about English rather than a bracket that fell off.

## The post-condition, which is the whole of why this is safe

`verifyFix` asks **the rows the fix produced**, never the rule that made it, and
`applyBracketFix` and the check read the speech back through the same `textsOf`.
A post-condition read through a second implementation of "what does this speech
say" is a post-condition about the second implementation.

Three conditions, and **counting the symbols is none of them**: `「」` and `」「`
hold the same two characters and only one of them is a speech, and seven
speeches in `other` are the second. So the shape is compared *in order*, as a
string, which subsumes any tally.

1. the brackets, in order, are the Japanese's
2. the speech with its brackets and its spacing taken out is what it was
3. no row the fix touched was left empty -- `assemblePatch` reads a blank cell as
   "not translated" and the row plays in Japanese

A speech that fails all this is left exactly as it was and marked `!!` in the
report. So is every speech inside a `SHIFTED_RUN`.

### A tab is content, and the check nearly said otherwise

The first `extra` pass called `trim()` on the cell. `033734.tsv` writes its
scenario notes with two tabs at the start of every row -- `SceneFile.js` escapes
them, because a raw one would move every column after it -- and `trim()` took
them off 15 rows that had no bracket to remove at all. Condition 2 said nothing,
because it was collapsing `[\s　]+` on both sides of the comparison and a tab is
`\s`. **A check that normalises away the thing being lost is not a check.** Both
halves now name the two characters they mean, an ASCII space and a full-width
one.

It was found by the effective map and by nothing else: the pass edited 1622 rows
and the map changed 1620, because the build discards those leading tabs anyway.
The diff of the patch would have agreed with itself.

## What the passes did

4972 speeches, 5634 rows, one bucket per commit.

| bucket | speeches | rows | what moved |
|---|---|---|---|
| `closing-lost` | 2192 | 2192 | 2185 `」`, 5 `）`, 2 `』` in |
| `opening-lost` | 823 | 823 | 823 `「` in, 779 stray indents out |
| `both-lost` | 653 | 988 | 569 `「」`, 77 `『』`, 7 `（）` in |
| `extra` | 1283 | 1589 | 1283 `」`, 188 `「`, 94 `）`, 54 `)`, 46 `（`, 33 `(`, 1 `』` out |
| `straight-quotes` | 21 | 42 | 74 `"` out, 37 `「` and 37 `」` in |

91 of the `both-lost` speeches were later found to have wrapped an inner bracket
and were reverted -- see the last section -- so the pass stands at 562.

Each was verified against the **effective map** -- every number against the last
assignment naming it, which is what alice-tools applies -- and never against the
diff of the patch. 271541 assignments before and after every pass, the changed
count equal to the rows edited, none gone and none added.

The report predicted 4972 of the 5412 were fixable before any of it ran, and
4972 is what the five passes wrote.

## What is left

531 speeches, none of which a rule decides -- 440 before the 91 of the last
section were reverted and reported rather than wrapped.

- **157 in `extra`.** 28 of them put `（…）` in the middle of a line the game does
  not, which is the shape the rule refuses on purpose.
- **280 in `other`.** The head of it is `「『』」` → `「」`, 88 speeches where the
  inner `『』` dissolved -- sometimes into `'…'`, sometimes into indirect speech.
- **91 in `both-lost`, marked internal**, whose bracket is an emphasis or a title
  inside the speech rather than at its ends -- the last section.
- **3 inside a shifted run**, below.
- 4 speeches the closing bracket pushed past their window.

## What it cannot see

**A bracket on the wrong row of the right speech.** The question is asked of the
speech, which is what makes `m[12754]` / `m[12755]` one finding instead of two
wrong ones -- and the price is that a mark in the wrong place inside a speech
whose brackets are otherwise the Japanese's reads as correct. `030380.tsv`
`m[4033]` is `「........................」` on the first row and `Gufu` on the
second, where the game opens on the first and closes on the second: the shape
is `「」` → `「」` and the player sees a word hanging outside the quote.

It was found by two reports disagreeing. `SpeechGaps` tests the last character
of a speech's rows joined together, which is the last *row's*, so it flags these
where this report does not -- 26 of its 65 remaining `bracket` findings are of
this kind and of no other.

Measured the same way the rest of this is: over the 75841 multi-row speeches
whose every spoken row has English -- the ones where a row of English answers a
row of Japanese at all, so the question means something -- **399 carry a bracket
at the end of a row the game does not bracket there, or lack one it does.** 208
are already among the 440 above; 191 are new.

They are not one class and no single rule sweeps them: 191 speeches in 100
distinct row patterns.

| row pattern | speeches | |
|---|---|---|
| `.. ..` → `O. .C` | 45 | the game quotes nothing and the draft quoted the whole thing |
| `O. .C` → `OC ..` | 21 | the game's own marks, the closer a row too early |
| `.. .. ..` → `O. .. .C` | 10 | the same invention over three rows |
| the other 97 patterns | 115 | |

The second kind is mechanical -- the speech has the right marks and the game
says which row each belongs on. The first is not: `030504.tsv` `m[11607]` wraps
a whole sentence of narration in `『』` where the game brackets only the remark
inside it, so the fix is a decision about which words are quoted rather than a
mark to move.

The numbers here were measured with the 91 of the last section still wrapped, so
`m[11607]` counts among them: it was not a draft fault the report left alone but
a both-lost wrap, since reverted, and the guard keeps it from coming back. The
first kind is that whole class -- an inner bracket the draft rendered as `'...'`
-- and it is now reported rather than wrapped.

## What it found that is not a bracket fault at all

**A shifted run cuts every `「…」` in half**, so a speech starts with the closer
of the one before it and ends with the opener of the one after. That is a third
signal for the class `SpeechGaps` calls `shifted`, and a cheap one -- both of
that report's own signals need the wrong row to *look* wrong.

`033355.tsv` `m[230508]`-`m[230530]` is 23 rows whose English sits one row late,
ending on an empty cell where the scene comes back into step. Seven speeches
there have the shape `」「` and nothing else in 5433 scenes does. `SpeechGaps` did
not report it and still would not. `SHIFTED_RUNS` holds those rows out of every
rule, because a bracket written onto a row carrying somebody else's sentence
makes the wrong text look finished.

`033503.tsv` `m[247232]`-`m[247236]` was found the other way round, by the
`extra` pass rather than by reading: the run's last row was padded with
`「............」`, the Japanese there has no brackets, the rule took them off,
and `SpeechGaps` could then see the padding it had been blind to. The speech had
been invisible to both reports -- `bracket` never fired because the Japanese has
no bracket to lose, and the dots signal was masked by the two the draft added.
That is why `shifted` reads 19 after these passes and 18 before, and it is a
finding rather than a regression.

## Against `find_speech_gaps`

Both reports over `en_grok`, before the passes and after.

| class | before | after |
|---|---|---|
| `shifted` | 18 | 19 |
| `overflow` | 3347 | 3346 |
| `blank` | 1333 | 1331 |
| `bracket` | 3491 | 66 |
| `untranslated` | 25 | 25 |
| | **8214** | **4787** |

`after` is the state once the 91 of the last section were reverted; `bracket` was
65 with them still wrapped and is 66 with the one gap the wrap had masked back in
the open. Both numbers are the state on the day these passes ran:
`scripts/bake_speech_rows.js` has since taken `overflow` to 839 and `blank` to 2,
and `bracket` to 72 -- six speeches that were filed under a worse class and came
back into this one when it was fixed. [speech-gaps.md](speech-gaps.md) carries
the current table.

`bracket` emptied without `overflow` filling, which is the check that matters:
the speeches left the report rather than moving to a worse class. `overflow` is
a net one lower -- `extra` takes characters *off* rows, and that bought back
more than the four brackets cost.

## The 91 both-lost fixes that wrapped an inner bracket

A review of the passes found the one thing the post-condition is built not to
catch. `both-lost` puts the opener on the first written row and the closer on
the last, which is right only where the Japanese opened the speech with the
bracket and closed the speech with it. **91 speeches carried the pair inside the
speech instead** -- `『魂』` emphasising a word, `「ドラゴンパッチ６巻」` naming a
book, `（強引に）` qualifying a clause mid-sentence -- and the draft had rendered
that inner quote as `'...'`, which `englishShape` cannot see. So the shape read
`both-lost`, the fix wrapped the whole line, and `verifyFix` passed each one:
the shape `『』` was right *in order*, and no word moved. A bracket in the wrong
place is exactly what a check that asks the speech and not the row reads as
correct.

83 were narration and 8 were annotation, and the wrap turned a paragraph into a
quote box: `030504.tsv m[11607]` became `『When Gandhi saw ... quite unique.'』`
around two rows the game leaves as narration. None was a bracket that fell off
an end; every one was a choice about which words are quoted, which is the thing
`rowEndBrackets` already refuses when it leaves the middle of a row alone.

The fix is in two halves. **The 91 were reverted to the draft** -- 165 rows, the
effective map 165 changed and none gone or added, and the draft's `'...'` is the
house rendering of an inner quote at 5136 rows against 470 that use `『』` at all.
**`bracketsAtSpeechBoundary` now withholds a lost fix whose bracket the Japanese
does not carry at the speech's own boundary**, so no future run rewraps them:
they are reported in `both-lost` marked `!!` as internal, the way a shifted run
is, and `fix_speech_brackets` writes nothing for them. The guard is exact over
`en_grok` -- it withholds those 91 and no other, and passes every one of the 562
both-lost fixes whose bracket really is the speech's own.

The revert surfaced one thing it had been hiding: `032957.tsv m[190803]` is
narration whose last row is the utterance `「ひゃっ！？」`, and the draft wrote
`Hya!?` without the closer. The wrap had masked that gap; `find_speech_gaps` now
reports it, which is why its `bracket` class reads 66 after the revert and 65
before. It is a real gap the draft owns, not a regression -- the bracket belongs
on that one row, which is the human decision the guard defers to.
