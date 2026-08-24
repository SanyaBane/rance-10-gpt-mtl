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

Without it the report is **5748 terms** and its top is 出来, 本当, 人間, 自分,
世界 -- ordinary Japanese, which no glossary will ever have a row for and none
should. With it, and with the rendering required to reach 35% of the term's
blind speeches, it is **167**, and they are proper nouns.

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

The unsliced bucket is 12 entries and every one of them is a name the game says
out loud: 総統司令部, 魔王城, ミックス, ダークランス, 元就, ウズメ, 魔王美樹,
ルドラサウム, 松下姫, ストーンガーディアン, ブロビオ, 元帥.

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

**A stage-direction template read one word at a time.** 友情イベント　志津香　
１段階目一言ぐらいの簡易な物 is a scenario note in 52 scenes, and 一言, 段階, 簡易
and 目一 each report it as their rendering. They print with their compound
beside them -- `一言 (always inside 段階目一言ぐらいの簡)` -- which is enough to
read them as what they are. The same shape is `文章`, `戦闘時` and `霧散`.

**A word that is genuinely a word and genuinely has no row.** 将軍 is blind in
159 scenes of 511 and "General" is exactly what it means; so are 王国, 王子 and
元帥. Whether a common noun of that kind wants a glossary row is a judgement
about the prompt's length, not a fault in the report.

**A name blind in a handful of the hundreds of scenes it is in.** ランス is blind
in 20 of 3032, シィル in 8 of 604, リーザス in 12 of 412. Those are the scenes
where the name is said and neither the cast nor a key fired; three of them are
worth reading and the rest are the tail of a distribution.

**The counts are not invariants.** They move with where each guard is drawn, and
with every row anybody adds to a glossary -- which is the point of the report.
What to trust is the shape.
