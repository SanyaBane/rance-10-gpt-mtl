# Reading the translation back, one scene at a time

The other loop, [scene-driver.md](scene-driver.md), hands a scene over with no
English on the page and takes a whole retranslation back. This one is the
opposite ask, and it exists because the answer to "is this line wrong?" is
cheaper than the answer to "what should this line say?" -- and because the
translation the game ships today is worth keeping.

`en_grok` is a machine translation of 269 677 lines that has been through five
bracket passes, a row bake, a name bake and four terminology sweeps. Its
register is settled and nobody wants it rewritten. What it still carries is the
class of fault a line-at-a-time machine makes and no report can see: **`she`
where the speaker is a man**, a negation that fell out, a sentence answered by
the wrong half of the next one. Those need somebody to read the Japanese beside
the English, which is what this is.

```
node scripts/request_scene_reviews.js --only=033299   # build/scene-review/033299.prompt.md
      ... a model or a person writes 033299.answer.tsv ...
node scripts/accept_scene_reviews.js --by=sonnet-5    # into text_languages/en_grok/scenes/
node scripts/check_scenes.js                          # what moved, against the game
```

`npm run request-reviews` and `npm run accept-reviews` are the same two.

## What the answer is

One line per correction and nothing for the rest:

```
223993	「Fufufu, but isn't this fine.」	meaning: Miracle is a woman; the English said "he"
```

The number, the **whole corrected speech**, and a reason that opens with the kind
of fault it is. Three columns rather than two, and the third is load-bearing: **a
correction without a fault named for it is a rewrite**, and the acceptance
refuses it. Asking for the reason is most of what keeps the pass from drifting
into retranslation -- a model that has to finish the sentence "this was wrong
because..." writes far fewer of them than one that only has to produce a better
line.

An empty answer is a valid answer and is what most scenes should get. The prompt
says so out loud, because a reviewer who believes an empty answer is a failure
will find something.

## Three kinds, and one of them is not applied here

| | |
|---|---|
| `meaning:` | the English says something the Japanese does not -- a pronoun for the wrong person, a negation that fell out, an action given to the wrong character, half of one speech sitting in the next, Japanese left untranslated |
| `english:` | the English is broken rather than plain -- "a ancient city", a sentence that stops without finishing, a word typed twice. The test is whether the fault can be named in a word: a wrong article can, "clunky" cannot |
| `name:` | a name, a place or a settled term spelled some way other than `glossaries/` spells it |

The first two are written into the patch. **A `name:` correction is collected
and not applied**, and that is the one routing decision in this pass worth
arguing about.

A name spelled wrong in one scene is spelled wrong in every scene that says it.
`イラーピュ` is "Irapyu" in ten scenes where `glossaries/summary_terms.tsv`
settles "Ylapu": mending this one leaves nine, and CLAUDE.md's rule is that **a
sweep is finished when the built file says so**, which a scene-at-a-time pass can
never say. So they go to `build/scene-review.tsv` for `scripts/find_term_drift.js`
to sweep in one commit, and `--with-names` writes them anyway for a run that is
not going to be swept.

The reviewer names the kind rather than the acceptance working it out. What
separates a name correction from a meaning one is *why* the word changed, which
is in the reviewer's head and not in the diff -- and a kind named wrongly is one
line of the report to read, where a kind guessed wrongly is silent.

## The unit is the voice

Not the row, and not the file.

**Not the row**, because the row division is where Japanese typesetting fell at
twenty-four full-width characters and `modules/SpeechRows.js` works it out again
from the corrected utterance. A reviewer shown the rows writes English shaped to
them and loses a word to the row that was already full.

**Not the file**, which is the one real difference from
`modules/SceneAcceptance.js` next door. A retranslation lands whole or not at
all because the game is handed one English line per `m[]` number and an answer
that stops early does not lose its tail, it *shifts* it. A correction names the
number it changes and never moves a row, so **a refused correction leaves that
speech exactly as it was and costs the others nothing**. Per-correction is
therefore the honest granularity, and refusing nine good fixes for the tenth
that overflows would be the expensive kind of tidiness.

A voice is one speaker's run of rows inside one bubble. It is the speech for
every speech but 297 of them, and those change speaker without the click that
would end them: one line of English for the pair cannot be laid back out,
because nothing says which half belongs to whose rows.
[speech-voices.md](speech-voices.md) is that class.

## What the acceptance will not let through

Every one of these is **"do not make it worse"** rather than "be perfect". The
corpus has 839 speeches that already hold more English than their rows can draw;
refusing those would refuse the pronoun fix along with them, so a fault that was
there before the correction is a warning and one the correction introduced is a
refusal.

| | |
|---|---|
| a number that is not a voice of this scene, or came back twice | the answer is about some other scene |
| a correction with no reason column | see above |
| lines that open with a number and are not tab-separated | read as prose and *ignored*, which is the expensive half -- so it is a complaint |
| a tab, a line break, an empty correction where the game speaks | the format, and `assemblePatch` reading a blank cell as "not translated" |
| ＜エール＞ resolved to a name | the token the game replaces with what the player typed: [player-name-token.md](player-name-token.md) |
| brackets the old line had and the new one has not | compared **in order** -- `「」` and `」「` hold the same two characters |
| a name the repair pass would rewrite | the repairs are baked into the corpus: [baked-name-repairs.md](baked-name-repairs.md) |
| fewer words than the speech has rows | the layout would leave rows empty and the game would speak Japanese on them |
| a speech that no longer fits its window, or that the backlog would clip | [message-window.md](message-window.md), [speech-gaps.md](speech-gaps.md) |
| a gender branch flattened into one sentence | nobody sees both halves, so one English for the two is one player reading the other's line |
| the ■歴史枠 chronology, and the shifted run in `033355.tsv` | neither is this pass's to lay out |

And two gates stand in front of the write itself, both borrowed from
`scripts/bake_speech_rows.js`, which is the other pass that edits a committed
translation in place:

- **the file has to round-trip** -- parsed and rendered back unchanged, compared
  with the bytes on disk, before anything is written;
- **the result has to read back as what was accepted** -- the file is parsed
  again afterwards, every corrected speech has to come out of its rows as the
  words that went in, and no other row may have moved. A file that fails that is
  put back as it was.

## Handing them out in batches

```
node scripts/request_scene_reviews.js --count=60 --batch-kb=120
```

groups the scenes it hands out into batches of at most 120 KB of prompt and at
most twelve scenes, and prints them grouped. Without `--batch-kb` the listing is
one line per scene, as it was.

**The batch is sized before it is handed over, not while it is being read.** The
obvious arrangement is to let a reviewer take scenes until its context is some
fraction full, and it cannot: a subagent has no way to read its own token count,
so that rule is an estimate made by the one party that cannot measure it --
which is the mistake `CLAUDE.md` records about guessing at context by feel, one
level down. A prompt is a file, its size is known before anybody sees it, and
the fixed part is the same 9 KB of rules every time, so a batch's cost is
arithmetic.

What a kilobyte of prompt is worth in tokens is measured rather than assumed:
an agent reports its own usage when it finishes, and the first batches are what
sets the budget. The one datum to start from is a single scene of 171 rows, a
30 KB prompt, which cost 96k tokens -- of which some 70k was the agent's own
overhead, paid once per agent whatever it is given. That overhead is the whole
argument for batching: a scene of two rows costs the same 70k as a scene of two
hundred.

**The scene cap is not about context.** It is about attention, and it comes from
`docs/coherence-sweep.md`: twelve sessions of reading scenes by hand, and what
that run caught itself doing was going quietly blunt sixty files in, with
nothing but a spot re-check to say so. A batch of forty short scenes costs
almost nothing in tokens and is forty chances to stop looking.

**Running batches in parallel costs nothing in context and buys nothing in
safety.** Each reviewer has its own window, so four at once make none of them
larger. What serialising does buy is the chance to read
`build/scene-review.tsv` between batches: a reviewer that has started correcting
style, or has found a class nobody wanted, shows up after the first batch
instead of the eighth. Worth it for the first few, and after that the report is
still read every time.

## Coverage is a ledger, and that is not a mistake

For a retranslation, coverage is a directory listing: a scene is translated
exactly when its file exists. Here every scene already has a file and a reviewed
one looks like an unreviewed one, so `text_languages/<lang>/reviewed.tsv` is a
row per scene read -- the date, how many corrections stood, how many were
refused, how many were held for the sweep, and who read it.

It records an **event** rather than a state, which is the only kind of ledger
that cannot go out of step with the tree: a scene read on a Tuesday stays read
however its English is edited afterwards. And it is committed rather than left
under `build/`, because a pass over 5433 scenes is months of asking and `build/`
is documented as safe to delete outright.

`text_languages/<lang>/held.tsv` is its sibling and is committed for the same
reason, one row per correction held for the sweep: the scene, the number, the
Japanese, the line before and after, and the reason given. **Holding a name only
pays if the finding survives until somebody sweeps it**, and
`build/scene-review.tsv` is the wrong place for it twice over -- it is rewritten
whole by the next run, so a batch's names are gone the moment the next batch is
accepted, which is how `030324`'s four went missing between the run that found
them and the run after it. The Japanese is in the row because that is what a
sweep is keyed on: `scripts/find_term_drift.js` starts from a Japanese
substring. Nothing takes a row out again -- a finding whose word has since been
swept is answered by the built file rather than by an edit here.

## What the first runs measured

Four scenes, read by Sonnet 5, one agent apiece.

Three came back with nothing -- including `033299`, 99 speeches, which was read
by hand afterwards and looked sound. It was not: see the Pope, below. The fourth, `030324`, came back with
four corrections and every one of them was right: `ランス城騎士団` spelled "Rance
Castle Knight Order" where `glossaries/summary_terms.tsv` settles "the Rance
Castle Knights", and `イラーピュ` spelled "Irapyu" where the table settles
"Ylapu". Each correction changed one word and left the rest of the speech alone.

**A pass that finds nothing tells you nothing**, so the sensitivity was measured
rather than assumed: four faults were planted in `033299` -- a `she` turned into
`he` about Miracle, `嫌いじゃねーが` with its negation dropped, `Reset Calar` for
Kalar, and `お姉ちゃん` turned into a big brother -- and the scene was handed to a
reviewer that had not seen it before. **All four came back**, each named
correctly, along with eight corrections nobody wanted.

Those eight are the finding worth keeping. They were all the same thing: the
prompt carried the translation prompt's rule that `……` is three dots, and the
reviewer duly reported every long dot run in the scene. **That rule is for
writing a line, not for correcting one** -- this patch answers a long ellipsis
with a long run of dots in 20 457 rows, which is a house style and not twenty
thousand mistakes. `ELLIPSIS_RULE` is its own export in `modules/ScenePrompt.js`
now, the translation prompt still carries it, and this one does not.

The general shape of that mistake is worth carrying into the next rule this
prompt borrows: **a rule written for a translation that does not exist yet
becomes a work list when it is read against one that does.** Eight of twelve
corrections in that run were the reviewer doing exactly as it was told.

Run again on the mended prompt, a third reviewer that had seen neither the scene
nor the first run returned **those four and nothing else** -- the same four
faults, each named correctly, and no ellipsis.

**A fourth run then found three of the four, and the one it missed was the
pronoun.** Which is the class this pass exists for, so it is the one the prompt
now spends a paragraph on: before answering, the reviewer is asked to go over
the scene and say, for every he and she in the English, who it is -- by name,
off the cast list. Read for meaning, "I knew he liked rare items" is a perfectly
good sentence about somebody; asked who `he` is, it is Miracle, and Miracle is a
woman. The runs after that rule went in found four of four again, and one of
them said in as many words that naming the pronouns is what surfaced them.

That is the same forcing function `docs/coherence-sweep.md` arrived at over
twelve sessions of reading by hand: **a check that has to name what it checked
is a check that happens.** A bare "no errors" does not have to be preceded by
one, and nothing outside can tell the difference.

And it paid for itself in the run that proved it. Asked to name the pronouns,
the reviewer found a fifth fault that was nobody's plant: `033299` m[224075],
`ククク、法王は真面目で冷静そうに見えて、あれでやることが大雑把だからな` -- "the Pope
looks serious and calm, but **he's** actually quite sloppy with things". The Pope
is Crook Mofus, `glossaries/character_genders.md` line 159, Female. Two earlier
runs had read that scene and called it sound, and so had the person setting up
the experiment. That one line is the whole argument for this pass: it is
invisible to every report in the repository, because nothing in it is wrong
about the *English*.

The other thing those runs settled is the routing above: `030324`'s four
corrections were all names, and a name is corpus-wide. They are held now rather
than written, which is why that scene's file is unchanged and its ledger row
reads four held.

**The Pope came back.** The same four faults were planted again after 213 scenes
had been read, to see what the pass catches now, and a reviewer returned three
of them and left the pronoun -- saying in as many words that 法王 was not on the
cast list and so it had left the `he` alone. Which is the prompt's own doing:
the cast block is built from `scene.cast`, the speakers, and it had told the
reviewer that the gender beside each name is what the pronouns have to agree
with. A character the scene only *mentions*, and above all one called by the
office they hold, was outside everything the page said. **A rule that names its
evidence tells you what to do when the evidence is missing, and this one said
nothing**, so a run that had done the work correctly stopped one step short.
The pronoun paragraph now carries the case out loud.

## What is corpus-wide, and what it costs to be told again

A reviewer reads one scene and cannot see that what it has found is in nine
thousand others. Each of these has been measured, and each is a sweep with its
own commit rather than anything a scene may fix:

| | |
|---|---|
| the stray `ー` in an English cell | 3114 cells; `replaceUnicode` draws it as `~` |
| the numeral `一` standing in for a dash | 580 cells; `replaceUnicode` draws it as `-` |
| full-width `！` and `？` in an English cell | 9659 cells, so the house norm rather than a mistake |
Those three are answered by leaving them alone: they are one character apiece,
the build already draws two of them as a dash, and mending three of nine
thousand finishes nothing while making every diff longer.

**The honorifics are the opposite, and are corrected on sight.** They are the
same size --

| | |
|---|---|
| an honorific replaced by an invented title | 140 speeches in 77 scenes -- `ケッセルリンク様` as "Lord Kesselring" 36 times, `ランス様` 22 |
| an honorific simply dropped | 7357 speeches, 45% of the 16 104 that carry one |

-- and they are not the same kind of thing. A tilde where a dash was meant is a
character nobody reads twice; a name that arrives as "Lord Kesselring" or with
its さん gone has had a word of the Japanese thrown away and another put in its
place. **A name or a title carrying さん, 様, ちゃん, 君, 殿 or はん keeps it in
the English, and no English title is invented for it** -- no "Lord", no "Lady",
no "Sir", no "Miss". That holds for a title exactly as for a name: `雷帝様` is
"Thunder Emperor-sama", `総統さん` is "Supreme Leader-san".

**A reviewer who answers that the corpus drops it elsewhere is describing the
7357, not a convention**, and that is the one argument not to accept here: this
pass is where those get mended, one scene at a time as it reaches them, and a
scene read without mending them is a scene that will have to be read again.

## A word-for-word correction keeps the rows it found

`modules/SpeechRows.js` divides an utterance again from scratch, which is right
for a translation arriving as one sentence and wrong for a correction. Mending
`a` to `an` came back as both rows of the speech rewritten -- and on a speech
already half again too wide for its window, the rebalancing took it from three
drawn lines to four and the correction was **refused over one letter**.

So a correction with as many words as the speech it replaces is written back
into the division that is already there: each row keeps its own words and its
own indent, and a reviewer who changed one word sees one row change. It cannot
draw worse than what is there, because nothing moved between rows. A correction
that adds or drops a word is laid out, and takes the gates that come with it.

## Read the report before committing

`build/scene-review.tsv` is every correction of a run -- applied, refused or
unchanged -- with the line before, the line after and the reason given. That is
the file to read.

The reason it is not optional is `scripts/bake_speech_rows.js`'s lesson, one
level up: **a pass that rewrites what is not broken cannot be reviewed**. Asked
of every speech, that one offered to rewrite 62 261 of 166 177 and most of it
was a good split turned into a differently good one. A review pass fails the
same way and more quietly, because every one of its edits is defensible in
isolation. The reason column and this report are what make the difference
visible.

Applying a correction re-lays out the whole speech, so a one-word fix shows up
as every row of that bubble changing. That is the row division being computed
again from the corrected utterance, not the words moving: the report shows the
utterance before and after, which is where to read what actually changed.

## One wave, end to end

Nine reviewers at once has been the shape of it. The scenes go out, the answers
come back, and what stands between them is a person reading each finding against
the Japanese that produced it.

```
node scripts/effective_map.js save before
node scripts/request_scene_reviews.js --count=45
node scripts/pack_scene_reviews.js                 # nine batches of what is pending
      ... nine reviewers write build/scene-review/<scene>.answer.tsv ...
node scripts/check_scene_answers.js --fix          # before the acceptance, not after
node scripts/accept_scene_reviews.js --by=<who> --dry-run
node scripts/accept_scene_reviews.js --by=<who>
node scripts/check_scenes.js
node scripts/regenerate_aai_txt.js
node scripts/effective_map.js save after
node scripts/effective_map.js diff before after
node scripts/check_review_diff.js
```

[scene-review-brief.md](scene-review-brief.md) is what each reviewer reads once
before its first scene: the corpus-wide classes a scene in front of somebody
gives no way to see. It is a file rather than something an orchestrator types
out per run, because a rule learned in one session and retyped from memory in
the next is a rule that drifts -- which is the argument `held.tsv` above makes
one level down.

**`--count=N` hands out N scenes on top of what is already pending**, rather
than topping up to N. Running it twice doubles the queue, and the surplus simply
waits.

`scripts/pack_scene_reviews.js` reads the folder rather than the run, so it sees
what an earlier wave could not fit and what nobody answered.
`request_scene_reviews.js --batch-kb` groups only the scenes of its own run and
is the right tool when that is the question. What does not fit prints as NO FIT
and is first in line next time; scene prompts run 2 KB to 17 KB and the later
scenes are markedly longer, so 45 of them came to 951 KB once and ten waited.

`text_languages/<lang>/declined.tsv` is the third ledger: the scenes a reviewer
refused on content grounds. Their prompts stay on disk unanswered for ever, so
without it every deal hands them out again -- and a skip list kept under
`build/` is one that comes back empty the morning somebody deletes the folder.

## Three kinds of refusal, and only one of them is yours to mend

**Width.** "needs 4 lines and the window draws 3", or a row past the backlog's
edge. Nought to three a wave, and every one of them has been mended by giving a
word back rather than by dropping the correction: "is the death penalty" became
"means execution", "will be delighted" became "will be glad" and went from 36.65
em to 33.69. `scripts/fit_speech.js` measures the candidate whole and
`scripts/row_width.js` one row of it.

**A row the game leaves blank.** "the game says nothing on 1 of this speech's
rows and the English does". One of the 954 speeches where the Japanese draws
nothing on a row and the English filled it; the acceptance will not re-lay such
a speech out, so the correction cannot go through this pass at all. Leave it
refused -- the report records it -- and it waits for whatever sweeps that class.
`032887` m[185445] is the standing example, and what stands there is a whole
clause the Japanese never says.

**The ■歴史枠 chronology.** Its rows are a table rather than a bubble and
`scripts/relayout_chronology.js` owns their layout. A reviewer applied the digit
rule to seven lines of it in `033026` and all of them were refused, correctly.

There is a fourth thing that is not a refusal and is worth knowing anyway: a
correction with **exactly as many words** as the speech it replaces keeps the
division already on disk instead of being laid out again. That is a trap when a
row quietly gains a `-sama` and `fit_speech.js` still says `fits true`, and a
tool when the speech is a hand-formatted block whose `　` indents must not move.

## Settled by count

The prompt carries the settled English for what its own scene names, built out
of the glossaries. These are the ones that are settled by the corpus instead,
where the count is the whole of the argument and a reviewer with one scene in
front of it cannot see them.

| | |
|---|---|
| `Ojisama` 92, `Rance-kun` 274, `Ho-Raga` 194, `Serachrolas-sama` 29 | against 1 "Sera-sama" |
| `Yosif` 13 against 5 "Yo-Zef" | `card_name_glossary.tsv` agrees |
| `Mysteria Tor` 111 against 1 "Mysteria Toa" | `character_genders.md` agrees |
| `Rudrasaum` 51 against 2 "Rudra Saum" | `summary_terms.tsv` agrees |
| `Pigu Geliciam` 467 against 1 | |
| `Mother-dono` 4 | all of them in `032974`, which is what settles `母上殿` |
| "big brother" 234 against 14 "onii-chan" | `おにいちゃん` is **not** a finding |
| "Eh?" 609 against 20 "Heh?" | for `へ？` |
| "Hero" 562 against 214 "hero" | and `summary_terms.tsv` says lowercase, so `勇者` is a `name:` for the sweep rather than a correction in a scene |
| "my Liege" 10, "Liege-dono" 0 | `主君どの` has no base noun yet -- "my lord" three lines down the same scene |

Carried from earlier passes and not re-counted here: `onee-sama`,
`Onee-sama`, `-neesama`, `Nii-sama`, `-niisama`, `-neechan`, `Kou-chan`,
`Masamune-san`, `Biscuitta-san`, `Kesselring-sama`, `Rance-dono`, `Patton-san`,
`Hawzel-sama`, `Seizel-sama`, `Hawzel-chan`, `Flame-chan`, `Kouhime-sama`,
`Supreme Leader-sama`, `Demon King-sama`, `Pope-sama`, `Kayblis`, `Haurein`,
`Youkai King`, `Orime`, `Maid-san`, `phantasm beast`, `King of Zeth`,
`Magic King`, lowercase `apostle`, `Supreme Leader Rance`, `Fiend` and `Fiends`,
`Sensor Jizo`, `Hapoko Road`, `Freya Idun`, `Holy Gal Monster`, `Human-san`,
`Rolex`, `Babolat`, `Ashutaruku`, `Darling`, `Rich` the city, `Eternal Dungeon`,
`Am Yisael`, `Nod nod` for `こくこく`.

## What the pass still owes

Every one of these was found by reading scenes and none of them has a report
that would find the rest. They are separate commits, not something a wave may
fix as it goes past.

- **The sweep over `held.tsv`.** `scripts/find_term_drift.js` is the tool and
  the built file is what says it is finished. The largest classes it holds:
  `恐瘴気` as anything but "miasma of terror" (17 rows in 13 scenes), `ジオ` as
  The-O, `連合軍` as the Alliance Army, `聖女モンスター`, `永久地下牢`,
  `シャリエラ`, `タロコンソード`, `ローレングラード`, `総統司令部` without its
  article, and the bare kinship vocatives.
- **A character the corpus calls by the wrong pronoun.** Open, and it surfaces
  every wave. **A title, an office or a kinship word standing in for a name is
  the most reliable way this hides; a feminine speech register is the second;
  and narration where the Japanese carries no pronoun at all is the third and
  commonest.** Recently: Hero Helman as "her", Chaos as "she", Kaybwan as "his",
  Miracle Tor three times, the desert guide who is only ever named by the job.
- **El's gender.** 575 lines have to read either way and the corpus gendered the
  protagonist in at least five of them -- "she resembles Rance-sama", "She's
  seriously amazing", and "Lady ＜エール＞" three times, which invents a title
  and a gender at once. Worth a scan of `＜エール＞` against he/she/his/her.
- **Honorifics.** Some 7357 speeches drop one and 140 replace it with an
  invented title. "Master Kesselring" is 19 rows still standing. Kansai `はん` is
  the one that goes missing most.
- **A speech shifted, or borrowing from its neighbour.** The most valuable class
  and the one with no report at all: a sentence that reads plausibly where it
  landed is invisible to `find_speech_gaps` and to `find_term_drift` both.
- **Raw Japanese inside an English phrase.** `032980` had `the威光 of my armor`,
  and seven more are on record. A scan of the English column for kana and kanji
  would find the class in one pass.
- **A speech that lost its `「」` altogether.** `033030` held five in a row.
  `scripts/find_speech_brackets.js` asks whether the brackets match; whether they
  are there at all in a narration-shaped English line is the neighbouring
  question.
- **A missing possessive `'s`.** "Zance' pants" five times in two scenes, and
  six "Kayblis corpse"-shaped ones before that.
- **A name written twice at once**, transliterated and translated: "his By
  Road-road" for `バイ・ロード`, twice in one scene.
- **The digit rule inside the ■歴史枠 chronology.** Seven lines of `033026`
  spell out `１００万`, `第１次`, `３年前`, `４体`, `２年`, `４年` and `１０年`.
  They need a pass that can lay that table out.
- **Small things mendable in place when a wave reaches them**: a Japanese `っ`
  in an English cell (~15 rows), `へ？` as "He?" (5), a doubled space inside a
  sentence (5), a sentence whose tail is cut off, a stray mark before punctuation
  ("Rance Jr.-sama.!", "his girlfriend?.").
