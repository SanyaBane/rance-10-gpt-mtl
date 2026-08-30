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
| `unknown-name` | 102, now 0 | No table the pass reads holds the name, which says nothing about whether anybody has settled it. "What `unknown-name` turned out to be" below is the whole of it. |
| `unpaired` | 60, now 15 | The name is in a table and its speech carries no honorific at all -- which turned out to be true of five of them. "What `unpaired` turned out to be" below is the read of all 48. |
| `san` | new, 0 | `さん` and `はん` are particles English keeps, so they are a substitution the way `様` is. The bucket exists because `unpaired` could not tell "no honorific" from "a different one". |
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

## What `unknown-name` turned out to be

77 occurrences over **31 English spellings**, and the bucket was misnamed
throughout. Hardly any of them was a name nobody had settled. It is 0 now, and
the shapes are worth keeping, because the next bucket will hold the same ones.

**Settled in another glossary, so a row was the whole of the work.** Eleven
names, 35 occurrences. Each row carries an empty `knownMistranslations`, so
`normalizeNames` has nothing to apply and the rendered patch does not move --
checked at 0 changed before either sweep ran, the way the Wass row was checked
in `51c5dec6c`. None of the eleven Japanese keys is a `card_name_glossary.tsv`
key either, so no plate moves.

| Japanese | English, and where it was already written down | Occurrences |
|---|---|---|
| ルドラサウム | Rudrasaum -- `enemy_party_glossary.tsv`, `summary_terms.tsv` | 19 |
| 東芝 | Toshiba -- `summary_terms.tsv`; the card table has 東芝王子 | 3 |
| ポル | Por -- `summary_terms.tsv` | 3 |
| 山田 | Yamada -- `summary_terms.tsv`, the master list at 山田 千鶴子 | 2 |
| モフス | Mofus -- `summary_terms.tsv` (`殿`) | 2 |
| ダルソン | Darson -- `enemy_party_glossary.tsv`, `summary_terms.tsv` | 2 |
| フリーク | Freak -- the master list at Freak Paraffin (`殿`) | 1 |
| ルーン | Rune -- `summary_terms.tsv` | 1 |
| 信長 | Nobunaga -- the master list at 織田 信長 | 1 |
| マックス | Max -- `summary_glossary.tsv`, `portrait_genders.tsv` | 1 |
| 石丸 | Ishimaru -- `summary_terms.tsv` (`殿`) | 1 |

ルーン is the one worth spelling out, because `summary_glossary.tsv` also has
ルーン命令 as "rune orders". The person is マジック・マスター・ルーン, ルーカ・
ルーン, spelled "Luca Rune" and "M・M・Rune" across five scenes, and
「ルーン様らの魔法」 is said in a First Fiend War flashback, which is his century.

**Settled outside the repository.** Four more the corpus itself had spelled
consistently and no table carried: オスマン Osman 10 rows, バンオペタ Banopeta
11, グスマン Gusman 5 -- one of which already read "G-Gusman-sama" -- and ミト
Mito 3. The corpus agreeing with itself is not a source, so two were checked
against the AliceSoft wiki, which lists **Villenhowe Osman** under Diptheria
against the finding's 「ジフテリアのオスマン様」 and **Banopeta** among the demons
beside Xacalite; ミト is 征伐のミト, "Punisher Mito", the alias Ragnarokarc Super
Gandhi travels under, and all three occurrences are his own scene.

**Half a name, twice.** バークスハム is Burksham and the three Julietta sisters
address him by three different pieces of it -- Arcy says レーモンさま, Lucy says
ハム殿, Mercy says バークス様 -- so `readNameIndex`, keyed on the whole name,
could pair none of the three. The wiki settles the set: **Ramon C. Burksham**,
レーモン・C・バークスハム, whose surname half this repository had spelled right
all along. `Burks` and `Ham` got rows of their own; every ハム in the corpus is
either ハム殿 or inside バークスハム and every バークス likewise, so the two rows
are exact, and `mentions` refuses ハム inside バークスハム on the katakana run.

**A misspelling first, and it goes in its own commit.** Writing the honorific
onto a wrong name bakes it a layer deeper, which is what 「ケイブワン様」 cost as
"Lady Kabe One" in `fe51d604e`. Seven names went that way, in two shapes that
measure differently:

The table can reach the row -- `normalizeNames` repairs a line only where
**that line's own Japanese** names the character -- so the wrong spelling goes
into `knownMistranslations`, the rows are written to match, and the commit takes
two measurements: the entries and the corpus together against the commit before
(what the spelling is worth in the game), and the corpus written with the
entries already in place (0 changed, which is the bake invariant). `Keyblis`,
`Kaebri` and `Darlson` went that way, and `Darlson` was six rows rather than the
one the report named -- a spelling swept out of a scene is swept out of the
scene. So did `Raymond` for レーモン and `Ashtalcu` for アシュタルクー.

The table cannot reach it, so the corpus edit is the whole of the change.
`Stroganov` sat on a row whose own Japanese does not name him -- the English
wrapped where the Japanese did not -- while the entry had listed that spelling
as wrong for as long as it existed and six other rows of the same scene say
Stroganoff. `Barks` was worse: the table's key is バークスハム and the rows say
バークス, so nothing could ever have reached them.

アシュタルクー was a disagreement rather than a gap, and the tables won.
`mistranslated_names.json` and `48_立ち絵名札マッピング情報.x` both say
Ashutaruku, and the second of those is the plate `AdvNameResolver::Resolve`
draws over the portrait -- so the player had been reading Ashutaruku on the
plate and Ashtalcu in the bubble beneath it, in the same window, for the whole
of scene 032398. That is the キャンテル fault seen from the other side. The wiki
has no page for him under either spelling or six others.

**No table can ever hold it.** リス is a squirrel -- ケイブリス was one for
thousands of years before he was a Fiend, and some thirty rows say so -- and
リス様 is what Kaybwan and Kaybnyan call him, the back half of his name, which
「ケイブ、リス様……？」 breaks at that seam three times. A row for リス would
therefore be wrong rather than missing: `mentions` would be true on every
"squirrel" row and the name check would report all thirty, which is 魔人 listing
"demon" arriving from the other side. `scripts/fix_honorifics_ambiguous.js`
carries the five one apiece with the Japanese that licenses each, checked with
nothing katakana in front of リス様 because ケイブリス様 holds it. One of the five
was a reading and not only a title: 「リス様ーーーーーーー！」 read "Lord
Squirrel", and its four neighbours in the same run of scenes already said Lis.

**Answered the wrong syllable.** Four rows matched a word no table could hold
because the decoration the Japanese put on the honorific had been moved onto the
name: 「ミトさまーーー！」 read "Lord Mitoooo", 「アリス様ぁぁあああああ！」 read
"Lady Aliceeeeee", 「ケイブリズさま゛ぁぁ゛ぁ゛〜〜〜！」 read "Lord Kayblissss".
**The stretch changes place and keeps its length** -- three o's become three a's,
five e's five, three s's three -- because how long a stretch runs is the
translation's own and only where it sat was wrong. The fourth breaks rather than
stretches: a dying Flame Scrivener says 「――ハウ、ゼ……さま、っ……」 and the
English broke the name in the same place and spelled the first half from the
sound, so the break stays and the halves are spelled from Hawzel. They are in
`scripts/fix_honorifics_multiword.js`, because the question that file answers --
where does the name end -- is the question these ask.

**Two of them were never honorifics**, and say so now. 「さあて、ではそろそろこの
ミトが……」 and 「後はこのミトの征伐に任せるがよい！」 carry no 様 anywhere:
Gandhi is referring to himself grandly and "Lord Mito" is the translator's
flourish. With the row in place they are `unpaired`, which is the bucket that
means exactly that, rather than `unknown-name`, which meant only that the pass
could not see the name.

## One name, and the two languages crossing it

`unpaired` means the speech carries no honorific at all, so removing the title
there is a reading. **Fourteen of the sixty were never that.** 香 is Kou and
香姫 is Kouhime, `mistranslated_names.json` holds both, and these speeches use
the forms crosswise: twelve say 香様 and answer it "Lady Kouhime", two say 香姫様
and answer it "Lady Kou". `readNameIndex` looks the English up, gets the other
form's Japanese, finds no 様 on it and files the lot as unpaired.

They are Pi-R and Medusa a third time -- a pairing the index cannot make and a
person can -- so they went where those went, in
`scripts/fix_honorifics_untabled.js`, which now carries four pairs and three
reasons. 香 is one common kanji, so the Japanese half of the guard is the weak
half; what keeps it honest is that the English half matches a whole name and
refuses a longer one, so `Lady Kou` cannot match "Lady Kouhime".

**The name form was left where it is**, deliberately. 香様 reads "Kou-sama" 25
times elsewhere in the corpus and 香姫様 reads "Kouhime-sama" 11, so these
fourteen disagree about which of the two forms to use as well -- writing
"Kouhime-sama" over 香様 puts twelve rows against twenty-five. That is a
`find_term_drift` finding rather than an honorific one.

Doing it before the `sama` sweep rather than with the rest of `unpaired` is what
made that sweep safe. 032114 m[123468] is 「信長様の夢は、香様を市井に暮らすよう
な普通の女の子にすることじゃった」, both names carry 様, and only 信長 paired --
so the sweep would have written "Nobunaga-sama's dream was to let Lady Kouhime
live as an ordinary girl", which is ドッス殿とワッス殿 over again. It was the
only one of the 31 whose speech carried a second title, and finding it took the
question worth asking in front of every sweep: for each speech the sweep would
touch, does its English still hold a Lord or a Lady once this fix has been
counted? Two lines over the report's own findings, and the answer is the
difference between a pass that converts a sentence and one that converts half
of it.

## What `unpaired` turned out to be

The bucket's name is a claim about the Japanese -- that the speech carries no
honorific at all, so the "Lord" is the translator's and removing it is a
reading. All 48 were read, and **the claim is true of five of them.** The other
43 carry an honorific; the report either could not see it, or could see it and
had no word for it. **A bucket that means two things hands a person the same
word for two questions**, which is the whole of what this read found, and the
`san` bucket is that finding written into the tool.

**Seventeen are a 様 or a 殿 the pairing missed**, and not one of them needed a
reading.

*Two spellings of one name.* `card_name_glossary.tsv` keys ＡＬＩＣＥ and ＢＳ
full-width, because the game's own tables do, and the dialogue writes `ALICE様`
and `BS殿`. `mentions` was comparing two spellings and could pair neither. The
fix is `foldWidth` in `modules/HonorificDrift.js` rather than nine hand-written
rows, because a hand row answers these nine and leaves the question every other
name is asked exactly as wrong. **Letters and digits only:** `＜エール＞` is in
the same index under "El", and folding its brackets would spell a key the game
has never heard of. Measured before it was written -- the same 53 findings
either way, exactly nine changing bucket, and `BS殿` landing in `dono`, which is
the honorific it actually carries.

*The Japanese's own pause broke the address.* 「魔人……カミーラ、様」,
「あ、あ、アム、様……」, 「リアさ、ま……」, 「ヨシフ、さま……」, 「ケイブリス、様？」 --
the comma is the speaker hesitating and the 様 still belongs to the name in
front of it. `scripts/fix_honorifics_broken.js`, and **the pairing was not
widened to reach them.** A rule that steps over the pause marks finds 66 places
in the corpus, and two of them are 「かなみ、様子はどうだ？」 and 「シィル、様子を
見てこい」 -- 様子 is "the situation", and the rule would answer both with an
honorific nobody said. Wide enough to reach these is wide enough to invent two,
and it still misses 「リアさ、ま」, where the break is inside the honorific.

*Three names the index could see and a guard could not.* もどかた is Modokata in
hiragana and the tables spell him in katakana, which is a pairing for
`fix_honorifics_untabled.js`. 「リス様」 answered "Lord Kayblis", which is
`fix_honorifics_ambiguous.js`'s own address and its own rule about writing the
form the row already carries. And ポルポトケイブリス様 has no separator in it, so
`mentions` glues the ト to the ケ and refuses a 様 that is plainly there -- the
katakana-run guard being right about the rule and wrong about the row. Where
ポルポト ends is a fact about the sentence in exactly the way "Fiend Warg" is, so
it is a row in `fix_honorifics_multiword.js` rather than a loosening of the
guard: nothing else in the corpus would survive that loosening.

**Twenty-six carry a different honorific, and that half splits again.**

`さん` and `はん` are *particles*, and `modules/ScenePrompt.js` names -san among
the four that stay as the Japanese wrote them. The corpus already agrees with
itself -- アールコートさん is "Arlcoate-san" on six other speeches, ランスさん across
564 -- so they are a substitution and now a bucket, asked exactly the way 様 and
殿 are. はん is Kansai for さん and keeps its own spelling, as "Chochoman-han"
already does twice. Two more were a pairing rather than a particle: what the
tables hold for 志津香 and ナギ is the *child* of each, 子供志津香 and 子供ナギ, a
card apiece, so the grown women went to `fix_honorifics_untabled.js` -- which
now lets a pair name the honorific it answers, because both names sit on one
row and converting one would leave the sentence half done.

`閣下`, `女史`, `嬢` and `女王` are *words*, and each is a decision:
`scripts/fix_honorifics_titles.js`, nine rows. 女王 and 嬢 the corpus had settled
and only these rows disagreed -- リア女王 is "Queen Lia" on 41 speeches, and
リセット嬢 belongs to Pespo Tontone, who writes "Miss Eleanor" and "Miss Copandon"
himself. 女史 nothing had settled, because マルチナ女史 is the only 女史 in the
corpus; it is the formal title for an accomplished woman rather than a mark of
rank, so "Ms." is the word and "Lady" was reading a noblewoman into a
compliment about her cooking.

**閣下 is five of eight, and the three left out are the point.** The corpus
renders it by what stands in front of it: after a rank it is absorbed --
総統閣下 is "Supreme Leader" 275 times, 大将軍閣下 is "Great General" -- alone it
is "Your Excellency" 50 times, and after a *name* it drifts four ways, "General
Pizarro" ×3, "His Excellency Pizarro" ×1, "General Zedong" ×1, against "Lord
‹Name›" ×8. Two of the eight contradicted themselves inside one line:
「閣下！　ツォトン閣下！」 read "Your Excellency! Lord Zedong!", the same word
twice, two ways. It reads "Your Excellency! General Zedong!" now, which is the
distinction the Japanese is making -- bare address against name plus rank.

The other three are not generals, and no rendering would be a substitution:
コルドバ閣下's own sentence already says "Blue General of Leazas", ランス閣下 is
総統 and reads "Supreme Leader Rance" elsewhere, and ケイブリス閣下 is a Fiend the
rest of the corpus calls Kayblis-sama. Those belong to
`scripts/find_term_drift.js`'s question about 閣下, not to this pass's about a
title standing where an honorific was.

`主君` is left whole and is in no file, because it *means* one's lord: "Lord
Zance" translates ザンス主君 rather than replacing it, and the same speaker's
bare 「しゅくん、しゅくーん！」 already reads "My lord, my looord!". Seven rows, and
not drift.

**Five are genuinely bare**, which is what the bucket was always supposed to
mean. Twice Ragnarokarc Super Gandhi refers to himself grandly -- 「このミトが」
and 「このミトの征伐」 -- where "Lord Mito" is the translator's flourish;
「ケッセルリンクという方は」 is "a person called Kesselring"; and 032747 and 032839
name ケイブリス with nothing on it at all. Dropping a title there is a reading,
and this pass does not make readings.

## A count from a report is a floor, and this bucket proved it twice

Reading the 48 turned up three rows in **no bucket at all**, invisible to the
whole report. `ADDRESS` joins the title to the name with `\s+`, so a row that
copied the Japanese's pause into the English -- and put it in the wrong place,
between the title and the name instead of between the name and the honorific --
never matched anything:

    JP 「っ、え、ぁ…………ガンジー、様……」      EN 「Ah, e-erm...... Lord... Gandhi......」
    JP 「あ、ケッセルリンク……様」             EN 「Ah, Lord... Kesselring.」
    JP 「よろしくお願いします。ケイブリス、様？」  EN 「Please treat me well. Lord... Kayblis?」

That is the same lesson `docs/speech-brackets.md` records -- a report that files
each finding once counts a floor -- arriving from a new direction: this one
files each finding under a pattern, and what the pattern cannot match it does
not count at all. The five in the bucket were never the size of the class.

`ADDRESS` was not widened for them either, and **this time the cost would have
landed in the patch rather than in the report.** Allowing dots between the title
and the name adds five matches, three of them these and two of them noise -- and
one piece of that noise is 「元四天王……パパイア様だ」 as "a former Lord......
Papaya-sama", where "Lord" is 四天王 and the name already carries its honorific.
The trailing `-sama` files it under `already`, whose sweep drops the title, so
元四天王 would have lost its rank to a pass nobody would think to check. **A
widening that reaches a fixable bucket has to be measured against that bucket,
not against the report.**

## Where the name ends

`scripts/fix_honorifics_multiword.js`, and **22 of the 26** when it was
written. It carries 28 rows now: the two 雷帝 and the four that answered the
wrong syllable were added later, from `unknown-name` rather than from this
bucket, because the question they ask is this file's -- where does the name end
-- even though the pattern had filed them elsewhere. The pattern matches
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

**45 titled occurrences on 22 converted names are still in the corpus**, which
is the price of the buckets left, and it was 207 on 42 when the first pass
stopped. `Kouhime` is no longer among them.

## Where it stands

The report reads **20**, from 142: 15 `unpaired`, 3 `followed-by-name`, 2
`wrapped`, and nothing at all in `sama`, `dono`, `san`, `already`, `title-word`
or `unknown-name`. **Every one of the 20 is left on purpose and this file says
why for each**, which is the first time that has been true of the whole report.

The 15 in `unpaired` are the three that 閣下 does not settle, the seven 主君,
and the five whose Japanese is genuinely bare. The section above is the read of
all 48 the bucket held, and its two lessons are the ones worth carrying: **a
bucket whose name is a claim about the Japanese has to have that claim tested
before it is trusted** -- five of 48 here -- and **what a report's pattern
cannot match, it does not count**, which is how three rows of a class sat
outside every bucket while five of the same class sat inside one.

Six passes wrote 33 rows between them, and none of the six was allowed to guess:

| What it wrote | Rows | Where |
|---|---|---|
| the full-width fold, and the 8 `sama` + 1 `dono` it freed | 9 | `modules/HonorificDrift.js`, then `fix_honorifics.js` |
| the addresses the Japanese's own pause broke | 8 | `scripts/fix_honorifics_broken.js` |
| もどかた, リス様 → Kayblis, ポルポトケイブリス様 | 3 | one row apiece, in the file that already asks each question |
| the `san` bucket, and 志津香 + ナギ with it | 6 | `modules/HonorificDrift.js`, `fix_honorifics_untabled.js` |
| the titles English translates rather than keeps | 9 | `scripts/fix_honorifics_titles.js` |

Each was measured the same way: `effective_map` before and after, the changed
count held against the rows written, 0 gone and 0 added; 5433 scenes still
reproducing themselves byte for byte; overflow unmoved at 847 every time; and
the bake invariant still reading the same 6 rows it read before any of this.

Three questions this work raised and did not answer, all for
`scripts/find_term_drift.js` rather than for a honorific pass:

- **リス様 is answered six ways over 29 speeches** -- Lis-sama 11, Ris-sama 7,
  Risu-sama 6, Master 3, Kayblis-sama 2, Cavebris-sama 1. No title is left among
  them, which is this pass finished and the drift untouched underneath it.
- **閣下 after a name is answered five ways over its 17 occurrences** --
  "General ‹Name›" 10 after this work, "Lord ‹Name›" 3 for the three men no
  rank word fits, "His Excellency ‹Name›" 1, "President Rance" 1, and 2 with no
  title at all. 総統閣下 as "Supreme Leader" 275 times and bare 閣下 as "Your
  Excellency" 50 are settled and no part of the question.
- **雷帝 is "Lightning Emperor" on four rows against "Thunder Emperor" on
  fourteen**, and `summary_terms.tsv` settled the second. So is
  バンオペタの証 as "Ban Opeta's License" in `card_name_glossary.tsv` against
  Banopeta in one word everywhere else, and ポル against four "Pol".

And one that belongs to the repair pass rather than to this: run
`normalizeNames` over the corpus and **six rows still change**, which the bake
invariant says should be none. Three of the six are the pass being wrong.
「日光を長時間浴びると、溶ける」 is sunlight, and the 日光 entry lists "sunlight"
as a misspelling of the character, so the patch ships "exposed to direct
Nikkou"; and 「カオル、クレイン、オルオレ、キャロリ」 names both カオル and
キャロリ while the キャロリ entry lists "Kaoru" as wrong, so two rows have the
right name for the first eaten and rewritten as the second. That is the 魔人
listing "demon" trap `docs/baked-name-repairs.md` names, and a one-word entry on
a baked corpus is where it comes from every time.
