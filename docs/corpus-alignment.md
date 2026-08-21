# A record's Japanese is not automatically the game's line for its number

Every record in `text_languages/en_grok/gpt_outputs*/` carries three things: a
`lineNumber`, the `originalJapaneseLine` it was translated from, and the
`translatedEnglishLine`. Only the first of those reaches the game.
`readCorpus` in `scripts/regenerate_aai_txt.js` keys on the number alone and
never compares the Japanese against anything, so a record whose English belongs
to a different line goes out under its number and nothing says so.

The check that finds it is one comparison: for every record,
`originalJapaneseLine` must equal the game's line for that `lineNumber` --
`game/ain/Rance10.v1.00.ain.json` for `gpt_outputs`, `.v1.04.` for
`gpt_outputs_v104`, which is the numbering split `docs/baked-name-repairs.md`
describes. It is not committed, for the same reason the bake invariant is not.

## What it reports, and what each part is

Ask it of the record the build actually applies -- the last one carrying a given
number, since alice-tools keeps the last assignment it reads. **5157 line numbers
are adrift**, and they are four different things:

| Numbers | What it is | Does the player see it |
|---|---|---|
| 4906 | the record's Japanese lost a closing `」` | no |
| 169 | punctuation folded -- `…………」` against `............」` | no |
| 75 | the Japanese is the next line's, the English is not | no, but see below |
| 7 | a merge, a blank, one line early | no |

A fifth kind is gone: 158 numbers whose **English** was the next line's, fixed in
`eec7f479`. Counting every copy rather than the winning one gives 5714, because
the overlapping chunk ranges carry 5479 numbers twice.

The 75 are not harmless even though nothing renders differently.
`normalizeNames` decides whether a line names a character by reading that
record's `originalJapaneseLine`, so on those 75 lines every name repair is
decided by the wrong sentence. What is left of them: `184790_184850.json` (51
lines), `130760_130820.json` (14), `101820_101880.json` (9),
`136110_136160.json` (1).

## Where the slip comes from

A chunk that merges two of the game's lines into one record has one record too
few, and everything the model writes after it is numbered one too low. It shows
up in the patch as a scene played one line out of step:

```
m[26993]  「だーーーーーーー！              「How long are you gonna keep chatting!
m[26994]  　いつまでグダグダやってんだ！    　Let's go already!」
```

The English for `「だーーーーーーー！` was nowhere -- the merge swallowed it -- and
every line after it showed the next one's text, for 49 lines.

Six scenes were in that state: `m[26992]..m[27040]`, `m[34199]..m[34220]`,
`m[50499]..m[50520]`, `m[113141]..m[113160]`, `m[136388]..m[136410]` and
`m[145059]..m[145080]`, by the v1.00 numbering. Both copies of every overlapping
chunk carried the same shifted English, so both had to be written.

## Measure it against the game, not against the other copy

The corpus has 5479 line numbers with more than one record, because the chunk
ranges overlap. Comparing those copies against each other found 883 numbers
whose Japanese disagreed and **two** whose English did -- which reads like the
drift is invisible, since whichever copy wins says the same thing. (725 and two
today: the repair brought the copies of six scenes into line with each other as
well as with the game.)

It says the same *wrong* thing. Copy-against-copy measures whether the patch
contradicts itself, and that is a different question from whether the text is
right. Only the game's own dump answers the second one.

## A run ends where the English catches up, not where the chunk does

This is the part that costs a pass if you get it wrong. The drift does not
continue to the end of the chunk file: the model eventually repeats an English
line, the repeat takes up the slack, and from there the English sits on its own
number again. Five of the six chunks repeat a line at the first number past the
run, and all six agree with the neighbouring chunk from that point on.

Repairing to end-of-file instead re-shifts the part that had already recovered,
and the way it shows is one English line printed twice. The bound to use is the
run the check reports, and the confirmation is that the chunk agrees with its
neighbour past it.

## Two things the repair turned up

**Dropping the English off the end of a run needs an assertion.** The last
record's English belongs one past the run, where another chunk owns the number,
so it is only safe to drop when that chunk already says the same thing.
Asserting it caught `m[145081]`: `145080_145130.json` never translated that line
and carries its Japanese in `translatedEnglishLine`, so the line about to be
dropped was the only English for it anywhere in the corpus. Writing it there is
half the repair: the shadowed copy in the overlapping chunk went on holding the
Japanese, which made that slot the one thing the patch is supposed to have none
of -- a number assigned two different texts. Run the slot count in
`docs/system-cherry-picks.md` after a rescue, not only after a cherry-pick.

**Five records have English identical to their Japanese**, and only that one is
prose. The other four -- `m[26516]`, `m[178116]`, `m[203298]`, `m[203301]` -- are
runs of dashes and tildes, which are already what they should be.

## Writing a repair

Same shape as any other corpus edit, and `docs/baked-name-repairs.md` has the
rest of it: four-space indent, CRLF, no trailing newline, and check the count.

```js
fs.writeFileSync(file, JSON.stringify(data, null, 4).replaceAll("\n", "\r\n"), "utf-8");
```

What is different from a name repair is that this one touches
`originalJapaneseLine` as well, so "the diff shows translation lines and nothing
else" does not apply. What does apply is that `lineNumber` and the key order must
come back untouched, which is worth asserting field by field rather than reading
off `git diff` -- with `-U0` the diff realigns whole blocks of consecutive
changes and reports unchanged `lineNumber` lines as changed.

Then render and read the result back against the v1.04 dump at the run's start,
its end, and the line past its end. A line whose Japanese is blank cannot be
found in the dump by searching for it, so anchor on a distinctive line nearby and
count forward.
