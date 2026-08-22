# The name repairs are in the corpus

`glossaries/mistranslated_names.json` is a table of canonical spellings and the
wrong ones seen before, and `normalizeNames` in `modules/NameNormalizer.js`
applies it: where the Japanese line names a character and the English spells them
some other way, a known misspelling is swapped for the right name. For years that
happened only on the way into the patch. 14 380 of the corpus's 275 374 lines went
through the swap at every build, and none of them said so on disk. (275 373
since `d42c50a6`, which dropped the one record sitting on a line number the game
does not have.)

They say so now. The repairs were written into
`text_languages/en_grok/gpt_outputs*/` by commit `3eafda3a` — a chunk file reads
the way a build of it reads. That commit is also the line the corpus's own
provenance runs to: before it, the English in a chunk is what the translation
produced and nothing else, which is what `text_languages/en_grok/README.md`
describes.

```
node scripts/regenerate_aai_txt.js    # writes build/regenerated.en_grok.ain.txt
```

## Why the corpus holds them

Because a corpus nobody can read is a corpus nobody can edit. Looking at a chunk
file, there was no way to tell whether the "Caveblis" in front of you would reach
the game or be quietly fixed on the way, so a hand edit was either redundant or
wrong and nothing on the page said which. Half the lines that mattered were in
that state: `魔人` alone accounted for 2 556 of them.

What the bake is not is a change to the game's text. The patch rendered before it
and the patch rendered after it were byte for byte the same file.

## The pass stays, and must find nothing

`normalizeNames` still runs at every build. It is idempotent — a second pass over
a baked corpus repairs nothing — and it goes on covering what a bake cannot: the
chunks `scripts/translate_chunks.js` writes next, hand edits, and the misspellings
the table learns after today.

**So the invariant is that the pass finds 0 lines to change.** A non-zero count
means the corpus and the build have drifted, and the corpus is the one that is
wrong.

There is no script for the check in the repository, on purpose — the same reason
the one-shot script that built this corpus is not here either. It is ten lines:
walk both chunk folders, call `normalizeNames` **imported from the module rather
than reimplemented**, compare against `translatedEnglishLine`, count.

Writing a chunk back has to reproduce its shape, or the diff drowns the edit:

```js
fs.writeFileSync(file, JSON.stringify(data, null, 4).replaceAll("\n", "\r\n"), "utf-8");
```

Four-space indent, CRLF, and no trailing newline. In that form all 4891 files come
back byte for byte, so a diff shows the translation lines and nothing else. Only
`translatedEnglishLine` is ever touched — the line numbers, the Japanese, the API
metadata of the chunk and the key order all come back out of `JSON.stringify` the
way they went in.

The check after any edit to the corpus or the table:

| Step | Expect |
|---|---|
| the pass over the corpus | 0 lines |
| `build/regenerated.en_grok.ain.txt` diffed against a copy saved beforehand | exactly as many lines as you edited |
| `renderSummaryTable()`, if `glossaries/summary_*` moved | `0 too wide with no row to spare` |
| `checkNameplates()` and `checkCardNames()`, if `archives/Rance10EX_v1_04/` moved | silence |

## A repair cannot undo itself

The pass skips a line whose English already contains the canonical name, and that
test is a plain substring test:

```js
if (sentence.includes(shortNameEng)) { continue; }
```

Which means a line that has already been repaired is one the pass will never look
at again — and two things follow.

**A misspelling that contains the canonical name is a dead entry.** `バボラ` is
"Babolat" and 62 lines spelled him "Babolatat", which contains "Babolat", so no
entry for it could ever fire. Those 62 lines were fixed in the corpus instead. Do
not add a misspelling that holds its own canonical name; it will sit in the table
doing nothing and reading like it works.

The table had 26 of them over 17 entries, and they are gone. Ten were the
canonical spelling itself — `"Rance"` under ランス, `"Hanny"` under ハニー,
`"Satella"` under サテラ — and the rest were it with something on the end:
`"Kaybliss"`, `"Babolata"`, `"Kalara"`, `"Rangii"`, four ways of writing
`Arios` with extra esses. The check is one line, `spelling.includes(canonical)`,
and the proof that they were dead is that dropping them rendered the patch
**byte for byte the same file**. Two entries are left with no misspellings at
all, which is a shape the table already had 40 of: `createNameChecker`, the
nameplates and `scripts/generate_card_names.js` read an entry's canonical and
never its misspellings, so an empty list costs nothing.

**Undoing a rendering takes a corpus edit.** `Athena 2.0` holds `Athena`, so the
173 lines that had to go back to the short form could not be left to the pass.

## After the bake, a broad misspelling is only a risk

A one-word entry like `"Demon"` earned its place while the corpus was raw. Once
the lines it repaired carry the canonical name in the text, it has no work left —
and what it can still reach is a line where that word belongs to somebody else.

`魔人` listed `"Demon"`, so on any line naming both a Fiend and the Demon King,
the King's own title was the word it took: `前魔王ガイ` shipped as "the former
Fiend King Guy". Writing those 71 lines back was not enough — 67 of them reverted
at the next build until the entry went.

Removed on those grounds, each verified to change 0 lines the day it went:

| Entry | Dropped | Because |
|---|---|---|
| `魔人` → Fiend | `Demon`, `demon` | 魔王 is a Demon King, 魔王 phrases are everywhere |
| `魔人` → Fiend | `Magic`, `magic` | a Fiend in a line about a magic item |
| `魔軍` → Monster Army | `Demon`, `demon` | the same, before it happened |
| `マジック` → Magic | `magic` | 11 lines of `マジックアイテム` came out as "Magic item" |
| `パステル` → Pastel | `pastel` | `パステル調の落書き` came out as "Pastel drawings" |
| `カオス` → Chaos | `chaos` | the capital is right on the sword, wrong on `カオスの塊な奴` |
| `リセット` → Reset | `reset` | `世界がリセットされる` is a verb |
| `カフェ` → Cafe | `cafe`, `café` | a coffee shop is not the character |
| `火炎` → Flame | `fire` | one firing, and `火炎魔法` is the element |
| `火炎` → Flame | `Flame` | the canonical spelling itself, so nothing could reach it |

The longer forms stay in every case — `demon army`, `Demon Army`, `Majin`,
`Majikku`, `Café` — because a phrase is about the thing it names and a single
common word is about whatever the sentence was already saying.

One single common word survived that reasoning. `火炎` keeps `"Fire"` because
the evidence went the other way: all thirty of its firings were the apostle —
`Fire-chan`, `Fire Library` — and none was a word belonging to somebody else,
where `魔人`'s `"Demon"` took the Demon King's title 67 times. Every line
using 火炎 as the element spells it lowercase or buries it in a longer word.
So the rule is not "no single words" but "count what the entry did before
deciding", and a trace against the corpus as the translation produced it is
how that count is taken.

### Dropping an entry leaves a residue, and nothing reports it

Each removal above was verified to change 0 lines the day it went, which says
the corpus already read correctly *on the lines the entry was then repairing*.
It says nothing about the lines the entry would have repaired **next** — and
after the drop, no check in this repository looks at them at all.
`createNameChecker` never runs over the corpus, and a lower-case `demon`
satisfies it in any case.

`090f776d` is that residue for `魔人`: 16 records still calling a Fiend a demon,
against 2567 that spell it Fiend and a `summary_terms.tsv` row that has said
Fiend all along. Two of them the entry could not have reached even while it
existed — `m[252944]` already carries the word "Fiend" earlier in the line, and
the pass skips a line whose English holds the canonical.

**The way to find one is subtraction, not search.** Grepping the English for
`demon` over the lines whose Japanese carries 魔人 gives 114, and 94 of them are
the word doing its own job. Take every phrase that legitimately owns it off the
English first — Demon King, Demon Sword, Demonic Blood Soul, Demon World, demon
army, Return Demon, demonification, `demonic <noun>` — and 20 are left, of which
16 are wrong and the four right ones are 悪魔 standing in the same sentence.
That list is readable; the 114 is not.

**And a line holding both words is decided by the scene.** `m[263608]` and
`m[264492]` each put 魔王 and 魔人 in one sentence, which is the pair that got
the entry dropped in the first place. Read alone, either could go the other way;
read in the scene, Miki is already the Demon King and means to fix the Fiends,
and Hornet is a Fiend offering to take the Demon King's post.

## The pass only reads its own record's Japanese

`normalizeNames` decides from the `originalJapaneseLine` of the record it is
repairing. A sentence that wraps across two records leaves its name on one of
them and its English spelling on the other, and then no entry can fire: the
table is right, the line is wrong, and nothing reports it. 474 lines were in
that state, fixed over `ea5247cb`, `806c0267`, `4a7c3d95`, `ad812670` and
`67d52b5c`.

They are found by running the same repair against a **window of neighbouring
records** instead of one. Window ±0 finds nothing at all, which is the check
that the sweep is measuring the wrap and not something else; ±1 found 477 lines
and ±2 another 56. The sweep is not committed, for the same reason the check
above is not.

Two guards it cannot work without, both found by triage rather than by the
sweep:

- **A word can already be somebody else's right name.** シィル lists `"Sheila"`
  among its misspellings, and fourteen lines say Sheila because シーラ is who
  they are about — their own Japanese says so. A spelling the record's own
  Japanese claims is never taken away from it.
- **The canonical may already be there under another separator.** The sword
  By-Road holds `"Road"`, which バイ・ロード lists, and repairing it gives
  "By-By Road".

And a repair has to replay the **whole** entry rather than the misspelling that
was noticed. ＜エール＞ is spelled by two entries in turn — a dozen spellings
fold into the full-width form, then that becomes `El` — so replaying one
spelling stops the line halfway and leaves ＜エール＞ inside an English sentence.

## What is still done at build time

The corpus is not literally the patch. `replaceUnicode` in
`modules/TextNormalization.js` still folds the curly quotes, dashes and ellipses,
and `wrapAt` still decides the line breaks. Wrapping cannot be baked — it is
layout against a font and a margin. Folding could be, and has not been.

## Two things to watch when editing by line number

`gpt_outputs/` has 5 679 duplicate records: the chunk ranges overlap, so
`128540_128600.json` and `128550_128610.json` both carry `m[128578]`. The English
agrees in all but two of them. A fix applied by line number has to reach **every**
copy, or the build's last-wins rule decides which one a player sees.

And the number is not always a number. 6 495 of the 275 373 records carry
`lineNumber` as a JSON **string** — the whole of `gpt_outputs_v104`, and the
block from `gpt_outputs/132117_132317.json` through `133317_133367.json` — and
4 261 line numbers exist in no other form. `r.lineNumber === 48582`, or a `Map`
keyed on the number, walks past every one of them and says nothing. The build
never trips on it because each of its own reads coerces: `+lr.lineNumber`, in
`scripts/regenerate_aai_txt.js`. Nor are the two folders one numbering space —
`gpt_outputs` is the v1.00 numbering that same script maps forward, and
`gpt_outputs_v104` is already v1.04. The 5 045 numbers on the v104 side are not
a range of their own either; they run from 94 to 269 677, and 784 of them are
also a number `gpt_outputs` uses for some other line.

And a record's Japanese is not automatically the game's line for its number.
4905 of them are not, almost all of that a dropped closing `」`. Two kinds that
mattered are gone: 158 lines of six scenes were showing the *next* line's
English until `eec7f479`, and 386 records carried the *next* line's Japanese --
which is what `normalizeNames` reads to decide a name repair -- until
`8fbf3793`. `docs/corpus-alignment.md` has the check and what it still reports.

Both traps have the same answer. Key a one-off repair on **the exact English**
rather than on the number, and assert that each edit was found as many times as
you meant it to be — no fewer, which catches the string-keyed record, and no
more, which catches the duplicate copy you did not know was there. That is what
carried `m[269231]` through the `火炎` pass: a v104 record whose line number is
the string `"269231"`.
