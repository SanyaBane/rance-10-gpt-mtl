# Only the English column is ours

A scene file is five columns and four of them are the game's:

```
217127	-		喉が火に焼かれた――	Your throat felt as though liquid fire had been poured down it—
217128	+		と、思った直後、	and a split second later,
```

The `m[]` number, the speaker the bytecode names, what the portrait is doing,
and the Japanese. Those four are a checksum, which is the whole reason
`modules/SceneFile.js` carries them beside the translation: a diff between the
extraction and the translation is then exactly the change in the English, and a
game version that moved the numbers says so at assembly instead of in the game.

`scripts/check_scenes.js` is what asks whether they still agree.

```
node scripts/check_scenes.js                      # the whole text language
node scripts/check_scenes.js --scene=033243       # one scene
node scripts/check_scenes.js --class=structure    # one class, all of it
node scripts/check_scenes.js --limit=20           # more of each class
node scripts/check_scenes.js --text-lang=en_opus  # another translation
```

It exits 1 when a file has moved away from the game, so it can stand before a
commit.

## Why nothing checked this before

The driver in `docs/scene-driver.md` cannot produce the fault.
`modules/SceneAcceptance.js` judges what a translator *answers* — rows of
`N<tab>english` — and `modules/SceneTranslations.js` then writes the file
itself, from the source scene, taking **only the English** out of that answer.
Nothing a translator says can move a line number or a speaker, by construction.

That covers one way of translating a scene. It does not cover the other one:
handing an agent the `.tsv` and asking it to improve the English in place. Then
the four columns nobody is supposed to touch are one careless rewrite away from
moving, and the diff of a 250-line file where every line legitimately changed is
not read line by line.

Which is not hypothetical. Commit `a2a62d738` "Refine translation":

| file | what it did |
|---|---|
| `033243.tsv` | joined two narration speeches into one — speaker `-` rewritten to `+`, the blank line before it deleted — twice |
| `033244.tsv` | split one speech into two, by adding a blank line |

Neither touched a word of English. Both change which rows the build lays a
speech into, because **the blank line is the speech boundary**: `speechesOf`
gathers rows into utterances by it, `assemblePatch` lays each utterance back
into exactly the rows the bytecode gave it, and a boundary in the wrong place
moves the English across a click.

Two more, live in the working tree and repaired before they were committed, had
gone further: one rewrote the Japanese itself, moving a `」` off the end of one
row and a `「` off the start of the next so that two speeches read as one.

## The six classes, worst first

**parse** — the file is not a scene file. A row with four columns or six, which
is what a raw tab in a cell makes. The file is not read any further, so it is
also the only class that hides the others.

**line** — an `m[]` number that is not this scene's: one the game does not have
at all, one out of order, or one another scene already claimed. Every one of the
game's 269676 messages sits in exactly one scene function, so two files claiming
a number is a copy-paste between scenes. Gathered per pair of files rather than
per row — a whole scene copied to a second name is one mistake, not two hundred.

**japanese** — the Japanese column disagrees with the game. Held against
`game/ain/Rance10.v1.04.ain.json` through `modules/LineNumbers.js`, so it needs
no alice-tools, no `GAME_DIR` and no build.

**structure** — the speaker, the portrait state, a speech boundary or a route
marker moved, or the cast list or the scene name did. This is the class that
catches the two commits above.

**file** — the file itself: its name against the scene id in its header, and
whether rendering what was parsed reproduces it byte for byte. That second one
is `scripts/extract_scenes.js`'s own assertion turned on the translation, and it
covers the escaping, the column count, the blank lines and the line endings at
once. It is what fires when something that does not know the format has written
the file back — CRLF over LF, a space added to the end of a cell, the final
newline dropped.

**english** — the two things about the English that are not questions of taste:
a dropped `＜エール＞`, which writes one player's name into everybody's game
(`docs/player-name-token.md`), and a gender branch answered with one sentence,
which throws away half of what the game plays. Both are silent in the English on
its own. **Not counted towards the exit code**, because 18 of the first are
deliberate.

## The structural half needs an extraction

The Japanese and the line numbers come from a committed dump. The speaker, the
portrait state and the speech boundaries are in the bytecode and in no committed
table, so the only thing that knows them is `build/scenes/<lang>/`, written by
`npm run extract-scenes`. Without it that class is skipped and the report says
so.

**Any language's extraction will do**, and the report says when it borrowed one.
The structure is the game's, not the translation's: `extract_scenes` takes the
numbers, the speakers and the row boundaries from the `.ain` and only the
English column from the corpus. So an extraction is never contaminated by the
translation being checked — which is also why re-extracting after a bad edit
gives back a clean reference rather than blessing the edit.

## What it reads on `en_grok` today

| class | findings | what they are |
|---|---|---|
| line | 1 | `032887.tsv` `m[185445]` |
| structure | 5 | the two commits above |
| english | 20 | 18 deliberate, 2 real |

`m[185445]` is not a scene fault. The line exists in the game and in
`game/ain/Rance10.v1.04.ain.txt`; it is missing from
`game/ain/Rance10.v1.04.ain.json`, which holds 269676 of the dump's 269677 `m[]`
lines. The extraction wrote the row with an empty Japanese cell because that is
what the JSON had to give it. Re-running `node scripts/parse_ain_txt.js`
regenerates the JSON from the dump and closes it — a 30 MB committed file and
one more line for every build to render, so it is a decision rather than a
cleanup.

The 18 `english` findings are the ones `docs/player-name-token.md` names: lines
whose English says "you" where the Japanese says the token, and two the draft
dropped. The other 2 are gender branches the draft really did flatten.

## What it cannot see

A translation that is wrong. Whether a speech fits its window is
`scripts/find_speech_gaps.js`, whether it kept its brackets is
`scripts/find_speech_brackets.js`, whether it spells the names right is
`modules/NameNormalizer.js` and the checker beside it. This report asks the one
question none of those can: is the row still the row the game gave us.

And it cannot see an edit that moved the English between rows of the same
speech, because that is not an edit — the rows of an utterance are where
Japanese typesetting fell, the translation is stored per speech, and
`modules/SpeechRows.js` lays it out again at assembly. Moving words across a
blank line is a different thing from moving the blank line, and only the second
is a fault.
