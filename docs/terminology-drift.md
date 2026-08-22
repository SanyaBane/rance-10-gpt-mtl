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

It reads the corpus, the cherry-picks, all eight glossaries and every `.x` table
under `archives/Rance10EX_v1_04/` -- 288 557 lines -- and needs neither
alice-tools nor `GAME_DIR`, because the Japanese of both the cherry-picks and
the tables is in a committed dump.

## The `.ex` tables, and the dump that makes them readable

The tables under `archives/Rance10EX_v1_04/` were translated **in place**: a
row's English sits where its Japanese sat, and the Japanese is gone. So for a
long time they were the one body of translated text nothing here could read as a
pair, and it cost two passes -- both sweeps of `docs/name-checker-calibration.md`
ran to 0 over the corpus and the cherry-picks while the built `.ex` still said
"Mysteria Tou" in a card's `フルネーム` and "Kengo" in skill 1562's name.

`game/ex/Rance10EX.v1.04.ex.txt` is `alice ex dump` of the game's own
`Rance10EX.ex`, committed for exactly this. Because the English was written over
the Japanese rather than beside it, our copy of a table and the game's hold the
same strings in the same order, and pairing them is walking both at once:
**10 293 pairs**, plus 1012 read out of the plate table's own rows. 6.6 MB on
disk, 643 KB packed, and 0.36 s on a run.

Positional pairing is exactly as strong as that alignment, so `readExPairs` in
`modules/TermDrift.js` refuses to guess. Two tables are named as deliberately
reshaped -- `41_識別名情報.x`, which `scripts/generate_card_names.js` writes an
`英名` into, and `48_立ち絵名札マッピング情報.x`, which carries a hand-added English
column and is therefore read row by row instead. Any **other** table whose count
stops matching is an error naming the file, because a row added without a fresh
dump would silently pair every string after it with the wrong Japanese.

| Table | Pairs | What they are |
|---|---|---|
| `9_カード情報.x` | 5145 | `フルネーム`, `職業`, `スキル` and the five `コメント` lines of every card |
| `11_スキルデータ.x` | 1883 | every skill's name and description |
| `5_クエストデータ.x` | 1880 | the `説明` of every quest node |
| `48_立ち絵名札マッピング情報.x` | 1012 | the plate over a portrait, keyed by the portrait |
| `6_クエスト情報.x` | 718 | quest names and the four `説明` columns |
| `43_秘書データ.x` | 566 | what the secretary says |
| `40_実績情報.x` | 72 | the achievement descriptions |
| `45_秘書情報.x` | 26 | the profile panel |
| `37_あらすじデータ.x` | 3 | three strings; the synopsis' English is in `glossaries/` |

**This is the half no key can reach.** A card's node is keyed by `"Lv42 ランス"`
and carries five `コメント` lines of prose; a skill is keyed by a number and
carries no Japanese anywhere. Pairing a key with the fields under it -- the only
thing possible without the dump -- gets the names and none of the prose, and
skill 1562 is keyed by nothing at all.

Two tables that look like they should be in the list are not: `3_マップデータ.x`
and `39_障害物データ.x` carry **no** English, 0 of 12 884 and 0 of 27 830
strings. What `grep` finds in them is identifiers outside the quotes.

**And a table's own label column is a new kind of noise.** `6_クエスト情報.x`'s
`説明１`--`４` are the lines the quest panel prints -- "Reward: Medal",
"Strong Party / Elem: Fire Dark" -- so a column co-occurs with itself and
reports `報酬`, `有利`, `所属` and `有利所属` as terms rendered several ways. They
are one label with several values, the same shape as the trophy glossary's
neighbouring rows.

**They come off now**, along with the other half of the same shape: a term that
is a *component* of several compounds rather than a word with several names.
`compoundOf` in `modules/TermDrift.js` asks what Japanese each rendering
actually sits in, and drops the finding when every one of them sits in a
different compound -- 倍率 is 物理倍率 "Physical Boost" beside 魔法倍率 "Magic
Boost", 難度 is 捕捉難度, 友好難度 and 命令難度, and 報酬 is the panel's own
label in front of six different rewards. It takes **16 findings off split**,
including three this file had already worked out by hand: 中島 as 中島君 against
川中島, 帝国 as the Copa Empire against the Squidman one, and 衛隊 as five
different guards.

Two things keep it safe. A rendering that ever appears with the **bare** term
keeps the finding, so 総統 -- whose 953 lines share nothing but 総統 -- still
reports `s[10623]`'s World Leader, and 格闘, the one real finding this report
has surfaced since, is still reported when the fix for it is taken back out.
And a leading or trailing kana is grammar rather than a compound: の魔人退治 and
で魔人退治 are one word carrying a particle, where 物理倍率 and 魔法倍率 are two
words sharing one.

**Only split can be asked this.** A disagreeing line in odd is one line, and the
longest string one line has in common with itself is the whole line, so every
odd finding would look like a compound. Asked of odd anyway it drops ベズドグ山
and アペムンタ村, which are one word apiece.

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
| a component of several compounds | 倍率 reads as seven renderings, and they are 物理倍率, 魔法倍率 and ＨＰ倍率 each translated correctly. Split only, and the paragraph above says why |

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
buckets have been worked through since, over the corpus, the cherry-picks and
the glossaries: **what was left there is 9, 4 and 25 in split and 7, 6 and 22 in
odd**, and every one of those is on a list below of things left in on purpose.

The `.ex` tables joined after that, and only part of what they brought has been
read. A run today reports **17, 7 and 27 in split and 6, 11 and 24 in odd**.
Before the component cut above it reported 32, 9 and 28 in split, so 16 of what
the tables brought was one label or one component read several ways. The lists
below are the residue of the three sources that *were* swept, so a finding
touching a `.x` file is new rather than deliberate.

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

**The bucket is wholly read now**, which no other one is. Seven findings remain
in split and every one is a shape this file already names: セキガハラ is not
drift, `翔竜山`'s 30 lines writing "Mt. Shoryu" are an abbreviation of the
settled name, ラグナロックアーク's "Royal Capital" is 王都 sitting next to it,
カスタム's "Four Witches" is 四魔女 sitting next to it the same way, 聖魔教団's
"The Holy Magic" is a phrase holding the settled rendering, and 神魔法's
"Throwing", "Blacksmith" and "Crafting" -- with 聖魔's "Crafting" -- are the
*other* skills on the same card's `スキル` line, one column listing several
values. 中島 was an eighth and is gone -- not swept but no longer reported, which
is what the component cut is for.

### 天界 was the last unread one, and the report showed two of its six renderings

`46258fed`. 36 lines, and `split` named `Heaven` x15 against `Heavenly Realm`
x4. Reading all 36 found four more: a lower-case `heaven` on two corpus lines,
`heavenly town` and `celestial town` for 天界の町, and -- on one card of
`9_カード情報.x` -- **the Gods Realm**, which is the wiki's own word.

Nothing had to be decided. `glossaries/summary_terms.tsv:51` settles 天界 as
Heaven, three `summary_glossary.tsv` rows and `enemy_party_glossary.tsv`'s
天界の壁 agree, and so do thirteen corpus lines. Thirteen places did not: eleven
corpus records, the plate row `{ "天界／", ... }` of
`48_立ち絵名札マッピング情報.x`, and that card.

**The wiki is not the table here, and its word is the one to refuse.** It has no
page keyed to 天界 and writes "Heavenly Realm" zero times; what it calls the
realm is `Gods Realm`, 24 times. Taking that would collide with 神々の国, which
`summary_terms.tsv:52` already renders "the Land of the Gods" and which the game
keeps as a separate place with a scene of its own, `５６５／神々の国`. 神界 is in
the game's dump 0 times against 天界's 87. This is the check
`docs/name-checker-calibration.md` asks for from the other side: a wiki page is
evidence for the term it is *about*, and two Japanese words cannot share one
English phrase on a surface where both appear.

**Two of the eleven were the synopsis panel disagreeing with the dialogue over
the same Japanese.** `summary_glossary.tsv:4036` renders `その頃、天界` "Meanwhile, in
Heaven" where `m[256942]` said "the heavenly realm", and `:4045` renders
`天界の町を探索` "Exploring the town in Heaven" where `m[256951]` said "the
heavenly town" -- the shape 鬼 had, at two lines instead of 181.

**Four rows keep the other word on purpose.** `11_スキルデータ.x:297`-`300` read
`対天界 効果大` as "Strong vs angels": there 天界 is the enemy attribute a skill
is strong against rather than the name of the place, and there is no 天界 among
the races in `game/extracted/race_names.v1.04.tsv`.

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

Six of the nine remain. `軍司令部` is not a name but the suffix of half a dozen
armies' headquarters, and its only split is `summary_glossary.tsv`'s "Monster
Army HQ" against the prose's "Monster Army headquarters" -- the panel's
abbreviation, like "Mt. Shoryu". `兄様`, `内容若干変化`, `上杉軍`, `防衛隊` and
`連合軍` are the noise this file already describes. The other three -- `帝国`,
`試練` and `達成` -- the component cut now drops on its own.

**One untabled decision was taken that this report could not have reached.**
魔素漢, the monster army's mass magic troops, is on **three** lines of dialogue
and nowhere else in the game -- not a card, not an enemy name, not a key -- so
it never met the 25-line floor `least` puts on a term. No glossary has it and
neither does the wiki: the word turns up once in a Japanese monster list for
Widenyo, and the English table beside it stops before reaching it. The scenes
are what named it. A 魔物将軍 plays them as his trump card, a thousand of them
fire from behind, Cordoba calls them 魔法使い, and in the labyrinth that drains
魔物の魔力 they are フラッフラ without doing anything -- so 魔素, the mana, is what
they run on. `32f2b831` writes **mana casters**, and says in as many words that
the place to change it is those three records.

Two of the three said "magic soldiers" before that, and the majority was not
available: 魔法兵 is Mage Soldier in five rows of `48_立ち絵名札マッピング情報.x`,
two of `9_カード情報.x` and ten of `card_name_glossary.tsv`, and the dialogue was
calling *them* magic soldiers too (`f471852f`, twelve records). **Two Japanese
words cannot share one English phrase on a surface where both appear**, which is
the same reasoning `docs/enemy-status-lines.md` gives for keying a glossary by
the Japanese, and it decided 格闘 as well: `6a418b65` took Martial Arts partly
because `9_カード情報.x:8425` is けんか -- "Fighting 2, Soccer 2" -- a different
skill that had been sharing the name on six cards. That one the report did find,
and it is the only real finding it has surfaced since it was written.

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
Grand Marshal beside `魔物大将軍`'s Great Monster General), a bracketed label's
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

### What is left of 魔物, and it is not small

`a202199` swept 魔物 out of Demon and Great **where it stood in front of a
rank**, which is the shape that commit's own count could see. Two other shapes
of the same word are open, and both were found by reading a chunk whole rather
than by any filter:

| Shape | Records | What it looks like |
|---|---|---|
| 魔物軍 rendered as a demon army | 8 of 24 | "the demon army's position", "Numerous demon troops" |
| 魔物 rendered demon anywhere else | **256** | 魔物兵 "demon soldiers", 魔物隊 "demon unit", 魔物 "demons" |
| 魔物大将軍 with the 魔物 simply **dropped** | **127 of 195** | "Great General Joseph" where 61 records already named the rank |

**All three are closed.** The second was a repair; the third was a decision and
then a correction.

The 256 were counted with every line whose Japanese also carries 魔王, 悪魔,
魔人, 神魔 or 魔族 taken out, so the word was not somebody else's, and the
corpus decided it: 1947 records already said monster against them, and every
table covering a 魔物 compound agrees — `race_name_glossary.tsv` has 魔物兵 as
Monster Soldier, `summary_terms.tsv` has 魔物隊長 as monster captain. 魔物界 went
to **Monster Realm**, which the corpus writes 232 times.

Two of the 256 are left standing, and they are the reason a sweep of this word
needs reading rather than counting: `m[140002]` says 魔物都市 in the Japanese and
"the Demon King Castle" in the English, and `m[217304]` says 魔物 and "the Demon
General Kayblis" — the clause moved across the line break and the English names
somebody else. Both are reached by the rank that follows them. Two more are not
魔物 at all: `魔素漢ども` reads "demon soldiers" in one record and `鬼部隊`, an
oni squad, reads "demon unit" in five. Those are open, and are their own words.

The 127 went the other way: **the 魔物 is part of the rank.** `魔物将軍` is
already a Monster General in `summary_terms.tsv` and
`enemy_party_glossary.tsv` has named the four over the enemy HP bar all along,
so the corpus was the only thing dropping it. `大将軍` standing alone stays
`Great General` — 86 records and `s[14832]`, Hubert of Helman, are human beings
holding a human rank — and the distinction is the game's own.

**Then the word order turned out to be wrong, which cost a second pass over the
same 220 places.** The rank was written "Monster Great General", taken from
`enemy_party_glossary.tsv`, which had it that way before any of this. The
AliceSoft wiki's page for the rank carries `Japanese=魔物大将軍` and writes
**Great Monster General** 92 times without varying it or ever lowercasing it,
and `9_カード情報.x` had a `職業` column saying exactly that the whole time. One
file in the repository was right and the sweep cited the one that was not.
`glossaries/mistranslated_names.json` carries 魔物大将軍 now, so the question is
settled where the other checks can see it.

The same wiki page lists **Stroganoff** among the five, which is why 魔物大元帥
is a post rather than a rank: he is a Great Monster General who additionally
held it. It is rendered `Monster Grand Marshal`, a short form of what the wiki
calls Supreme Commander of the Monster Army, because the achievements screen
pins its bonus flag to the eighteenth full-width character.

### 鬼 was written three ways, and the report found none of them

The largest single term this file has been used on, and the one it did **not**
find. `9ca08caa`, `00b965cd` and `73804a7e`, 181 corpus records and seven rows
of a table, and the counts in the report above did not move by a single finding
before or after any of the three. What found it was reading one scene whole.

290 corpus records use 鬼 for the creature rather than as a figure of speech,
and they were split **ogre 125, demon 64, oni 51**, with 48 more reaching for a
pronoun or losing the word to a wrap and two carried by the rank alone. A
three-way split at that scale is invisible to `odd`, which wants a settled
majority and a handful of disagreements, and it survives `split`, whose
coverage cut reads 鬼 as a word the renderings barely cover -- 鬼 is inside
鬼畜, 剣鬼, 悪鬼羅刹 and 百鬼夜行, and those carry "demon" perfectly correctly.

**The scene is what showed it.** The 211/5 scenario notes call the same unit Oni
from `m[255331]` to `m[255350]` and a demon from `m[255353]` on, and the flip is
exactly the boundary between `255350_255410.json` and `255410_255470.json` --
the middle band `docs/name-checker-calibration.md` describes, where the model
held one word for the length of a chunk and another for the next. `m[255348]`
and `m[255362]` carry the *same* Japanese, なんとか鬼部隊を撃退する, and read two
different ways.

**Nothing had to be decided, and the corpus's own majority was the wrong side.**
`glossaries/summary_terms.tsv` has 鬼 as oni; `glossaries/enemy_party_glossary.tsv`
has Oni, Immobile Oni, Nana-san Dake Oni and Great Oni Kougyoku;
`glossaries/summary_glossary.tsv` writes oni on twenty rows including the very
scenes the corpus was calling ogres -- 「ナナサンダケを鬼が食べていた」 is "An oni
had been eating them" there and "those ogres eat it regularly" in the dialogue.
The AliceSoft wiki settles it past argument: **Oni 506 times across the mirror
against 44 Ogre**, and those 44 are almost entirely other games -- DALK, Pastel
Chime, Beat Wars -- where an Ogre is a different creature. The species has a
page of its own, and what the Rance-world "ogre" it does use amounts to is
lowercase prose on two older pages about the same thing.

**Three names came out of it that no table here had.** The wiki's page for 鬼王
is titled Oni King, where `m[163426]` said "become the Ogre King". Lexington's
page carries `Race = Oni (former)`, where the corpus wrote "ogre Fiend" 13 times
against "oni Fiend" 6. And `m[220765]` had lost the name as well as the race,
reading "a Great Demon... Oni Gyoku..." for 大鬼-ｵｵｵﾆ-コウギョク, where
`enemy_party_glossary.tsv` had said Great Oni Kougyoku all along; the built
`.ain` now spells it the same way in the dialogue, on the synopsis panel and on
the plate over the enemy HP bar -- `m[221471]`, `m[259115]` and `s[16081]`.

**And seven rows sat where no sweep of the corpus reaches.** 青鬼, 赤鬼, 毒鬼 and
four A/B variants were Blue Ogre, Red Ogre and Poison Ogre in
`archives/Rance10EX_v1_04/48_立ち絵名札マッピング情報.x`, which is handed to
alice-tools as it stands. The wiki's own gallery of the species names them Blue
Oni and Red Oni. They are not card keys -- `npm run regenerate-card-names`
rewrites `41_識別名情報.x` byte for byte identical -- so nothing downstream moved,
which is worth knowing rather than assuming: it is checked by running it.

**Fourteen records keep the other word on purpose**, and every one of them is
decided by reading the Japanese rather than by any filter:

| What it is | Where |
|---|---|
| a human being called 鬼 -- 人間じゃねえ, in the 剣鬼 scenes | `m[23937]`, `m[23938]` |
| abuse aimed at a person: "you brute" | `m[88034]`, `m[121108]`, `m[142573]`, `m[158586]` |
| 鬼にも修羅にも and 復讐の鬼, both set phrases | `m[91915]`, `m[163615]` |
| 鬼の方角, which is 鬼門, a compass direction | `m[237540]` |
| 鬼 beside 悪魔, where the demon is the 悪魔 | `m[31401]`, `m[88021]` |
| 殺人鬼 the murderer, beside 魔王 the Demon King | `m[166025]` |
| 鬼神 a fierce deity, 悪鬼羅刹 a monster of a man | `m[24146]`, `m[137336]` |

**The fifteenth was not keeping the word, it was a different mistake wearing the
same clothes** (`b40bfef7`). `m[86734]` is 「缶蹴りだ！　鬼はシィーーーール！」 and read
"Kick the can! The demon is Siiiill!". 缶蹴り is kick-the-can and its 鬼 is
whoever is **it** -- a role in a children's game, which is why neither Oni nor
demon is the word and why the sweep left it standing: swapping one noun for
another cannot fix a line that has to be re-said. It reads "Kick the can!
Siiiill is it!" now, which is the English playground word for the same role.
Nothing else in the corpus needed it: 鬼ごっこ is "tag" on all nine of its lines
and かくれんぼ "hide and seek" on all three, and 缶蹴り occurs exactly once.

**No entry goes into `glossaries/mistranslated_names.json` for this, and that is
the point rather than an omission.** A 鬼 → Oni entry listing "ogre" would fire
on any line whose Japanese carries 鬼 and take the word off the two epithets at
the bottom of that table at the next build -- exactly what 魔人's `"Demon"` did
to 前魔王ガイ in 71 lines, which `docs/baked-name-repairs.md` records. 鬼 already
has a home in `summary_terms.tsv`, and 鬼王 needs none: the game's dump has no
鬼王 in it at all.

Two things this pass cost that generalise. **A lookalike is one Japanese word
away.** `m[157855]` reads "That Kayblis ogre" for ケイブリスのオジャラゴン, which
is not 鬼, and has no 鬼 in its neighbours either -- a sweep working from the
English alone eats it. And **a sweep that changes a word's opening sound has to
fix the article**: "a demon" becomes "a Oni" under a blind swap, because Oni
opens on a vowel where demon does not. Five records, and no check in this
repository would ever have reported them.

## Five things the filter's own literal cost

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
skill 1562 of `11_スキルデータ.x`. The report reads all three now, and only one
of the three was ever a gap in what it reads: the glossary was in it the whole
time and the sweep did not open the file. A term is finished when
`alice ain dump -t` and `alice ex dump` no longer carry the old spelling, not
when the sweep says 0.

**A lookalike is not a misspelling.** `Keibuwan` is ケイブワン, Kaybnyan's dog,
and would have been swept into Kaybnyan by any filter working from spelling
distance alone; `ナイスガイブレード` is a nice guy and `ウォール・ガイ` is a wall,
neither of them 前魔王ガイ. Read the Japanese of every record a sweep is about to
touch.

**One Japanese spelling is not the term.** A term measured by hand is measured
by grepping *a* spelling of it, and the game writes its own words several ways.
`ハニめし` is on three records, which read like the whole of it; the food is also
`ハニメシ` on five, `ハニ飯` on one and `はに飯` on one, and the class is ten
(`b489b1d3`). Nothing reported the gap -- the report never surfaced this term at
all, at three lines or at ten, because it never met `least`'s floor.

What found the other seven was "read the built file back" above, run after the
sweep had already said 0. That step is the only one that sees the class rather
than the query, which is worth knowing before it gets treated as a formality.
Before grepping one spelling, ask the dump for the kana, the kanji and the mixed
forms -- 飯/めし/メシ here -- and count what comes back.

**The counts are not invariants**, for the same reason the calibration file's are
not: they move with where each guard is drawn. What to trust is the shape.
