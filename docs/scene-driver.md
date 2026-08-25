# Translating a scene at a time

The loop that gets 5433 scenes translated and back, and what it refuses.

`docs/message-window.md` is the box the English has to fit in.
`modules/SceneFile.js` is the format. `modules/SceneAcceptance.js` is what
decides whether an answer may land. This is how they are driven.

## The loop

```
npm run extract-scenes                                  # build/scenes/en_grok/, 5433 files
npm run request-scenes -- --text-lang=en_opus --count=8 # build/scene-work/*.prompt.md
      ... translate each one into the .answer.tsv its prompt names ...
npm run accept-scenes -- --text-lang=en_opus            # text_languages/en_opus/scenes/
npm run assemble-scenes -- --text-lang=en_opus          # the patch the build reads
node scripts/ain.js --text-lang=en_opus --out=build/scratch-opus
```

Repeat the middle three. The last two are worth running early and often rather
than at the end: a scene that is right in its file and wrong in the game is a
thing this pipeline has already produced twice, and only the built `.ain` said
so. See [What the built file caught](#what-the-built-file-caught).

Nothing here translates anything. `request_scenes` writes the task out and
`accept_scenes` judges what came back; the middle step is a person, or a model,
or an agent handing scenes to sub-agents. That seam is the point — the prompt
is a file, so whatever does the translating can be swapped without touching
either end.

## What is in a prompt

`modules/ScenePrompt.js`, and nothing in it is invented. Every rule it states
is one the acceptance already enforces or `docs/message-window.md` already
measured — written out so that a scene comes back accepted rather than refused,
because a translator who has not been told a speech may not grow a row will
grow one.

- **The scene**: the `m[]` number, the speaker, the Japanese. Blank lines where
  one speech ends, `> male` / `> female` markers where the game branches.
- **The cast**, with the gender to write pronouns from — including
  `Player's choice`, which is El and is not a missing answer.
- **The settled English** for whatever this scene names, cut from
  `mistranslated_names.json` and three of the TSV glossaries.
- **The rules**: the answer's shape, `＜エール＞`, the brackets and the
  full-width indent, the rows of a speech, the width.

Two decisions inside it are worth knowing about.

**The draft English is not shown.** `en_grok` is a line-at-a-time machine
translation with no speaker, no scene and no neighbouring line; showing it
would buy its settled terminology at the price of its mistakes. The
terminology is bought from the glossaries instead, which are the authority the
draft was supposed to be following.

That was decided on terminology alone, and the question was reopened on
register and measured. [What showing the draft is
worth](#what-showing-the-draft-is-worth) is the answer, which is the same
answer for a different reason.

**The width is stated in Latin characters.** "Twenty-four full-width
characters" is exact and uncountable by somebody writing English — the row has
none in it. Measured against ordinary prose in the game's own font that box is
about **43 Latin characters**, spaces counted, and a number that can be counted
is a number that gets respected. Acceptance still measures the real thing with
`gameTextWidth`.

The glossary slice is cut for recall, not precision: about five rows per scene,
and every rule that would quiet the noisiest false hit costs a real name. `てる`
is a card called Teru and turns up in 1973 scenes because it ends 書いてる;
dropping the all-hiragana keys to be rid of it loses かなみ, who is in the party.
A wrong line of advice is a wrong line of advice, and a name the translator was
never shown is what this repository is built around.

## Three outcomes

`accept_scenes` decides one of three things per answer. The judging itself is
all in `modules/SceneAcceptance.js` and is not repeated in the script.

| | |
|---|---|
| **accepted** | written into `text_languages/<lang>/scenes/`, the work files deleted |
| **refused** | the complaints kept beside the scene, so the next prompt opens with them, until `--attempts` (3) of those |
| **declined** | no rows at all, only prose — a translator saying no. Not retried: asking the same question again is the one thing certain not to change the answer. |

**A scene lands whole or not at all.** That is not tidiness. The game is handed
one English line per `m[]` number, so a scene that came back short does not
lose its tail, it *shifts* it, and every line after the gap goes out under the
previous line's number. 158 lines across six scenes played one line out of step
that way once already — see `docs/corpus-alignment.md`.

An answer that was refused is moved to `.refused.tsv` rather than left where it
is. Without that the next `accept` run judges the same answer again and spends
an attempt on it with nobody having touched anything: three runs and a scene
translated once is out of attempts. It is kept rather than deleted because when
several scenes fail the same way, the answers are what says why.

`build/scene-translation.tsv` is what is still out, rewritten whole each run.
`build/scene-translation.log` is append-only and is the trail a killed run
leaves behind.

## Coverage is a directory listing

A scene is translated exactly when `text_languages/<lang>/scenes/<id>.tsv`
exists. There is no ledger and nothing to keep in step. A run interrupted
halfway leaves prompts nobody answered, which is exactly what the next run
should hand out again; re-translating a scene is `--only=<id>` and overwrites
one file.

Until the last scene lands this is a partial translation, and building one is
normal: `scripts/regenerate_aai_txt.js` renders the default text language
underneath, so a line no scene file claims yet still plays in `en_grok`'s
English.

## Width: a warning there, a refusal here

A row wider than the window is a **warning** in the acceptance module and a
**refusal** in the driver, on every attempt but the last.

It has to be a warning in the module because 18% of the existing `en_grok`
draft is over — it was written to a wrap budget of about 31 full-width
characters, fitted in Meiryo, which is not the game's font — so refusing there
would refuse the house style rather than a mistake. A fresh translation has no
such excuse and can be written to the real window from the first scene.

It relents on the last attempt rather than looping on a line that will not
shorten, and the report names the scenes that went in that way.

## The scenes that are not asked for

**The 131 the CG recollection gallery replays**, 27617 lines, 10.2% of the
dialogue. `35_ＣＧ回想情報.x` is the game's own statement of where its adult
content is, and a translator is entitled to decline it, so the default is not
to spend the ask. `--with-cg` asks anyway; `--only-cg` asks for nothing else.
Those lines are not lost — they play in the language underneath. The flag is a
routing hint and not a guarantee (`modules/CgGallery.js` says why), which is
what the **declined** outcome above is for.

**One scene with nothing in it**: function 2119, whose whole content is the
engine's own empty `m[1]` and whose name in the dump is
`VAR  1: Message : string`, because there is no scene there to name. It is
counted out loud rather than silently skipped, so that 5432 of 5433 is not a
mystery.

## Order

`--order=index` is the default: the `.ain`'s own order, which is roughly the
order the scenes were written and so roughly the order they are played. A
translation reads better when the scene before it was done first.

`--order=small` buys coverage fastest and `--order=large` finds out early
whether the biggest scene — 765 lines, 77 KB — fits in one ask. Both are for
shaking the pipeline out rather than for the real run.

## What showing the draft is worth

The prompt withholds the `en_grok` draft, and the reason above is about
terminology. There is a second reason to want it that the first decision never
weighed: **the draft is often right about register where a careful translation
is not.** A line-at-a-time machine leaves an exclamation an exclamation, where a
translator finishes the sentence and raises the speaker with it.

`「わわ、妖怪の方々が沢山……！それにすごい殺気ですよ……！」` is the case that
reopened it. The draft ends "And such intense bloodlust..."; the fresh
translation ended "And what terrible bloodlust they have", which finishes a
sentence the scene had already finished and puts three words of grammar and a
steadier speaker where the Japanese had ですよ. `modules/ScenePrompt.js` now
carries two rules against exactly that, and they were written from this line.

So the question was measured rather than argued. Three scenes, each translated
blind and then again with the draft beside the Japanese, same translator, blind
run first — an ordering that biases the two toward each other, so a difference
counts and a sameness does not.

| | speeches | changed | toward the draft | away |
|---|---|---|---|---|
| 033485 | 52 | 13 | 10 | 0 |
| 031537 | 88 | 20 | 15 | 4 |
| 030852, short lines only | 40 | 5 | 5 | 0 |

**The draft only ever pulls.** Nothing moved away from it in the two runs where
the prompt was held constant; the four in 031537 are the two new rules, which
that scene's blind half predated. Some thirty adoptions across the three, against
one that was a loss — で、あるな is the King's whole part, said twice, and the
draft's "...Indeed." flattens a deliberately odd catchphrase into a stock reply.

**The answer is still no, and the reason is that every gain has the shape of a
rule.** Keep the fragment; keep "gonna"; do not swap a concrete word for a
vaguer one — the prompt says all three, and the third it already said before any
of this. Two more the runs turned up and the prompt does not carry yet: a
question stays a question (`戦争は終わったんじゃなかったのかよ` is "Wasn't the war
over!?" and not "I thought the war was over", which is the same sentence with
the indignation taken out), and a number the Japanese writes in digits stays in
digits. Written into the prompt once, a rule holds for all 5433 scenes and costs
nothing per scene. The draft delivers the same thing one scene at a time and
carries its errors along with it every time.

### The length cut, and why it is not there

Its errors looked separable. Over the first two scenes the draft lines a
translation adopted ran to a median of 6 words and the lines carrying an error
to 11, so showing only short lines should have kept the gains and dropped the
hazards. 030852 was run that way, at 8 words, and the separation did not hold:
of the 16 lines withheld, 2 were hazards and **3 were gains that were lost**,
while a hazard came through on the short side anyway — `うずうず` is fidgeting
with impatience and the draft calls it "itchy" in three words.

The measurement had been taken on a hazard sample picked by hand, which is
selection on the dependent variable: the worst lines were long because long
lines were what got noticed. Length is a weak proxy and the cut is not worth
having.

### What the experiment could not measure

Not one of the draft's errors was adopted — but the names were rejected because
`るろんた` and `アカメ` were looked up in `9_カード情報.x` first, and no glossary
slice would have carried either; and "itchy" was rejected because the word was
already known. That is a property of who was translating, not of the process,
and an agent handed the draft has neither habit. The three runs measured a
translator who was also the experimenter.

Which is the last argument for keeping the draft out. Its two failure modes —
terminology no table covers, and a plausible-but-wrong reading like
`せっかく喧嘩できりゃあ` rendered as having had the fight — are exactly the two the
prompt has no defence against, and the second does not look like an error in
English at all.

The draft stays where it is useful: beside a finished translation, in a
side-by-side reading, where what it got right becomes the next rule.

## What the built file caught

Both of these were invisible in the scene file, invisible in the patch, and
passed the acceptance. Only `alice ain dump -t` over the built `.ain` showed
them, which is the whole of why `CLAUDE.md` says to read it.

**The name repair was resolving the player's name.**
`glossaries/mistranslated_names.json` listed `＜エール＞` in the
`knownMistranslations` of the entry whose English is "El", so `normalizeNames`
rewrote the token itself to the literal El. That is exactly what the acceptance
refuses a translation for, done afterwards, on the way out. It cost `en_grok`
nothing only because `en_grok` had already resolved all 1522 of its own lines
and left the pass nothing to spoil — which was itself the larger fault, and is
repaired now. `docs/player-name-token.md` is that pass.

**Then the unicode pass mangled it.** With the repair fixed, the token reached
`replaceUnicode`, whose katakana rule turns `ー` into a tilde. The patch went
out saying `＜エ~ル＞`, and the game, looking up a key it has never heard of,
would print the mangled token where the player's name belongs.

Both are fixed and both now have a guard. A token the game substitutes at
runtime is checked against the name table at every build — it is nobody's
misspelling, and there is no line of dialogue that could make it one — and
`replaceUnicode` takes the same list and carries those substrings through
untouched.

The lesson generalises past the token: **the acceptance guards the door, and
the build has three passes after it.** `normalizeNames`, `replaceUnicode` and
`wrapAt` all rewrite an accepted line before it reaches the `.ain`. Anything a
translation is required to preserve has to survive all three, and the only
thing that says whether it did is the built file.
