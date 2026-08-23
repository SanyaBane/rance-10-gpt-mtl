# The message window

What a translation is allowed to do with the length of a line of dialogue. The
short answer: **the words may be moved freely between the rows of one speech,
the number of rows may not change, and a row is twenty-four full-width
characters wide.**

`docs/text-width.md` is the same question for the panels, and its font table and
its two measured constants are what this uses. What it says about the dialogue
window — that nobody had settled it — is what this file replaces.

## How a line reaches the screen

Three functions in the game's own runtime, and nothing else:

| | |
|---|---|
| `message::detail::Message(n, text)` | draws `text`, and adds it to the backlog |
| `message::detail::R` | starts another row of the same speech |
| `message::detail::A` | ends the speech, waits for the click, starts a backlog page |

So a speech is a run of `m[]` rows joined by `R`, and the bytecode decides how
many rows it has. `modules/SceneScript.js` reads exactly that: the scene files'
blank lines are where `A` fell.

Which window it lands in is `AdvMessageWindow@GetMessageWindowActivityName`,
switching on the `viewType` each ADV command passes:

| command | window | rows |
|---|---|---|
| `●ト書き`, `●台詞Ａ`, `●思考Ａ`, `●左台詞Ｂ` and the rest of the Ｂ family | `MessageWindow01` | 3 |
| `●ト書きＥ`, `●台詞Ｅ`, `●思考Ｅ` | `MessageWindow02` | 2 |
| the backlog | `MessageWindowHistory` | 18 |

That is the switch, and the switch is not the whole answer: a scene can change
the frame under it. `CALLFUNC ■歴史枠` does, and it happens **once** in the
whole 60 MB of bytecode -- before the chronology in `６０１／プロローグ`, the
scrolling history of everything since Rance became Demon King. The 311 lines
after it run up to 41 full-width characters and are not in `MessageWindow01`
whatever their `viewType` says. Nothing else in the game does this: of the
`■…枠` commands only `■枠消し` is otherwise used, 3548 times, and that one
clears rather than switches.

Worth knowing because those 311 lines look like the counter-evidence to
everything below -- 41 characters in a box that holds 24 -- and they are not
in the box. Held out of the census, the game's own Japanese in
`MessageWindow01` runs over 24 on 3.89% of lines, and 4562 of those 9783 are
in functions named `t…`, which are the writer's notes to the scripter rather
than dialogue: `（的なことを言ってる）`, `大南さん判断に任せます`, once a bare
`if (確認("パットンが居る")==1)`. Over the scenes that are not those, it is
2.20%, and the widest line the window really draws is 50.

`MessageWindow01` draws 93.3% of the dialogue. 411 scenes use both it and the
event window, so which window a line is in is a property of the line and not of
the scene.

## What the layout states, and what it does not

`archives/Rance10Pact_v1_04/MessageWindow0*.pactex.x` carries a placeholder, the
way every other part does — and a placeholder is the designer's own statement of
the box, which is how `docs/synopsis-screen.md` settled the synopsis panel at
twenty full-width characters by seven rows.

| part | placeholder | states |
|---|---|---|
| `MessageWindow01` | three lines of prose, 14/11/16 characters | three rows, and nothing about the width |
| `MessageWindow02` | `１２３４５６７８９０１２３４５６７８９０１２３４５６７８９０１` twice | **31 × 2** |
| `MessageWindowHistory` | forty full-width characters, eighteen lines | **40 × 18** |

`テキストエリア` is `{470, 226, 0, 0}` for the ordinary window and `{337, 170, 0,
0}` for the event one: an origin and two zeroes. No part in the whole `.pactex`
tree carries a text area with a width in it, so there is no width to read
directly.

## Twenty-four characters, from three directions

The event window fixes the scale. Its placeholder is 31 characters, its text
starts at x=337 and its key-wait mark sits at x=1580, which makes a full-width
character **40.1 px** at `フォントサイズ` 57 — that is 0.70 of the nominal size,
so `フォントサイズ` is not the advance and cannot be used as one.

At that scale:

- **the ordinary window is (1440 − 470) / 40.1 = 24.2 characters** — its text
  starts at x=470 and its mark at x=1440;
- the backlog is (1670 − 250) / (40.1 × 50/57) = 40.3, against the 40 its own
  placeholder states. A third window, a different font size, and within one
  percent.

The game's own Japanese agrees, which is the fourth reading and the only one
that owes nothing to the geometry:

| | median | p90 | p95 | p99 | max | over its window |
|---|---|---|---|---|---|---|
| ordinary window, Japanese | 15.0 | 22.0 | 23.0 | 29.0 | 64.0 | 3.9% over 24 |
| event window, Japanese | 20.0 | 27.0 | 29.0 | **31.0** | 34.0 | 1.5% over 31 |

The event window's p99 lands exactly on the 31 its placeholder states. The
ordinary window's distribution has a cliff at 24 — 97% of all the game's lines
are inside it and the count of lines one character wider falls by four fifths.

Measured with `gameTextWidth` and the window's own tracking, `trackingFor(-2,
57)`: `MessageWindow01` says `文字間隔 = -2`, which is **negative**, where
`modules/GameFont.js` defaults to the synopsis panel's `字間隔 4` at font 48.
Measuring dialogue with the default overstates every line by an eighth of a
character.

## Whether it clips or overflows is still open

`docs/text-languages.md` says the message window clips. Nothing in the layout
says so — `クリップ領域` is four zeroes — and nothing here settled it. The panels
in `docs/text-width.md` are known not to clip; a window that clips loses the end
of the sentence, which is worse, so the question is worth an answer before
anybody spends the margin.

The method is the one `docs/text-width.md` describes: put rulers in place of one
scene's lines, build into a scratch directory, and read the screenshot.

## The current English is wider than the window

| | median | p90 | p95 | p99 | max | over its window |
|---|---|---|---|---|---|---|
| ordinary window, English | 15.7 | 26.7 | 28.5 | 30.0 | 31.2 | **17.6% over 24** |
| event window, English | 18.6 | 28.5 | 29.4 | 30.2 | 31.0 | 0.0% over 31 |

The wrap in `modules/TextNormalization.js` breaks a line at
`0.9 × getTextWidth(LONGEST_DIALOGUE_LINE)`, which is 31.2 full-width characters
in the game's font — the event window's width, applied to every line. The event
window is therefore served exactly and the ordinary window, which draws
thirteen times as much text, is served about 30% too generously. 47 013 rendered
rows are wider than the window they are drawn in.

Retuning that budget would rewrite the `en_grok` patch, so it is not done here.

## What a translation may do

**Move words between the rows of one speech: yes, freely.** Nothing reads a row
on its own.

- The backlog is fed by the same three functions — `AddText` per row,
  `AddNewLine` per `R`, `AddNewPage` per `A` — so it replays whatever the window
  showed.
- There is no voice to fall out of step with. `message::detail::VOICE` exists,
  and the `VOICE` command that would call it is never called anywhere in the
  game's 60 MB of bytecode.
- The read flag and the default save comment are keyed by the message number,
  not by its text.

**Change the number of rows: no.** The rows are `MSG` operands in the bytecode
and a translation cannot add or remove one. A row can be left *empty* — the game
does it itself, in nine of the ten messages that are blank in Japanese, all of
them mid-speech — but an empty row still draws a blank line, so blanking one
shortens the text and not the speech. It is also not expressible today:
`assemblePatch` in `modules/SceneTranslations.js` reads an empty English cell as
"not translated yet" and leaves the line to the language underneath.

**Keep a row inside the window.** Twenty-four full-width characters for the
ordinary window; the ●…Ｅ lines get 31, which the scene file does not say.

## What acceptance checks

`modules/SceneAcceptance.js`, both of them per speech rather than per line:

- **A refusal** when a speech needs more lines than the window draws, measured
  with the build's own wrap so that it refuses exactly what the build would
  split. The budget is the greater of three rows and the rows the speech has,
  because the Japanese line count is by definition acceptable — 1241 of the
  game's own speeches run past three rows. 4455 of the current draft's 166 173
  speeches are over, 3274 of them by exactly one line, and the fix is always to
  spread the English across the rows the speech already has rather than to pour
  it into the first one. `m[43]` is the pattern: three Japanese rows became one
  English row plus an empty one, and the build wrapped the full row back into
  two.
- **A warning** when a row is wider than 24 full-width characters. A warning
  rather than a refusal because the build's own budget is 31, so most of the
  existing draft would be refused, and because the event window's rows would be
  warned about without deserving it.
