# The standing brief for a reviewer

[scene-review.md](scene-review.md) is the loop and why it exists. This is the
page a reviewer reads **once, before its first prompt**, and it is what the
scene prompt cannot say for itself: the classes that have been measured across
the whole corpus, and the mistakes reviewers keep making that a scene in front
of them gives no way to see.

The scene prompt carries the rules that belong to a scene -- the answer format,
the three kinds of correction, the cast with their genders, the settled English
for what that scene names. Read it too; where the two disagree, the prompt is
about this scene and wins.

It lives here rather than inside `renderReviewPrompt` because it is the same
ten kilobytes for every scene: pasted into 45 prompts a wave it is half a
megabyte nobody reads twice, and read once per reviewer it is 96 KB. It is a
file rather than something an orchestrator types out because a rule learned in
one session and typed from memory in the next is a rule that quietly drifts --
which is the same argument `text_languages/<lang>/held.tsv` exists for one level down.

## The answer file, and the five ways it has been got wrong

Write `build/scene-review/<scene>.answer.tsv` for **every scene you read, even
an empty one**. A scene with no file is not recorded as read, and it will be
handed out again.

- **Three tab-separated columns and nothing else**: the m[] number, the
  corrected English, the reason.
- **The second column is English, never Japanese.** Two runs have put the
  Japanese there. Re-read every row you wrote before you finish.
- **Send the whole speech including its `「」` or `（）`**, and never put an
  ASCII `"` inside it -- the acceptance reads those as brackets the Japanese
  does not have and refuses the row.
- **One number, one row.** A second row for the same number is silently thrown
  away.
- **Copy the untouched part of the speech character for character**: the
  full-width `！` and `？`, the length of a dot run, every interjection, and
  **which apostrophe it is** -- `’` and `'` are different characters and the
  corpus is 69 734 straight against 987 curly.

## One correction changes one thing

If a line has both a dropped honorific and a name spelled some other way, fix
the honorific and leave the name. That holds for `大将軍`, `魔人`, `ジオ`,
`妖怪`, `大陸`, `連合軍` exactly as for personal names. Two honorifics in one
line are one correction, not two.

**A correction needs a fault you can name in a word.** The same thought in
another mood or register is not one.

## A repeated term gets one row

If the same `name:` fault appears three or more times in one scene -- the same
Japanese term rendered the same wrong way -- file **one** row for the first
occurrence and name the other m[] numbers in the reason. A sweep is keyed on the
Japanese and finds them all either way.

## Honorifics

The scene prompt says they are corrected on sight and that no English title is
invented for them. What it does not say is where the suffix goes.

- **On the noun, never after an English `-s`, and never on an adjective.**
  `魔人様がた` is "the Fiend-sama", `石像さん達` is "the statue-san", `旅人様` is
  "Traveler-sama", `力持ちさん` is "strongman-san" and not "strong-san". **If
  the phrase stops being English after that, rebuild it.**
- Where the Japanese stacks title on title -- `人類軍総統閣下様` -- the suffix
  goes on the title it belongs to: "Supreme Leader-sama of the Human Army", not
  "…Human Army-sama".
- **Fixing an honorific does not change the form of the name.**
- Settled forms: `兄様` is `Nii-sama` and after a name `<Name>-niisama`;
  `お姉様` and `おねえさま` are `onee-sama` and after a name `<Name>-neesama`;
  `おねえちゃん` after a name is `<Name>-neechan`; `おじ様` is `Ojisama`;
  `母上殿` and `母殿` are `Mother-dono`.
- **An honorific that is present but spelled otherwise is `name:`, not
  `meaning:`.** "Rance-oniisama" against the settled "Rance-niisama" is a
  spelling difference and goes to the sweep. `兄様` replaced by the English word
  "brother" is a lost honorific and is fixed on the spot.
- **A bare kinship vocative, or a generic title whose base noun the corpus has
  not settled, is `name:`** -- `姉さん`, `姐さん`, `兄さん`, `おにーちゃん`,
  `じいさま`, `アニキ`, `お婆様`, `婿殿`, `姫様`, `お義姉ちゃん`, `巫女様`,
  `天女様`, `騎士様`, `主君どの`. That last one is the worked example: the
  corpus says "my Liege" ten times and "my lord" three lines further down the
  same scene, so there is nothing yet to hang the -dono on.

## Pronouns, beyond what the prompt asks

The prompt asks you to name who every `he` and `she` is. Widen it:

- **`it` and `they` too**, and every generic word -- `guy`, `man`, `grandson`,
  `older brother`.
- **A feminine speech register does not make a character a woman.** The table
  decides. A name that looks plural does not make a character several.
- **Narration where the Japanese carries no pronoun at all is where this fault
  lives.** The Japanese omits the subject, the English has to pick one, and
  nothing in the line says it picked wrong. Read the bubble before it.
- `glossaries/character_genders.md` beats the cast list where they disagree, and
  a character the scene only mentions is not on the cast list at all.
- **A gender the table writes as `?` is undecided, not wrong.** Chaka Cadmium is
  22 "she", 21 "he" and 5 "they" in the corpus. Leave those alone.

## Real findings the prompt does not list

- **Raw Japanese inside an English phrase**, even one word with no space around
  it: `Even the威光 of my armor`.
- **A run of speeches whose English is a sentence ahead of or behind its
  Japanese**, one Japanese sentence answered by two English ones saying the same
  thing, and a fact the English gives out one speech before the Japanese reveals
  it. **Read neighbouring lines against each other.**
- **An idiom read literally.** `勉強させてもらいまひょ` in a shop is a discount
  and not a lesson; `たのもー` is "we're here" and not a cry for help;
  `じとっとした目` is a sullen look and not wet eyes; `高みの見物` is watching
  from the sidelines and not from above; `悪運の強さ` is good luck and not bad;
  `キョトンと` is a blank look and not a cute one; `兄バカ` follows `親バカ` and
  is a doting brother rather than "a siscon"; and **`Xの兄ちゃん` is "big-bro X"
  rather than "X's brother"** -- that one put a sibling in a scene who does not
  exist.
- **A name in the English the Japanese does not say**, an abbreviation of two
  names read as one person, and **a name written twice at once, transliterated
  and translated** -- "his By Road-road" for バイ・ロード.
- **A missing possessive `'s`** -- "Zance' pants" for ザンスのズボン.
- **Brackets**: a missing opening `「`, a `」` before the speech ends, a
  full-width `（` closed by an ASCII `)`, a `「` closed by a curly `”`, and **a
  speech that lost its `「」` altogether** -- one scene held five of those in a
  row.

## Not findings, each one measured

These are corpus classes. Reporting one costs a reader a look and mending one
finishes nothing.

- **`ー` or `一` standing where a dash was meant in an English cell.** 3694
  cells carry them and the build already draws them as a dash. **This is the
  single most common thing reviewers file wrongly.** Leave it, do not write such
  a character into an English cell yourself, and if the line has a real fault as
  well, fix that and copy the `一` through unchanged.
- A leading space inside brackets: 201 cells.
- ASCII `()` where `（）` was meant: 103 speeches. **Unbalanced** brackets are a
  real finding; these are not.
- Full-width `！` and `？` in an English cell: 9659 cells, the house norm.
- A capital mid-sentence after a comma: thousands of lines. A capital starting a
  sentence: ordinary English. **A lowercase start in a bubble that finishes the
  sentence of the bubble before it**: deliberate, and `結局――` / "In the end――"
  is the shape of it.
- Expanding a name to its full form where the Japanese says the short one. The
  reverse -- shortening `セラクロラス様` to "Sera-sama" -- is a finding.
- **The digit rule applied to a kanji numeral.** It covers Arabic digits only,
  full-width ones included: `１００万`, `第１次`, `３年前`, `11年前`. `一万倍`
  as "ten thousand times" is right, and so is `二百` as "two hundred".
- A change of mood without a change of meaning, and any rephrasing with no fault
  under it.
- **A bare `?` hung on an English statement.** `よ？`, `だぜ？` and
  `ではないか？` are softeners rather than questions: "You cannot win?" turns a
  warning into a question. Give it an English tag or leave it.
- An intensifying adverb the Japanese does not contradict.
- Swapping one loose rendering of an interjection for another.
- **A lost speech tic** -- `でち`, `にゃん`, a Kansai accent. That is register,
  not a nameable fault, and two runs have brought it and withdrawn it themselves.
- **Turning a mention into an address.**

The one that runs the other way: **an article the glossary writes into a term is
part of the term**. `カオスマスター` is "the Chaos Master" in
`glossaries/summary_terms.tsv`, and dropping the "the" is a finding.

## Settled by count rather than by rule

Some renderings are settled because the corpus settled them, and the count is
the argument. `おにいちゃん` is "big brother", 234 against 14 "onii-chan" -- not
a finding. `へ？` is "Eh?", 609 against 20 "Heh?". `勇者` is the opposite case:
`summary_terms.tsv` writes lowercase "hero" and the corpus says "Hero" 562 times
against 214, so that one is `name:` and goes to the sweep rather than being
mended in a scene.

`docs/scene-review.md` carries the rest of the counts. What a scene names is in
the prompt's own glossary block, which is built from the scene.

## A class somebody else is deciding

**Report nothing about any pronoun for `レキシントン` -- Lexington, Nimitz
Leak.** Leave `he`, `she`, `his` and `her` for that character exactly as they
stand, whatever `glossaries/character_genders.md` says, and file no `name:` row
about it either. The figure is a man who died and a woman wearing his person,
the table says he/him throughout, and the Japanese calls her a girl in
`美少女鬼のレキシントンちゃん`; correcting from the table produces "He's surely a
cute oni girl". Every one of the 99 speeches is being decided by hand elsewhere.
Other characters' pronouns are still in scope.

Delete this section when that pass finishes.
