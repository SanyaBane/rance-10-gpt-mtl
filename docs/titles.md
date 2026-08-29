# Rance's title, and how to change your mind about it

`総統` is what humanity calls Rance once the summit puts him over all of it, and
it is **Supreme Leader**. This is the write-up because the word is the one that
had drifted furthest -- the dialogue said it five ways over 1167 lines -- and
because it is the kind of decision somebody may want to reverse later.

## Why Supreme Leader and not Supreme Commander

Not because the dialogue said so most often, though it did -- 660 lines against
140. Because the other candidate is taken. Three separate ranks in this game are
already Supreme Commander in English, and all three are somebody other than
Rance:

| Japanese | Who | English |
|---|---|---|
| `総隊長` | Cecil Karna, over the Free Cities' army | Supreme Commander |
| `総大将` | Kayblis, over the Monster Army | supreme commander |
| `総司令官` | Yamada Chizuko, over the whole army | Supreme Commander |

`大統領` is spoken for as well: Sheila Helman is the President of Helman, on 108
lines. So "President" and "Supreme Commander" both name real offices held by
real people, and giving either of them to `総統` puts two officials under one
English title. Supreme Leader is free, and it is what most of the dialogue had
already settled on.

## Where the word lives

One entry, in `glossaries/mistranslated_names.json`:

```json
{ "shortNameEng": "Supreme Leader", "shortNameJpn": "総統", "knownMistranslations": [...] }
```

The repair pass in `modules/NameNormalizer.js` runs over the corpus at every
build, so the 1043 dialogue lines whose Japanese carries `総統` are rendered from
that one field. Nothing about them is written down anywhere else, and the corpus
still says President and Supreme Commander in its own files -- the build is what
makes them agree.

`総統府` has an entry of its own beside it, because "the Supreme Leader's Office"
is not a substitution the short entry could make.

The title is deliberately **not** in `glossaries/summary_terms.tsv`. A word in
both tables is a word with two sources, and the synopsis prompt reads the name
table anyway -- `scripts/summary_chunk.js` quotes it through `createNameFinder`.

## Changing it

1. In `glossaries/mistranslated_names.json`, swap `shortNameEng` on both entries and
   move the outgoing spelling into `knownMistranslations`. That is the whole of
   the dialogue: 1043 lines re-render on the next build, including the two that
   read "an order from the Supreme Leader".
2. `grep -rn "Supreme Leader" glossaries/ patches/ archives/` returns nine lines.
   Two are the table entries themselves; the other seven are strings no table
   can reach, because the build hands them to alice-tools as they stand:

   - `glossaries/summary_glossary.tsv` -- `総統司令部` and `ランスが総統となり人類をまとめる`
   - `patches/system_cherry_picks.v1.04.ain.txt` -- `s[14797]`
   - `archives/Rance10EX_v1_04/5_クエストデータ.x` -- two quest descriptions
   - `archives/Rance10EX_v1_04/43_秘書データ.x` -- two secretary lines

3. Nine dialogue lines say the title where their own Japanese does not, so the
   pass cannot see them -- each one the second half of a sentence whose first
   half carries the `総統`. They were `#9699`, `#12975`, `#17896`, `#19220`,
   `#19640`, `#42228`, `#57348`, `#58829` and `#107592` in the chunk corpus,
   which numbered by v1.00 and is deleted; in the scenes, find them with
   `node scripts/lookup_term.js` rather than by those numbers.

Then build and read it back. Anything still saying the old word is one of the
other four offices above, not a miss: `node scripts/lookup_term.js 総隊長 総大将 大統領`
is how to tell.
