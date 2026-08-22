# Finding a second name for something, without a table

Every check in this repository starts from a glossary. `createNameChecker` in
`modules/NameNormalizer.js` knows the names in
`glossaries/mistranslated_names.json`; `createTermChecker` in
`modules/SummaryLines.js` knows the 182 words in `glossaries/summary_terms.tsv`
and `scripts/find_dropped_terms.js` asks them of everything else. A title, a
place or the word a role is called that is in neither table gets no report from
anywhere -- and terminology drifts exactly the way names do.

総統 is the example that was visible at all, and only because a role word landed
in a table of names by accident: the table, `glossaries/summary_glossary.tsv` and
1044 of its 1155 lines say Supreme Leader, and `s[10623]` of the cherry-picks
says World Leader. Every word *not* in a table was in the dark.

`scripts/find_term_drift.js` is that dark half. `modules/TermDrift.js` has the
method; this is what the method costs to read and what its first run found.

```
node scripts/find_term_drift.js                 # both reports
node scripts/find_term_drift.js --bucket=tabled # only words summary_terms.tsv has settled
node scripts/find_term_drift.js --term=総統      # everything known about one word
```

## The idea

A term is a Japanese substring. Its rendering is an English phrase that turns up
almost only on the lines carrying that substring -- "Supreme Leader" is on 972
lines and 953 of them say 総統, which no dictionary had to state. Drift is a term
with two such phrases.

It reads the corpus, the cherry-picks and all eight glossaries -- 277 252 lines
-- and needs neither alice-tools nor `GAME_DIR`, because the cherry-picks'
Japanese is in the committed dump.

## Not the question find_dropped_terms asks

That one asks whether a settled English word is **absent**, which cannot tell a
line that called the thing something else from one that used a pronoun, wrapped,
or was a caption too short to fit the word. ラグナロックアーク is "44 dropped" there,
and that 46 of its 67 lines write a spelling `summary_terms.tsv` does not have is
said nowhere. Both stay; neither replaces the other.

## Two reports, because drift has two shapes

**split** is a term rendered two ways at scale, which finds a scene translated
the other way -- the shape the middle band of the name slice has.

**odd** is a term that has settled and the few lines that disagree with it. This
is the shape 総統 has: the minority is one slot, and no count-based filter will
ever surface it. A line "carries" the settled rendering when it carries that
whole phrase, and what is worth reading among the rest is a phrase bringing a
word the settled form does not have -- "World Leader" against "Supreme Leader"
is that, "he" is not, and neither is "Mouri's" against "Mouri Army".

## What has to come off, and what it costs

Four of these are the same shapes `docs/name-checker-calibration.md` lists for
names. The fifth is the opposite of one of them and cost the most.

| What comes off | Without it |
|---|---|
| a rendering split across n-grams | the loudest finding is "Fiend Extermination" against "Extermination Squad", one phrase through a four-word window |
| a term reported once per substring | 魔人討伐隊, 魔人討伐 and 人討伐隊 say the same thing thirteen times over |
| a possessive or an honorific | "Supreme Leader's Office" holds "Supreme Leader" by no plain test, and eight lines of 総統 read as disagreements while saying exactly what it settled on |
| a word that is not a term | 成功 is on 206 lines and its renderings covered nine, because what they co-occur with is a trophy list. Coverage is the cut |

**A capital at the start of a phrase proves nothing -- but a second capital
does.** The calibration file's rule, applied whole, drops every phrase at an
opening, and that dropped `World Leader`: the one line the whole exercise was
written to find. Ordinary English capitalises only the first word of a sentence,
so a **multi-word** capitalised run is evidence wherever it starts, and a lone
capital at an opening still is not.

**Katakana is not kanji.** A kanji run genuinely nests -- 魔人討伐隊 holds 魔人 and
討伐隊 and both are words -- so every substring of one is a candidate. A katakana
run does not: ーリ is inside both チューリップ and ダーリン, which is what
`mentions()` refuses. A katakana term is the whole run, split at the middle dot.

## What it is not

Not a verdict. A term is often two things -- 帝国 is the Copa Empire and the
Squidman Empire, 中島 is 中島君 and 川中島 -- a caption is short on purpose, and
neighbouring rows of a trophy glossary co-occur with everything. What the report
is for is the second name for one thing, which no amount of reading the files one
at a time turns up.

## Three buckets

Findings are split by which table already has a word for the term, because the
three want different things done about them.

| Bucket | What it is |
|---|---|
| **tabled** | `summary_terms.tsv` settled the word and something disagrees. No canon to decide -- look it up |
| **untabled** | nothing anywhere has a word for it. The blind spot proper, and a decision |
| **named** | a character name drifting in a spelling `mistranslated_names.json` does not list, so the name pass cannot reach it |

Names are separated rather than dropped: they have their own table and their own
pass, but a name drifting *outside* that table is exactly what nothing else
reports.

## The first run

17 untabled, 13 tabled and 57 named in split; 7, 6 and 21 in odd.

**The tabled bucket is closed.** Twelve terms and 216 corpus lines in `60f7d8cd`,
eight cherry-pick slots in `25fe381d`, 聖女モンスター in `38e519c7`, and three the
sweep's own literal walked past in `fd60f026`.

| Term | Table | Was |
|---|---|---|
| `ラグナロックアーク` | `Ragnarok Arc` | Ragnarock Ark, Ragnarok Ark, Ragnaro Arc, Ragnarock Arc |
| `自由都市連合` | `the Free Cities Alliance` | Free Cities Allied, Free Cities Union, Allied Free Cities |
| `パランチョ王国` | `the Kingdom of Parancho` | Paranchou, Palancho |
| `ハイパービル` | `Hyperville` | Hyper Building, Hyper Bill |
| `テニアン` | `Tinian` | Tenian, on every corpus line there was |
| `リッチ` | `Rich` | Ritch, Richie, Lich |
| `番裏の砦` | `Fort Banura` | Banri, Banri no Toride, "the fortress at the back of the gate" |
| `聖櫃` | `the Sacred Ark` | Holy Ark, on the whole of the corpus |
| `翔竜山` | `Mount Shoryu` | Soaring Dragon Mountain, Dragon Mountain |
| `妖怪王` | `Youkai King` | Yokai King, Monster King, Demon King |
| `聖女モンスター` | `Holy Gal Monster` | seven renderings, Saint Monster the commonest |
| `ベズドグ山` | `Mount Bezdog` | Bezudog |
| `タンザモンザツリー` | `Tanzamonza Tree` | Tanzamont Tree |

Four remain in that bucket on purpose, and a rerun shows the same four: 中島 and
セキガハラ are not drift, `翔竜山`'s 30 lines writing "Mt. Shoryu" are an
abbreviation of the settled name rather than a disagreement with it, and
ラグナロックアーク's "Royal Capital" is 王都 sitting next to it.

**Two of the repairs were worth more than a spelling.** リッチ is the Leazas city
of Rich and four lines called it Lich, the undead -- one of them the war report
a player reads. And 妖怪王 was written "Demon King" twice, which in this world is
a different person: the hazard `docs/baked-name-repairs.md` records for 魔人's
`"Demon"`, where 前魔王ガイ shipped as "the former Fiend King Guy" in 71 lines.
That rule fires only where the line does not also say 魔王.

**Repair the spelling of the name, not the phrasing around it.** "Banura
fortress" against the table's "Fort Banura" is a caption's wording and the
panel's width; "Banri" is a second name. The exceptions are where the phrase
*is* the second name -- Dragon Mountain for 翔竜山, Hyper Building for ハイパービル,
and the seven ways 聖女モンスター was written.

## What is still open

**untabled**, the blind spot proper, where the canon is a decision rather than a
lookup:

```
アレフガルド  Arefgard 33 | Aregalud 8 | Alefgard 6
毛利         Mouri 83 | Mori 25
北条         Hojo 22 | Houjou 12
カイズ        Kaizu 16 | Kaiz 9
ガイ          Gai 39 | Guy 29
ククルククル   Kukurukuru 10 | Kukuru Kukuru 7
ラレラレ      Larerare 5 | Lalelare 4
副将         Vice General 20 | Vice-General 7
```

**named**, 57 of them, where the name table has the character and not the
spelling:

```
元就       Genjo 42 | Motonari 41 | Motoharu 12
アルカリア  Alkaria 15 | Arcarie 11 | Arukaria 9 | Arkalia 7
早雲       Souun 62 | Hayakumo 40
五十六     Isoroku 32 | Issun 13
ザカリテ    Xacalite 25 | Zakarite 10
バファムーン Bafamoon 30 | Baphamun 9 | Bafamun 4
日光       Nikkou 184 | Nichirin-san 49
満鉄       Mantetsu 16 | Mitsutetsu King 10
リリム      Lilim 28 | Lilith 14 | Lilimu 4
女神       Goddess ALICE 37 | Goddess Alice 18
イカマン    Ikaman 23 | Squidman 8
松下       Matsushita 27 | Princess Panasonic 7
野菊       Nogiku 22 | Nozomi 5
```

`ザカリテ` is worth one note, because it shows what a check starting from the
text reaches that one starting from the table cannot. The table lists exactly one
misspelling for it, `Zakalite`, and that spelling is on **no** line of the corpus,
the glossaries or the cherry-picks. What is there is `Zakarite`, with an r, on 17
lines -- one letter away from the dead entry and unreachable from it.

**The counts are not invariants**, for the same reason the calibration file's are
not: they move with where each guard is drawn. What to trust is the shape.
