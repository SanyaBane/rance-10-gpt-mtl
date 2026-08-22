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

17 untabled, 13 tabled and 57 named in split; 7, 6 and 21 in odd. All three
buckets have been worked through since; **what is left is 9, 4 and 25 in split
and 7, 6 and 22 in odd**, and every one of those is on a list below of things
left in on purpose.

### tabled

**Closed.** Twelve terms and 216 corpus lines in `60f7d8cd`,
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

### The two role words it was written for

`bcbb913`, and two more under them. 96 corpus lines and 5 cherry-picked slots.

| Term | Settled on | Was |
|---|---|---|
| `総統` | `Supreme Leader` | `s[10623]`'s World Leader, plus "the Great General of the World", "Commander," and "under General Rance" |
| `大将軍` | `Great General` | Supreme General 3, Fiend General 2, Generalissimo 5, and one invented "General Rumei" |
| `総統司令部` | `the Supreme Leader's Headquarters` | fourteen forms over 68 lines |
| `自由都市連合軍` | `Free Cities Alliance Army` | Alliance Forces 17, allied forces 3, United Army 1 |

`総統司令部` had no canon anywhere and the shape of one: `mistranslated_names.json`
gives `総統府` "Supreme Leader's Office", and the largest single corpus form was
already "Supreme Leader's headquarters". "Supreme Headquarters", the other
ten-line form, could not have been taken -- `m[64851]` renders 総統府 with it.
`自由都市連合軍` went to Army because X軍 is X Army here: 魔軍 is the Monster Army
and 自由都市軍 the Free Cities Army in `s[14981]`.

### untabled

`d3cca67a`. Nine real findings out of 17, 242 corpus records and twelve rows
elsewhere -- and four of the nine needed no decision, because the answer was
already written down and only the corpus disagreed. That is the same reasoning
`docs/name-checker-calibration.md` gives for `El` and `Richelle`, and it turned
out to be the rule rather than the exception.

| Term | Canon, and where it was already written | Was |
|---|---|---|
| `アレフガルド` | `48_立ち絵名札マッピング情報.x`, summary x8 | Arefgard 49, Aregalud 22, Alefgarud 11, Aregard 8, Arefugaldo 4 |
| `毛利` | `41_識別名情報.x`, 32 times | Mori 30 |
| `カイズ` | summary x5, `6_クエスト情報.x` | Kaizu 18 |
| `ガイ` | `enemy_party_glossary.tsv`, summary x2 | Guy 35 |
| `北条` | `41_識別名情報.x`, and the name table's `Houjou Suzu` | Hojo 23 and three slots |
| `ククルククル` | a decision | Kukurukuru 11, Kukuru Kukuru 7, Kukrukuru 3 |
| `ラレラレ石` | a decision | Larerare 7, Lalalare 6, Lalelare 5, Rare-Rare 4, Lare Rare 3, Lalalai 2 |
| `副将` | the labels only | seven Ｔ肩書き slots hyphenated where `9_カード情報.x` writes it plain |

Nine remain in that bucket and a rerun shows the same nine. `軍司令部` is not a
name but the suffix of half a dozen armies' headquarters, and its only split is
`summary_glossary.tsv`'s "Monster Army HQ" against the prose's "Monster Army
headquarters" -- the panel's abbreviation, like "Mt. Shoryu". `兄様`, `帝国`,
`試練`, `達成`, `内容若干変化`, `上杉軍`, `防衛隊` and `連合軍` are the noise this
file already describes.

### named

`4ff39af6` and `3e05d2c1`. 54 findings, 880 corpus records and twenty table
rows. Two dozen were a lookup rather than a decision -- 元就 is Motonari on the
standing portrait's plate, 早雲 is Souun in the name table, 日光 is Nikkou in
both -- and five were a decision because the repository wrote two answers in two
files: 松下姫 (Princess Panasonic against the plate's Princess Matsushita),
イカマン (Squidman against the plate's Squid Man), 女神アリス (Goddess ALICE, which
is what the *game* writes in Latin letters), 剣豪 (Swordmaster against three
tables' Kengo) and トー, whose two spellings sat on consecutive lines of one file:
`{ "ミラクル／", "Miracle Tor" }` and `{ "ミステリア／", "Mysteria Tou" }`.

`ザカリテ` is worth one note, because it shows what a check starting from the
text reaches that one starting from the table cannot. The table lists exactly one
misspelling for it, `Zakalite`, and that spelling is on **no** line of the corpus,
the glossaries or the cherry-picks. What is there is `Zakarite`, with an r, on 17
lines -- one letter away from the dead entry and unreachable from it.

Twenty-five remain in split and 22 in odd, and every one is a shape this file
lists as noise: a possessive or honorific tail the merge could not fold
(`Barres'`, `Zance'`, `Melfeis'`, `Poppins'`, `Pi-R'`), a plural beside its
singular (`Squidman`/`Squidmen`), a neighbouring rank (`魔物大元帥`'s Monster
Grand Marshal beside `魔物大将軍`'s Monster Great General), a bracketed label's
opening word (`Defeating`, `Army's Great Counterattack`), a title or a form of
address (`コルドバ`'s Blue General, `法王`'s Your Holiness), and the substrings of
words already settled (`衛隊`, `魔物大`, `将軍`, `魔軍`, `魔人`, `都市`).

### 魔女リクチェル

`b0daa07a`, the second of the two titled keys `docs/name-checker-calibration.md`
records. Split across the repository rather than only inside the corpus, and
most of that split was already right when read by purpose -- the full name on
the standing portrait's plate and the card's `フルネーム`, "Witch Richelle" on the
card plate, "the witch Richelle" on the synopsis panel. Two places did not fit:
six corpus lines writing the whole four-word name in prose, and the plate over
the enemy HP bar, at 852 pixels of the bar's 867.

## Four things the filter's own literal cost

**A phrase that contains the settled rendering is not the settled rendering.**
The count that settled `大将軍` asked whether a line held "Great General", and
"Demon Great General" holds it -- so 23 lines rendering 魔物 as Demon and 11
rendering it as Great were counted among the ones that agreed, and had to be
written back in `a202199`. Ask which word stands in *front* of the rendering,
not whether the rendering is there.

**A rendering that shares no word with the settled one is dropped.** `odd` keeps
a disagreement only when it brings a word the settled form does not have *and*
shares one it does, so `Generalissimo` against `Great General` was invisible to
the report and had to be found by reading the term's lines. It is the guard that
makes the bucket readable and it is also its floor.

**Sweep the glossaries too, and read the built file back.** Two sweeps ran over
the corpus and the cherry-picks and left the built patch still saying
"Blood Memory: Kukurukuru" and "Mysteria Tou" --
`glossaries/enemy_party_glossary.tsv`, `9_カード情報.x`'s `フルネーム` column and
skill 1562 of `11_スキルデータ.x`, none of which the report reads. A term is
finished when `alice ain dump -t` and `alice ex dump` no longer carry the old
spelling, not when the sweep says 0.

**A lookalike is not a misspelling.** `Keibuwan` is ケイブワン, Kaybnyan's dog,
and would have been swept into Kaybnyan by any filter working from spelling
distance alone; `ナイスガイブレード` is a nice guy and `ウォール・ガイ` is a wall,
neither of them 前魔王ガイ. Read the Japanese of every record a sweep is about to
touch.

**The counts are not invariants**, for the same reason the calibration file's are
not: they move with where each guard is drawn. What to trust is the shape.
