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

The reader's rule, in one line: **the speech decides and the row is written.** A
speech with no English is left out whole, so its rows play in Japanese; every row
of a speech that has some is written, blanks included, because the draft answers
a whole utterance on its first row and skipping the remainder would put English
on one row of a bubble and Japanese on the next.

## Left to do, in the order worth doing it

### 1. Bake the row layout

3346 speeches are drawn in more lines than their window has and 1331 more have a
blank row where the game speaks. `modules/SpeechRows.js` takes 2507 of the
overflows back by laying the same words across the rows the bytecode gives them.

Bake it into the `.tsv` rather than doing it in the reader, for the reason
`CLAUDE.md` gives about the name repairs: a file must read the way a build of it
reads. The bake is idempotent — laying out a laid-out speech was a no-op in
1723 of 1723 when it was tried on the blank class — so re-running it and
expecting no change is its own check.

Two rules it must respect, both learned the hard way:

- **lay out only the rows the game speaks on.** 954 speeches hold a row the game
  itself left blank, and `m[6638]` positions text across the screen with twenty
  full-width spaces. Filling those flattens the author's layout, and asking
  `layOutSpeech` to fill them is what made 101 speeches look impossible to fit
  where the real number is one.
- **do not reach for the chunk files as an undo.** This step used to say to
  bake while they still exist, on the grounds that `npm run extract-scenes`
  restores every English cell in one command. It does not. That script fills the
  English column from `readCorpus`, which is `gpt_outputs*/`, and writes into
  `build/scenes/` — so what it hands back is the chunk-era English, and the
  chunks stopped being the corpus at `1581d8e4`. **6388 of the tree's 269677
  rows already say something else**: the five bracket passes, develop's refined
  lines carried in at `41592050`, and two "Refine translation" commits.
  Restoring from them would reopen 4972 bubbles. The undo is git — commit the
  bake by itself, and check it by reading the result back rather than by keeping
  a way to put the draft back.

That count is worth re-taking rather than trusting, because every commit into
the scenes moves it: `readCorpus(textLangDir("en_grok"), v100ToV104)` held
against `readTranslatedScenes("en_grok")` and keyed by line number is the whole
comparison. It also finds 60 rows no chunk record covers at all.

Verify by rendering and comparing the *effective* mapping — each number against
the last assignment naming it, which is what alice-tools applies — not the file.
`scripts/effective_map.js` is that comparison, and `docs/speech-brackets.md` is
what it caught the last time a pass rewrote rows in bulk.

### 2. Delete `gpt_outputs*/`

Nothing makes this wait for step 1 any more: it was second because of the undo
above, and there is none. What it does have is one dependency worth knowing
before starting — the driver's first stage reads `build/scenes/`, which
`extract_scenes` fills from the chunks, so deleting them without that port stops
`request-scenes` and `accept-scenes` rather than only the reports.

- `scripts/extract_scenes.js` changes role: it fills the English column from the
  corpus today, and afterwards has to carry forward what the scenes already say.
  This is the only substantial edit in the step.
- port four readers: `find_dropped_terms`, `find_gender_gaps`,
  `find_mistranslations`, `modules/TermDrift.js`.
- delete `scripts/translate_chunks.js` and `modules/OpenAiTranslator.js` — the
  chunk-era translator, dead the moment the folders go.
- drop the corpus branch from `modules/Corpus.js` and the `own()` fallback in
  `scripts/regenerate_aai_txt.js`.
- 13 files of documentation name the chunk format. `docs/corpus-alignment.md`
  and half of `docs/baked-name-repairs.md` stop being questions rather than
  needing rewrites: a scene row cannot disagree with the dump and two rows
  cannot claim one number.

### 3. Carry the format to `develop`

The one thing that actually blocks future work. After step 2 `develop` is still
in the chunk format and a "Refine translation" commit there cannot be merged
here. Worse, and silently: **develop still spells the player's name literally on
all 1504 lines where this branch restored `＜エール＞`**, and nothing in a merge
would catch a commit putting one back — `SceneAcceptance` guards a translation
coming in, not a corpus merge.

### 4. The text repairs the report found

| | | |
|---|---|---|
| speeches too long for any layout | 839 | shorten by meaning, by hand |
| ~~a 「 or 」 lost at a row boundary~~ | ~~3609~~ | **done** — 4972 speeches over five passes, [docs/speech-brackets.md](speech-brackets.md) |
| a bracket on the wrong row of the right speech | 191 | 100 row patterns; the 21 largest are the game's own marks a row too early, the rest a decision about which words are quoted |
| shifted English | 19 | by hand; 12 are one scene, `031792.tsv`, a letter whose English is fifteen rows of dots and wants translating |
| a whole shifted run no report sees | 23 rows | `033355.tsv`, held out of the bracket rules by `SHIFTED_RUNS` |
| untranslated scenario notes | 61 rows | decide whether they are wanted at all |

The first wants doing after the bake, which moves it. The brackets deliberately
went **before** it: they are written glued to a word, so a bake carries them
along, and doing them first meant the bake starts from bubbles that close.

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
node scripts/regenerate_aai_txt.js          # build/regenerated.en_grok.ain.txt
node scripts/ain.js --out=build/scratch     # never into the game while testing
alice ain dump -t -o built.txt build/scratch/Rance10.ain
```

The comparison is per line number against the *last* assignment naming it. The
patch grew 5676 lines shorter when the reader landed, because reading by number
drops the duplicate assignments the overlapping chunks used to write, and a file
diff would have called that 5676 regressions.
