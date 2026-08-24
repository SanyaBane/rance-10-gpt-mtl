# Finding the word before somebody invents an English for it

`scripts/find_term_drift.js` asks whether the patch already calls one Japanese
word two English things. That question needs the word to have been translated
twice, which means it needs the translation to exist. A retranslation asks the
question the other way round and asks it first: **which words are about to be
handed to a translator with no English attached at all.**

```
node scripts/find_unnamed_terms.js                    # the report
node scripts/find_unnamed_terms.js --bucket=unsliced  # only the ones a glossary already answers
node scripts/find_unnamed_terms.js --term=ホルス       # everything known about one word
node scripts/find_unnamed_terms.js --lines=6          # more of the scenes it stands in
node scripts/find_unnamed_terms.js --plain            # the half with no rendering to rank by
```

`modules/UnnamedTerms.js` has the method. It reads `build/scenes/<lang>/`, which
`npm run extract-scenes` writes, and needs neither alice-tools nor `GAME_DIR`.
10 seconds over 5434 files.

## Why it is a separate question

`modules/ScenePrompt.js` cuts a glossary slice per scene: it prints the rows
that scene's Japanese names, and a word no row covers is simply absent from the
prompt. The translator then writes something plausible, and the next scene's
translator writes something else plausible.

Four terms came out of reading the output of **one** scene, 032194:

| Term | In the game | What happened |
|---|---|---|
| `聖女(の子)モンスター` | 7 scenes | three agents in a row invented three Englishes |
| `ホルス` | 42 scenes | all three agreed, by luck rather than by process |
| `LP*年` | 9 uses | four spellings across five versions |
| `大陸` | 74 scenes | three runs of three wrote it lower case |

`聖女モンスター` is the shape worth keeping in mind. It had been settled in
`glossaries/summary_terms.tsv` the whole time; the game writes 聖女**の子**
モンスター, the substring did not match, and nothing said so. A check that starts
from a table cannot report the row that failed to fire.

## What a finding is

**A term is a Japanese substring** -- the same candidates `modules/TermDrift.js`
generates, every substring of a kanji run and a katakana run whole, plus the
Latin runs the game writes in the middle of Japanese. That last class is not a
detail: `ＪＡＰＡＮ`, `LP7年`, `ＩＦ` and `DD` are terms and no kanji or kana rule
reaches them.

**A term is blind in a scene** when nothing that scene's prompt carries says
anything about it. Three things can cover it, and the third is easy to forget:

| Cover | What it is |
|---|---|
| a glossary row the speech mentions | the three tables `ScenePrompt` slices, by `mentions()` |
| a name-table entry | `mistranslated_names.json`, the same way |
| **a cast line** | the scene's own speaker list, which prints every speaker's Japanese beside the English name |

The cast is a glossary of its own and it is scene-wide -- it names a speaker
whether or not the speech in hand is theirs. It takes 志津香 from 173 scenes
down to 58, and those 58 are the scenes where she is talked about rather than
talking. Her name is in no glossary under that spelling at all: the name table
has `子供志津香` and the card table `志津香２`.

A key covers a term **either way round** -- a key inside the term (`法王特典`
answers 法王 where the line carries the compound), a term inside the key
(`子供志津香` answers 志津香). What neither direction reaches is a key and a term
that overlap without containing each other, which is `聖女モンスター` against
`聖女の子モンスター`, and is the whole reason this file exists.

**Blindness is counted per scene, not per line.** A word said forty times in one
scene is one decision; a word said once in each of forty scenes is forty
decisions taken by forty translators who cannot see each other.

## The rendering, which is the cut that makes it readable

A term's rendering is what the draft calls it, measured the way `TermDrift`
measures one: a capitalised English phrase that turns up almost only on the
lines carrying the term, at 0.85 precision and four lines of support.

Without it the report is some **5750 terms** and its top is 出来, 本当, 人間,
自分, 世界 -- ordinary Japanese, which no glossary will ever have a row for and
none should. With it, and with the rendering required to reach 35% of the term's
blind speeches, it was **167** on the first run, and they were proper nouns.

Two halves of that measurement do different jobs and it took a pass to see why:

**The rendering is counted over every speech carrying the term.** 志津香 is blind
in 58 scenes of 173, and "Shizuka" is what the other 115 call her. Counting only
the blind ones would lose the name of every character who is sometimes in the
cast.

**How far it reaches is counted over the blind speeches alone.** 都市 renders
"Free Cities" 301 times and every one of those is 自由都市連合, which
`summary_terms.tsv` settled and the slice hands over; what is left blind is 195
scenes calling a city a city. Measuring reach over all of them reported 都市,
自由, 大将, 討伐 and 将軍 -- five compounds already answered, read one component
at a time.

## What comes off, and what it costs

| What comes off | Without it |
|---|---|
| the English first person | `I` is the one word ordinary English capitalises mid-sentence, so 俺様 is reported in 999 scenes with "I" x428, and so is every other pronoun |
| a katakana run of punctuation | `・・` and `・・・` are the dialogue's dot leaders and turn up in 653 scenes apiece with the whole cast as their rendering |
| the runtime substitution tokens | `＜エール＞` is the name the player typed. `ScenePrompt` keeps it out of the slice deliberately, so its absence is not a gap |
| terms blind in the same scenes | one word seen through several windows: 令部 and 司令 are both 司令部, 天王 and 四天 are both 四天王 |
| a term inside a kept one, reaching the same scenes | 北条早 under 北条早雲, 毛利元 under 毛利元就 |

The nest fold asks `compoundOf` for the longest string every speech **carrying
the rendering** shares, rather than every blind speech. That is the question --
which Japanese does the English belong to -- and it is also what makes the fold
work at all: a term that happens to stand alone somewhere would otherwise report
itself and the nest would stay open. It is what turns 合軍 into 連合軍, 衛隊 into
親衛隊, 鬼畜 into 鬼畜王戦争 and 異変 into 神異変.

## Two buckets, because the repair is different

| Bucket | What it is | The repair |
|---|---|---|
| **unknown** | nothing in the repository has a word for it | a decision -- and read `docs/terminology-drift.md` first, because two thirds of its untabled bucket turned out to be already written down somewhere |
| **unsliced** | a glossary has the word and the prompt cannot reach it | one row copied into `glossaries/summary_terms.tsv` |

The copy goes into `summary_terms.tsv` and not into the file that already has
the word. The slice is cut from three tables and nothing else, and widening it
is a change to every prompt.

The unsliced bucket was 12 entries on the first run and every one of them was a
name the game says out loud: 総統司令部, 魔王城, ミックス, ダークランス, 元就,
ウズメ, 魔王美樹, ルドラサウム, 松下姫, ストーンガーディアン, ブロビオ, 元帥. It
is 0 now.

## Calibrated on the four it was written for

Restore `glossaries/summary_terms.tsv` to `b829c0dc~1` -- the state before last
session wrote those four terms in -- and run it:

```
git show b829c0dc~1:glossaries/summary_terms.tsv > glossaries/summary_terms.tsv
node scripts/find_unnamed_terms.js
git checkout -- glossaries/summary_terms.tsv
```

Three of the four are in the report: `ホルス` blind in 39 of 42 scenes with
"Horus" x49, `LP` blind in 8 of 8 with "LP" x8, and `聖女` blind in 18 of 56
with "Holy Gal Monster" x33 -- which is `聖女の子モンスター`, reported under the
kanji run because the compound is kanji, kana and katakana in turn and no single
run holds it.

The fourth is not, and that is the next section.

## The first pass: 167 findings, 101 rows, and one guard

`34c250f5` through `006d63ad`. The report went 167 -> 149 -> 135 -> 117 -> 108 ->
99 -> 73 -> 70 -> 49, one class per commit, and every row landed in the last
section of `glossaries/summary_terms.tsv` rather than in the name table -- an
entry there is also a repair pass over a corpus that is already baked, which is
the hazard `docs/baked-name-repairs.md` records.

**Almost nothing had to be decided.** The tables answered 90 of the 101 rows,
one key further out than the term: `子供志津香` and `志津香２` for Shizuka,
`Lv10 親衛隊` for the Royal Guard, `魔物将軍ダルソン` for Darson, `副官／` for
Adjutant, `村　ルールーハンデル` for Ruuruhandel. That is the same finding
`docs/terminology-drift.md` reports for its untabled bucket, from the other
side: the answer is usually already written down, in a file the prompt does not
open.

**Where they disagreed, the older source was usually right.** ジオ is The-O, not
the draft's Geo -- `9_カード情報.x:5096` is `職業 = "The-O City Mayor"`, and the
wiki's thirty Geo hits are another game's park. アウトバーン is a surname on the
wiki's DX Association page rather than the road the draft heard. 副官 is the
plate's Adjutant, not Vice Officer. 火爆破 is the skill table's Fire Blast, not
Fire Explosion. ルールーハンデル is Ruuruhandel, not Rule Handel.

**Once, the table was the thing that was wrong.** `9_カード情報.x:1309` writes
Fiend Kite for 魔人カイト; the wiki writes Kaito 249 times against that one, and
so does the draft on all nine of its scenes. A row is evidence about its own row.

**And one finding was not a missing row at all.** カラー sat in
`mistranslated_names.json` spelled Kalar and was reported blind in 25 scenes
anyway, because the middle dot is in the katakana block and `mentions()` refuses
a katakana word glued to katakana -- so パステル・カラー did not count as saying
カラー. The same held for リセット, リーザス, モフス and ザンス, about a hundred
scenes in all. `7963ab57` makes the dot a boundary; `regenerated.en_grok.ain.txt`,
the cherry-pick check's 17 settled complaints, the card and plate checks, the
place, trophy and synopsis tables are all identical with the change in and out.
No check that starts from the table could have seen this: they all ask whether a
line names somebody, get no, and report nothing.

**The one build output this can move is the synopsis panel**, because a row's
English becomes an unbreakable phrase in `readUnbreakable()`. `34c250f5` moved
four captions and all four stopped breaking mid-name -- "Grand / Marshal
Stroganoff", "Demon King / Miki" twice, "Stone / Guardian". Every later commit
left it byte for byte alone. Snapshot it before editing this file:
`renderSummaryTable().text` is the check, and it needs no alice-tools.

**Two findings were left standing on purpose and are worth picking up.**
`黒色破壊光線` would have gone in as Black Destruction Beam next to this file's
own `白色破壊光線` "White Destruction Ray", and `11_スキルデータ.x` says Beam for
the white, the black and the six-coloured alike. That is the skill screen
disagreeing with the synopsis panel over one word, it wants a sweep and a look
at the built file, and it belongs to `find_term_drift`. The other is
`防衛隊長`, where `summary_glossary.tsv` writes "defence" and the draft writes
"Defense": a repository-wide spelling question rather than a term.

## 大陸 is this report's 鬼

`大陸` has no capital to be found by. The draft writes "the continent" and never
varies it, so there is no rendering, and in the half with no rendering it sits
at **412 of 4125** behind 出来, 本当, 人間, 自分, 世界, 二人 and four hundred
other ordinary words. `--plain` prints that half; it is not readable and the
flag is there to be honest about it rather than to be used.

This is the same shape `docs/terminology-drift.md` records for 鬼: a report that
starts from the text can only see what the text distinguishes, and a word that
is an ordinary noun in Japanese *and* an ordinary noun in English is
distinguished by nothing. What found 鬼 was reading one scene whole, and what
found 大陸 was reading one scene's answer three times.

**One cut for that half was measured and does not work.** A term that is a
substring of some glossary key looks like it should be a proper noun -- 大陸 is
inside `place_name_glossary.tsv`'s `大陸のどこか？？`, whose English capitalises
Continent. But `summary_glossary.tsv` is five thousand whole synopsis captions,
so every common word is inside one of them: the cut keeps 1345 of the 4113 and
leaves 大陸 at 265, behind 出来, 俺様, 本当 and 人間 exactly as before.

## What is noise on purpose

The 49 findings the first pass left are all of five shapes, and reading them is
how the pass knew it was finished.

**A name with an honorific stuck to it, seen through the wrong window** -- 17 of
the 49. 美樹様 reports as `樹様`, 謙信様 as `信様`, 北条早雲 as `条早`, 藤原石丸
as `原石`. Every one of those names is in a table already -- 謙信 is
`card_name_glossary.tsv:48` -- and what the report can see is a fragment that is
nobody's word. The `-sama` rule is in the prompt's own text.

**A stage-direction template read one word at a time** -- 11. 友情イベント　志津香　
１段階目一言ぐらいの簡易な物 is a scenario note in 52 scenes, and 一言, 段階, 簡易
and 目一 each report it as their rendering. They print with their compound beside
them -- `一言 (always inside 段階目一言ぐらいの簡)` -- which is enough to read them
as what they are. `文章`, `戦闘時`, `シリーズ`, `霧散` and `年発売` are the same.

**A quest panel's own label** -- 3. `捕捉`, `友好` and `命令難度` are the column
headings of the capture-difficulty box, so they co-occur with each other's
values. `docs/terminology-drift.md` describes the shape as one label with
several values.

**A word that is genuinely a word and genuinely has no row** -- 11. 将軍 is
blind in 159 scenes of 511 and "General" is exactly what it means; so are イベント,
王国, 軍司令部, 共和国, 海里, テープ and スパルタ. Whether a common noun of that
kind wants a row is a judgement about how long a prompt should be, not a fault
in the report.

**The residue of a compound that is settled** -- 7. 天王 is blind in 32 scenes
after both 四天王 got rows, because the game also writes ゼス**の**四天王 and
`mentions()` matches neither spelling against the other. 光線, 衛隊長, 聖女, トー,
アーク and 宮島 are the same: the whole word has a row and a variant of it does
not.

**That last one is the gap worth knowing about.** A の inside a term makes it a
different string, and it is exactly how 聖女モンスター failed to cover
聖女の子モンスター. Measured over all 5434 scenes, allowing a one-character gap of
の alone would join 11 terms across 39 scenes and 10 of the 11 are real. Widening
it further does not pay: a gap of any one character finds 40 terms across 253
scenes and reads 魔物**大**将軍 as 魔物将軍 in 119 of them, which is a different
rank, and a gap of two reaches 聖女の子モンスター at the price of reading
スケジュール as スケール.

**The counts are not invariants.** They move with where each guard is drawn, and
with every row anybody adds to a glossary -- which is the point of the report.
What to trust is the shape.
