# A speech is not always one person talking

```
191402  El Mofus     「…………。」
191403  Reset Kalar  「えっ、＜エール＞ちゃん？」
```

Two `MSG` in one window with no click between them, so `speechesOf` gathers them
into one speech — correctly, that is what the bytecode says. Hand that speech to
`layOutSpeech` and it balances both lines as one text across both rows:

```
m[191402]  "「............」 「Eh,"
m[191403]  "　＜エール＞-chan?」"
```

El's silence carrying the first two words of somebody else's question, and a
continuation indent on the answer because the joined text opened with a `「`.

## The rule

The rows of a speech are all on screen together, nothing reads a row alone, and
the backlog replays the same rows — which is why the layout is free to move
words between them at all (`docs/message-window.md`). That freedom stops at a
change of speaker. **Words may move anywhere inside one voice and never across
one.**

`speechesOf` splits each speech into `voices`, and `layOutVoices` in
`modules/SpeechRows.js` lays out each of them into its own rows. The speech is
still the unit everywhere else: it is one window, one click, one budget, and it
is what a translator is handed.

**297 speeches of 166177 hold more than one voice**, none of them more than two:

| shape | speeches |
|---|---|
| one character answering another | 254 |
| a character, then the narration | 34 |
| the narration, then a character | 9 |

## Why `?` is not a voice

A speaker cell of `?` is what `scripts/extract_scenes.js` writes for a message
with neither a portrait nor the narration flag. Read as a voice of its own it
would cut **592 more speeches**, every one of them in a place where nobody new
is speaking:

```
262  Sanakia Drelshkaf  「で、中身は…………
263  ?                  　っ、きゃああああぁぁぁっ！？」
```

One of Sanakia's sentences across two `MSG`, the second of which the bytecode
gives no portrait to. The quote opens on one row and closes on the next, and the
continuation indent is right there in the Japanese. So `?` carries the voice
above it on, exactly as `+` does — `CONTINUES` in `modules/SceneFile.js`.

That is the whole calibration. `-` (narration) and a name are voices; `+` and
`?` are not.

## Where the layout actually reaches the game

Worth being exact about, because the obvious answer is wrong. A text language
with `scenes/` is rendered **row by row out of the files** —
`readSceneDialogue` in `modules/Corpus.js`, which is what
`scripts/regenerate_aai_txt.js` calls — so `layOutSpeech` is not in that path at
all. Switching the layout to voices changes **0** of the 271601 effective
assignments a build of `en_grok` writes today.

What the layout is in is the three places that decide what those files say:

| | |
|---|---|
| `scripts/bake_speech_rows.js` | writes a layout **into the corpus**, and so into every build after it |
| `modules/SpeechGaps.js` | offers a layout as the fix for a fold or an overflow |
| `assemblePatch` | for a text language rendered as one `dialogue.ain.txt` |

The bake is the one that costs something. It is also how this class stopped
being hypothetical.

## What it has cost: one speech, and it is in the game

`d4dfe0661` — "4535 speeches are drawn in the rows the game gave them" — laid
out `033119.tsv`'s three-row speech as one text, and the narration's tail landed
on the row the game draws Wass's line on:

```
204576  -     The meeting was on the day the adventure
204577  +     began, when you saved the two who were
204578  Wass  about to be executed by sky burial. 「I see......」
```

Repaired here by giving the narration its own two rows and Wass his own. Exactly
three `m[]` change, which `scripts/effective_map.js` confirms against the number
of rows edited.

**One, out of 297.** The bake only ever touches the speeches
`find_speech_gaps.js` reports, and only 4535 of them, so the class was mostly
spared by that narrowness rather than by anything checking it. A sweep over
every voice boundary in the corpus — the previous voice's last row should end
its own sentence and the next voice's first row should start one — finds this
one and three false positives (a row ending `――`, and two `＜…＞` sound effects,
which begin a line without a capital).

## How it was found

`033244.tsv` had a blank line added to it by a refining pass, which split one
window into two, and `scripts/check_scenes.js` reported it. Putting the boundary
back (`f5e714fd6`) made `layOutSpeech` produce El's silence and Zance's answer
as one balanced text — which read worse than what the broken file produced, and
in a way the build's own row-by-row rendering hid. The split file had been
reading better by lying about where the window ends, and the class it was
accidentally working around was 297 speeches wide.
