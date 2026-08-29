# "Lord" over a 様, and the six reasons not to touch one

The patch writes `-sama` 3592 times and `modules/ScenePrompt.js` tells a
translator to keep the honorific the Japanese wrote. `en_grok` predates that
instruction and was translated a line at a time with no speaker and no scene
around it, so 1477 of its occurrences answered somebody's 様 with "Lord" or
"Lady" instead.

`scripts/find_honorific_drift.js` is the report, `scripts/fix_honorifics.js`
writes what it shows, and `modules/HonorificDrift.js` is the question. The
first pass wrote **1087 occurrences on 1065 rows in 446 scenes**.

## The question is asked of the speech and answered on the row

A speech is where the Japanese lives: the two languages break lines in
different places, so the 様 can sit in a row other than the one carrying the
English name. A row is what gets written, because re-laying-out a speech to
change five characters rewrites what is not broken -- and it does not need to
be redrawn anyway. `Lord ` measures 155 units of the message window's 1194 and
`-sama` measures 166.75, so a row that fitted before fits after, four speeches
in the whole corpus excepted (below).

Nothing in the pass decides a name. `<name>様` in the Japanese, `Lord <name>`
in the English, and the two names paired by `glossaries/mistranslated_names.json`
and `glossaries/card_name_glossary.tsv`: three facts already written down. Every
occurrence where one of them is missing gets a bucket instead of a guess.

## The buckets

What is left after the first pass, and why each is left:

| Bucket | Left | Why a person has to |
|---|---|---|
| `dono` | 184, now 0 | `殿` is `-dono`. Its own pass, and it has had it -- "The 殿 pass" below. |
| `unknown-name` | 102, now 77 | No table holds the name -- Terra, Rudrasaum, Osman. A missing row, not a missing substitution: `scripts/find_unnamed_terms.js` is the other half. Medusa, Pi-R and Wass turned out to be written down elsewhere and are closed below. |
| `unpaired` | 60 | The name is in a table and its speech carries no honorific at all. "Lord" there is the translator's, and removing it is a reading. |
| `followed-by-name` | 26, now 3 | The English name runs on past the match. "Where the name ends" below; the 3 left are ranks rather than names. |
| `wrapped` | 16, now 2 | The address is split across two rows, so no row holds it and a substitution cannot see it. "The rows that cut an address in half" below. |
| `already` | 2, now 0 | "Lord Lis-sama" was the honorific twice over, so the fix was dropping the title rather than adding what was there. `--bucket=already`. |

`followed-by-name` is the bucket that earned the whole report. 雷帝様 is
"Lord Thunder Emperor", 魔人ワーグ様 is "Lady Fiend Warg", 火炎書士様 is
"Lord Flame Scrivener", 毛利てる様 is "Lady Teru Mouri" -- the pattern matches
one capitalised word and the name is two or three, so a substitution that fired
would have written "Thunder-sama Emperor" and "Fiend-sama Warg" 26 times. The
guard does not ask whether the following word is a name a table holds: "Mouri"
is in neither table and is the one that matters. **Any capitalised word after
the name is a reason to stop.**

## The 殿 pass

**185 occurrences on 180 rows in 120 scenes**, and every one of them was read by
hand before it was written -- which is what the bucket was waiting for. 殿 is not
a second spelling of 様: it is what one soldier calls another and what an ally
calls Rance, so the speaker matters in a way the 様 pass could take on trust.
Every finding turned out to be the same shape -- `<name>殿` in the Japanese,
"Lord"/"Lady <name>" in the English -- and `-dono` is what the corpus already
wrote 184 times of its own accord. It writes it 369 times now.

`殿下` is the trap the reading did not have to catch, because there is none in
this bucket, and the guard is in `calls()` anyway: `mentions` protects the
katakana end of a word and leaves the other alone, so `リア殿` matches inside
`リア殿下` -- which is "Your Highness", a title, and answering it with an
honorific would be the same class of error as "Thunder-sama Emperor".

**One row was the reason to look at every row.** 「ドッス殿とワッス殿の二人は」
came back as "Lord Doss and Lord Wass", and only Doss is in the name table --
so the pass would have written "Doss-dono and Lord Wass" and left half a
sentence converted, which is the fault `fix_honorifics_untabled.js` exists for.
ワッス is not a guess either: it is Wass in `card_name_glossary.tsv` (as ワッス２,
the card Id, which is why `readNameIndex` skips it), in the master list of
`character_genders.md`, and six times in `summary_glossary.tsv`. It is now a row
in `mistranslated_names.json` beside Doss, with no misspellings listed, so it
renders nothing on its own -- checked -- and the pass can see it.

That row cost ten new complaints from the name checker, and they are a real
finding rather than noise: the corpus romanises the pair ドッスワッス as
"Dossuwassu" and "Dosswass" on ten lines, where `summary_glossary.tsv` has said
"Doss & Wass" all along. A different class, left for its own pass.

  effective map: 180 changed, 0 gone, 0 added, against 180 rows written
  overflow unmoved at 847 -- `-dono` is 165.75 units against `Lord ` at 155

## Where the name ends

`scripts/fix_honorifics_multiword.js`, and **22 of the 26**. The pattern matches
one capitalised word and the English name is two or three, so the guard that
refuses them is the reason "Thunder-sama Emperor" and "Fiend-sama Warg" are not
in the corpus. Where the name ends is a fact about the sentence: 魔人ワーグ様 is
"Fiend Warg-sama", 火炎書士様 is "Flame Scrivener-sama", 毛利てる様 is "Teru
Mouri-sama" with the two halves the other way round from the Japanese -- and
テラ様 is "Terra-sama" even though the guard fired, because the capitalised word
behind it was "I'll".

So the 22 decisions are carried in the script, one row apiece, the way
`fix_honorifics_untabled.js` carries its names. Each row carries the Japanese
that licenses it and the script checks that against the speech before writing,
so a line number that moves stops the pass instead of rewriting whatever now
sits at it. Two are worth reading twice: 「魔剣カオスさん」 is さん and the only
`-san` in the list, which any rule that trusted the bucket would have written
`-sama`; and 「あ、あ、カチューシャ、さ、ま……」 stutters the honorific itself
across two commas, so the string that licenses it is the stutter.

**Three of the twenty-six are not honorifics at all.** 前四天王パパイア・サーバー,
四天王チョチョマン・パブリ and 魔王ランス carry no 様 anywhere near them: the "Lord"
there translates 四天王 and 魔王, which are ranks. A fourth turned out to be a
misspelling first -- 「ケイブワン様」 read "Lady Kabe One", and writing the
honorific onto it would have baked the misspelling a layer deeper.

  effective map: 22 changed, 0 gone, 0 added, against 22 rows
  overflow unmoved at 847

## The rows that cut an address in half

`scripts/fix_honorifics_wrapped.js`, and **14 of the 16**. The English wraps
where the Japanese does not, so "Lord" ends one row and the name opens the next
and no row holds the phrase -- which is the same blindness a wrapped name has
always had here, and the reason a substitution pass cannot be the only pass.

The edit is spread over the two rows rather than laid out again: four of these
speeches are the long scenario blobs, one of them 14 rows, and re-flowing a
bubble to move five characters buries the change. What that costs is the width,
because this is the one honorific edit that does not keep it -- the first row
gives up `Lord ` and the second takes the whole of `-sama`.

**The question to ask there is the report's own, and asking a cheaper one got
it wrong.** A first guard refused any second row wider than the window and threw
out twelve of the fourteen, because ten of these sit in blobs whose rows run to
twice the window before anything is edited. `drawnLines` against `rowBudget`
over the whole speech -- what `find_speech_gaps` asks -- says the thing that
actually matters: a speech already over is not made worse by eleven units, and a
speech that fitted and then does not is a fault this pass created. One case is
the second kind, and it is left alone; `layOutSpeech` is the fallback for it and
does not fit either.

The other one left is a rank rather than a name. 魔物将軍様 wraps the same way
and reads "Lord / Monster General", and the corpus renders that rank plain
elsewhere -- `「魔物将軍様、バボラ様の本日の作戦が完了！」` is "Monster General,
Babolat-sama's mission for today is complete!". There is no settled honorific
for it, so it is a decision and not a substitution.

  effective map: 28 changed, 0 gone, 0 added, against 14 pairs of rows
  overflow unmoved at 847

## Two guards that were wrong first, and what they cost

**A look-back that steps over punctuation cannot tell a compound title from two
sentences.** `TITLE_WORDS` exists so that a speech saying ケイブリス様 once does
not licence "Demon Kayblis-sama" on its other sentence. Matching the nearest
word rather than the adjacent one filed five occurrences as compound titles, and
four of them were 「魔人……カミーラ、様」 and 「F-Fiend...! Lord Lei!」 -- two
sentences with the punctuation between them. The fifth was `ランス殿`, blocked by
"First," at the head of its own sentence, and it belonged in `dono`. Pinned to
the adjacent word, the bucket is empty and the five went where they belonged.

**Possessives are part of the match.** "Lady Hawzel's Demonic Blood Soul" wants
"Hawzel-sama's". A pattern that stopped at the apostrophe looked the name up as
"Hawzel's", found no table holding it, and filed every possessive in the corpus
under a name nobody has settled -- which is most of the difference between the
320 the first measurement reported as unknown and the 102 that are.

## What it cost the window

Four speeches that fitted before overflow after, and none stopped overflowing.
`scripts/bake_speech_rows.js` fits two of them by layout; `032281.tsv m[136075]`
and `033672.tsv m[251875]` hold more English than their rows can draw whatever
the layout and want shortening by meaning. They are in
`find_speech_gaps --class=overflow` with the other 845.

The two that fit by layout have been laid out, so the count reads 847. And the
other two are not this pass's doing at all -- every row of both was already over
the window before it. "What the window really said", below, is the measurement.

## The check

`scripts/effective_map.js` before and after, and the changed count held against
the rows the fixer wrote:

```
node scripts/regenerate_aai_txt.js && node scripts/effective_map.js save before
node scripts/fix_honorifics.js --bucket=sama --write
node scripts/regenerate_aai_txt.js && node scripts/effective_map.js save after
node scripts/effective_map.js diff before after
```

`1065 changed, 0 gone, 0 added` against 1065 rows written. The diff of the patch
cannot answer that -- a duplicate `s[N]` is invisible there and decisive in a
build -- and neither can the fixer's own post-condition, which is what the
bracket pass learned when it ate 15 tabs and every check it ran agreed with it.

## What this does not touch

`＜エール＞` is the token the game swaps for the name the player typed, and 20
occurrences read "Lady ＜エール＞" or "Lord ＜エール＞". The pattern here matches
`[A-Z]` and never sees them, deliberately: El's gender is the player's choice, so
"Lady" there is wrong on one of the two routes rather than merely unidiomatic,
and it is a bug with its own class rather than a member of this one.
`docs/player-name-token.md` is what else that token has cost.

The other half of the drift is bigger and is a different question: **5143
speeches whose Japanese carries 様 or さま have neither an honorific nor a title
in their English at all.** Nothing here reports those -- an honorific that was
dropped leaves no word behind to find it by, so the question has to start from
the Japanese rather than from the English.

## What the first pass then owed, and the two repairs that paid it

A review of all 1087 read 347 of them line by line and scripted the rest. The
pairing held everywhere -- every occurrence is a name a table spells and a 様 the
speech carries, and every `<Name>-sama` is the canonical spelling -- and no rank
was eaten: 四天王 is still "Four Lords" and 国主 still "ruler". Two things were
wrong, and both are now written in.

### The stutter still named the title

32 of the 1087 stood behind a stutter, and the letter was stuttering the English
word rather than the name: 「ヨ、ヨシフ様が！？」 had come back as "L-Lord Joseph!?"
and came out as "L-Joseph-sama!?", an L in front of a word with no L in it.

**The Japanese stutters the name.** ヨ、ヨシフ, ガ、ガルティア, け、ケイブリス,
ら、ランス -- every one repeats the name's own first mora, which is also what the
corpus does everywhere else: 3113 stutters agree with the word they stand in
front of and 147 do not. `modules/HonorificStutter.js` is the question and
`scripts/fix_honorific_stutters.js` wrote **21** of them. The other **11 needed
nothing**, because the name begins with L and the letter came out right by luck:
ル、ルメイ is "L-LeMay-sama" and り、リア is "L-Lia-sama". Which is why the rule
asks whether the letter agrees with the name rather than whether the pass touched
the row.

The rule is deliberately narrow. Asked of every mismatched stutter in the corpus
it reads 147, and 126 of those are not stutters at all -- "M-Land", "Ho-Raga",
"Yo-Zef" and "Vi-Lord" are hyphenated names, "GU-OHHHH" and "A-Hya" are noises.
A rule wide enough to catch those would rewrite a place name into "L-Land". The
honorific is what makes the question decidable: nothing else in the corpus puts
an L-stutter in front of a `<Name>-sama`.

### Two names no short-name table carries

Four rows named two characters who both carry 様 in one sentence and came out
with the honorific on only one of them -- 「レイ様、パイアール様！」 read
"Lei-sama, Lord Pi-R!" and 「メディウサ様がここを襲ってデスココ様を殺して」 read
"Lady Medusa attacked here, killed Descoco-sama". **A pass that converts half of
one sentence is worse than one that converts neither.**

Both names were in `unknown-name`, and neither is a guess. **パイアール is Pi-R**,
and the hyphen is the whole reason: `readNameIndex` admits `/^[A-Z][A-Za-z]*$/`
and `ADDRESS` matches the same shape, so "Lord Pi-R" was looked up as a name
called "Pi". **メディウサ is Medusa**, which has no short-name row in either table
-- only `メディウサメダル → Medusa Medallion`, a medal -- but is spelled out in
`glossaries/character_genders.md` and in `glossaries/enemy_party_glossary.tsv` as
`魔人メディウサ → Fiend Medusa`. Settled, just settled somewhere the pass does not
read.

`scripts/fix_honorifics_untabled.js` closes the two names rather than only the
four rows where the split shows: **24 occurrences on 24 rows**, which is what
took `unknown-name` from 102 to 78. It carries the two pairs explicitly, because
a table it read would be a table the pass should have read instead.

### What the window really said

The pass looked like it took overflow from 845 to 849. Two of those four --
`032825 m[180551]` and `032836 m[181137]` -- were a layout, and
`scripts/bake_speech_rows.js` fitted them into the rows the bytecode gave them.

The other two are **not this pass's doing**, and the count said so only because
it counts drawn lines rather than width. `032281 m[136075]` was 2 rows of 2 over
1194 before the pass and 2 of 2 after, and its widest row did not move at all --
1774 either way, because the honorific sits on the other row. `033672 m[251875]`
was 13 rows of 13 over, and its widest went 1766 to 1772, six units onto a row
already 572 over. Both were already in the 839 that `docs/speech-gaps.md` says
hold more English than their rows can draw whatever the layout. They want
shortening by meaning like the rest of that list, and nothing about the
honorific put them there.

### What the review found and did not change

**Gender.** The pass drops a gendered title, so it was worth asking what the
title had been carrying. On **80 occurrences it was carrying a lie**: "Lady
Lexington" 32 times over a man, "Lord Gandhi" 14 times over Magic the Gandhi,
"Lord Kaybnyan" 8, "Lord Hawzel" 6, "Lord Hornet" 6. On 22 names the corpus had
used both titles for one character, so the title was never a signal to begin
with. Three rows of `glossaries/character_genders.md` had asked for a title in
so many words -- "use Lord Lexington", "Lord Kesselring throughout", "fix to
Lord LeMay" -- and now say what happened to it instead. Kesselring is the case
that argues for the honorific on its own: the character's sex changes late in the
story, and `Kesselring-sama` is the one rendering that does not have to know
which side of that a scene is on.

**Self-reference is not a fault.** 「このランス様が」 comes out "This Rance-sama"
and 「俺様はランス様だ」 comes out "I'm Rance-sama", which reads oddly in English
and is nonetheless what this corpus already did in rows the pass never touched --
`030888 m[37906]`, `032816 m[179448]`, `032920 m[188798]`, `033372 m[232162]`,
`033543 m[250676]`, `033159 m[208857]`. The pass brought six more rows into line
with a convention rather than inventing one, so there is nothing here to repair
that is not a decision about all of them at once.

**`Descoco` has no gender anywhere.** 33 occurrences, no row in
`character_genders.md`, and no card row to read a 性別 out of -- only
`48_立ち絵名札マッピング情報.x`. `-sama` is neutral, so the pass cost nothing here;
the gap is worth closing on its own account.

**207 titled occurrences on 42 converted names are still in the corpus**, which
is the price of the buckets the first pass left. `Kouhime` is the one worth a
look: 12 with a title against 11 with the honorific, the only name where a
partial pass left the title in the majority.
