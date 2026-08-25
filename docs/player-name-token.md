# The name the player typed

`＜エール＞` is not a word. It is the key the game swaps for the name the player
entered at the `エール入力画面`, registered into the game context by
`GameChapter2@Init`, and the game's own script writes it on **1522 `m[]`
lines**. Until this pass, the patch built from `text_languages/en_grok/` wrote
it on **none**: every one had been resolved to the literal "El", so a player who
named the protagonist anything else read somebody else's name 1522 times.

Nothing about that is visible in the English on its own, which is why it
survived a whole translation, three guards written specifically about this token
and a doc that states the fact in passing. `docs/scene-driver.md` says the
`normalizeNames` bug "cost `en_grok` nothing" — true, and the reason it cost
nothing is that there was nothing left to spoil.

## The corpus and the game agree exactly

Worth establishing before touching anything, because the repair is keyed on the
Japanese and a repair keyed on a corpus that has drifted repairs the wrong
lines. Moved onto the game's numbering by `modules/LineNumbers.js`:

| | |
|---|---|
| the game's own `m[]` lines carrying the token | 1522 |
| corpus records whose own Japanese carries it, last-wins | 1522 |
| game lines with no corpus record | 0 |
| game says token, the record's Japanese does not | 0 |
| the record's Japanese says token, the game's line does not | 0 |

No duplicated numbers among them either, so one edit apiece reaches the build.
Two more records carry the token and are dropped before the build sees them:
v1.00 numbers `v100ToV104` has no partner for.

## What the draft did with it, and what came back

The seventeen English words containing the letters "El" across those records are
the name and nothing else — no Elder, no Element, no Elena — so the repair is
the word, and what follows it does not move.

| class | records | what it got |
|---|---|---|
| the word stands where the token stands | 1474 | `El` → `＜エール＞`, the honorific left alone |
| the name wrapped onto the next row | 26 → 25 edits | the edit goes where the word is |
| a spelling the repair pass cannot reach | 5 | rewritten |
| the English says "you" | 17 | left |
| the draft dropped the line | 2 | left |

915 of the first class are bare, 401 `-chan`, 72 `-sama`, 49 `'s`, 35 `-san`,
and the tail is `-dono`, `-kun`, `El Mofus` for `＜エール＞・モフス`, and
`El-----` for a drawn-out shout. Nine records carry the token twice and spell it
twice; one carries it twice and spells it once, the second being a "you".

The built `.ain` now carries the token on **1504 lines and 1513 occurrences**,
and the difference from the game's 1522 reconciles line for line: 27 lines the
build has and the game does not are the 25 wrapped plus 2 more, and 45 the game
has and the build does not are those 26 wrapped rows, the 17 pronouns and the 2
empties.

## The rows that moved

A speech is several `m[]` rows and the English wraps at its own places, so the
row the Japanese puts the token on is not always the row the English puts the
name on:

```
190236  　なんとなぁく、まだ＜エール＞とは      Somehow, I still feel
190237  　距離感がある気がするなあ」            a bit of distance with El.」
```

Writing the token on a row whose Japanese has none is not a liberty. The game
substitutes per message, and its own Japanese puts the token on exactly such
mid-sentence rows — `　＜エール＞ちゃんみたいな` is a row that ends before its own
verb.

This is the class `docs/baked-name-repairs.md` describes for the repair pass,
arriving at the same repair from the other end. `m[214961]` and `m[214962]` are
two speeches that both say `＜エール＞ちゃん達` against one English rendering that
says it once, on the row above both, which is why 26 findings are 25 edits.

## Three traps, each of which hid something

**The skip is what the repair was standing on.** `normalizeNames` skips a line
whose English already holds the entry's canonical, by plain `includes`, and the
name table has an entry whose `shortNameEng` is `El` keyed on `＜エール＞`. So
every one of these 1474 lines was skipped for holding the literal "El" — and
taking that word out takes the skip away, at which point the entry starts
reading its own misspelling list. The invariant in
`docs/baked-name-repairs.md` was therefore at risk, and had to be checked
against the module rather than reasoned about: `Ale`, `Eru`, `Ail`, `Eir`,
`Yale` and the rest reach for nothing on any of them, and the pass still finds
**0 lines**.

**A sweep for the canonical spelling is blind to the misspellings.** The wrapped
class was found by looking for `El` on records whose own Japanese has no token.
That finds 221 records, of which 27 are the wrapped ones and 194 are the
scenario outline in the `t…` functions, where the game writes a plain `エール`
and "El" is right. What it does not find is a wrapped name the draft **also**
misspelled — `<Aile>-chan`, `<Ale>-sama` — because `normalizeNames` never
repaired those either, for the same reason: their record's Japanese names
nobody.

Asking the other question — where does any of the 42 spellings the two
`＜エール＞` entries know stand alone — finds 87 records and closes the class.

**And 84 of those 87 are noise, of a shape `docs/name-checker-calibration.md`
already names.** 83 are `愛`, a different character whose English is Ai, and one
is `雹`, which is hail. Both `Ai` and `Hail` are misspellings the `＜エール＞`
entry lists, and neither has ever fired, because a one-word misspelling reaches
for whatever the sentence was already saying and these sentences were saying
something else.

## What is left, and why

**17 lines where the English says "you".** `　＜エール＞も疲れただろう」` came back
"You must be tired too.」", which is not a contradiction — absence of the name is
not the same thing as the wrong name, and rewriting the sentence to carry the
token is a translation rather than a repair.

**2 lines the draft dropped altogether**, `m[216299]` and `m[237665]`, which
render empty. That is a hole in the translation and not in the substitution.

**26 rows whose token moved to a neighbour.** The player sees their name in the
speech; it is one row along from where the Japanese put it.

## The check is the built file

Twice already this token has been broken by a pass that runs *after* the thing
guarding it — the name repair resolving it, then `replaceUnicode` turning its
`ー` into a tilde and shipping `＜エ~ル＞` — and neither the scene file nor the
patch showed either fault.

```
node scripts/ain.js --out=build/scratch
alice ain dump -t -o built.txt build/scratch/Rance10.ain
```

Count `＜エール＞` on the `m[]` lines of that, and count `＜エ` that is *not*
followed by `ール＞`. The second is the one that matters: today it is 30, and all
30 are the game's own card keys `＜エール男Ａ＞` and the `＜エール..＞` regex
literal in the card code. A mangled token would be in that count and in no
other.
