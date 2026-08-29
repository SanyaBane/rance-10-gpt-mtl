# A record's Japanese is not automatically the game's line for its number

> **Closed by the format on 2026-08-29, and kept for the shape of the mistake.**
> The chunk corpus below is deleted -- `gpt_outputs*/` are in git and nowhere
> else -- and neither fault it describes can happen in the scenes that replaced
> it. A scene row carries the game's own Japanese, checked against the dump at
> every extraction, and every message sits in exactly one scene function, so no
> number can be claimed twice. What outlasts the format is the reason both faults
> lived so long: **a key that is compared against nothing can be wrong for
> years**, and a corpus keyed by line number never had to agree with the line.
> [scene-corpus-migration.md](scene-corpus-migration.md) is the move.

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
number, since alice-tools keeps the last assignment it reads. **4905 line numbers
are adrift**, and sorting them by shape is what makes the number readable:

| Numbers | What it is | Does the player see it |
|---|---|---|
| 4860 | punctuation or a bracket folded -- a dropped `」`, `…………」` against `............」` | no |
| 44 | a slip in retyping the Japanese -- `溜息` for `溜め息`, `言わず` for `言わさず` | no |
| 1 | no line in the dump at all | no |

**No sample of any of those has the English wrong**, and that is the thing to
take from the table rather than the digits. Every one of them also reads its
*own* sentence, which is the only property `normalizeNames` needs from this
field -- so what the number counts now is the model retyping a line slightly
differently, and nothing else. Nothing in it carries text glued on the end any
more, and nothing in it belongs to another number.

Which took three passes over one gradient, because that is what it turned out to
be rather than three faults. A character of the next line, a whole sentence of
it, and five lines running are the same leak at three depths, and the sections
below go through them shallowest last.

Two kinds are gone. 158 numbers whose **English** was the next line's, fixed in
`eec7f479`, and 75 whose **Japanese** was, fixed in `8fbf3793` -- the section
below is what those were. Counting every copy rather than the winning one gives
5329, because the overlapping chunk ranges carry 5479 numbers twice.

The table's last row is one record, and it is there only because this check
happens to trip over it: `gpt_outputs_v104/000720_000780.json` carries
`m[185445]` with an empty `originalJapaneseLine`, and the v1.04 dump has no line
for that number at all. Asking what has **no** line in the dump is a different
question from asking what disagrees with one, and it is worth asking separately
rather than reading off this row -- it is how `m[184739]` was found.

### The comma the model glued on, and the 25 slots printing it

`d113c2c3`. 29 records carried the game's own line with a `,` on the end, and 25
of them printed it in English too, after the closing quote: "　Good work
yesterday.」,". 28 are one scene of `gpt_outputs/000240_000300.json` and one is
`m[152328]`.

**What decides the set is the dump, not a pattern over the English.** Four lines
of that same scene end in a comma correctly -- "Watching the two run off,",
"「Some days you want curry," -- so the cut on the English is a comma standing
*after a closing bracket*, which is never English punctuation, and the cut on
the set is `record.originalJapaneseLine === game + ","`. `m[152328]` is the case
where those two disagree: its English "「--No,」" carries the comma inside the
bracket, leading into the next line, and only its Japanese was repaired.

This is the shape a repair of `originalJapaneseLine` is easiest on: the count
moved by exactly 29, from 5083 to 5054, and every one of the 29 now equals the
dump byte for byte.

### The bracket that opens the line under this one

`9633fecd`, and the shallowest of the three. 90 records carried the game's own
line with a single `「` after it, and 82 of the 90 sit on a line the game follows
with a line opening `「` -- so what the model took was the first character of the
line under the one it was writing. 53 chunk files, all 90 the copy the build
plays, and the English of every one clean.

**It buys nothing a player sees**, which is why it is not part of `29685a5e`
below: a `「` carries no name, so no repair decision moves. What it buys is the
table at the top of this file, which has no row left for anything glued on the
end.

### The record that was reading the neighbour's sentence

`29685a5e`, and the class is closed. 123 records carried a *neighbouring* line's
text in `originalJapaneseLine` while their English was right for their own
number: 91 held exactly the line at some other number, 17 opened with another
line and ran on, and 15 held their own line plus a whole sentence after it. Same
defect as `8fbf3793`, and found this time by sorting the count rather than by
reading a chunk.

Two chunk files are most of it. `101820_101880.json` runs a line ahead from
`m[101822]` to `m[101869]`, 50 records; `136110_136160.json` runs **seven**
ahead over 22, and its English is correct on every one of them --
`m[136119]` reads "「Anyway, more importantly, what kind of" against the game's
「さて、それより女向けの while its own field says 「ガキ向けのエロ本って奴か？18禁でもない,
which is two lines the game puts seven numbers later. The other seventeen files
have between one and eighteen apiece.

**The dump decides which records these are and what goes back in**, which is why
this one is mechanical where the blank English below is not. And because no
English is touched, the check is absolute rather than statistical: the rendered
patch and the built `Rance10.ain` both came back **byte for byte the same file**.

`m[300]` is the one worth naming. What sat in its Japanese was the model's own
reply -- `」}]}]}The JSON object contains lines of script. Here's the
translation. Please let me know if you'd like me to do anything else.}]},{` --
and nothing had ever read it, because nothing reads that field except the name
pass.

### The blank English, which is 1565 records and is not this

Measured while sorting the table above, and left alone. 1565 of the records the
build plays have a Japanese line that says something and an English line that is
empty, so the patch assigns `m[N] = ""` and the player gets a blank where a line
should be. **Nothing is lost**: every one of them is a two-line Japanese unit the
model merged into one English on the *first* record, and the text is on the line
above.

```
m[34827] = "「Yes. We've had Tulip artillery with us before..."   ← 「ええ。前から、チューリップ砲兵を
m[34828] = "　but the Zeth mage corps is impressive.」"           ← 　周りに付けてましたけど……
m[34829] = ""                                                     ← 　ゼスの魔法兵団は流石ですね」
```

The signature that shows it is a merge rather than a dropped line: the blank
record's Japanese closes a speech, the record above it does not, and the English
above it does. That reaches 984 of the 1565 directly, and the remaining 581 are
narration of the same shape, where no bracket is there to test.

It is invisible to the check this file is about, because both fields of every
one of those records agree with the dump. And repairing it is not a sweep --
each one is the English of two game lines that has to be split back across
them, which is 1565 translation decisions rather than a rule.

## The Japanese that was the next line's

75 numbers reached the game with the Japanese of the line after them, and
`normalizeNames` reads exactly that field to decide whether a line names a
character. Nothing rendered differently, so the whole of what it cost was that
those name repairs were decided by the wrong sentence.

Two ways in. Most of it was the overlapping chunk ranges: where two chunks carry
a number, one had the Japanese right and the other had the neighbour's, and the
build keeps the last it reads. The rest was **the one gap in the game's own
numbering** -- the v1.00 dump runs 1..264710 with 184738 followed by 184740, and
`184790_184850.json` was numbered arithmetically from 184731 without knowing it,
so from the gap on all 52 of its remaining records sat one number ahead of their
Japanese. The record it wrote for the gap itself, `m[184739]`, was dropped in
`d42c50a6`: `readCorpus` maps a v1.00 number forward and drops what it cannot
map, so nothing had ever reached the game from it.

386 records were written back rather than 75. The other 311 lose the last-wins
sort and never reach a build, but a chunk file is meant to read the way a build
of it reads, and the next renumbering of the chunk ranges would promote them.
The repair is safe exactly when the pass stays silent after it: with the
Japanese back on its own number, `normalizeNames` changed no English on any of
the 386, so the rendered patch came back identical.

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
drift is invisible, since whichever copy wins says the same thing. (391 and two
today: the two repairs brought the copies of six scenes, and then every copy
carrying a neighbour's Japanese, into line with each other as well as with the
game.)

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

Comparing record against record by **index** is only right while the record
count holds. A repair that removes one -- `m[184739]` was the only one so far --
renumbers every index after it, and a field-by-field check then reports the
whole tail as changed. Compare against the old list with that index taken out,
or key on the line number.

Then render and read the result back against the v1.04 dump at the run's start,
its end, and the line past its end. A line whose Japanese is blank cannot be
found in the dump by searching for it, so anchor on a distinctive line nearby and
count forward.
