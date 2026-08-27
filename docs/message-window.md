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
| `CALLFUNC ■歴史枠`, once in the game | `MessageWindowHistory` | 18 |

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

## The backlog is somewhere else entirely

Nothing in that switch draws the backlog. `MessageWindowHistory` is the frame
`■歴史枠` puts up for the prologue chronology and nothing else. The table above
named it the backlog for a long time, and what shows that up is that moving its
text does not move a character on the backlog screen.

The backlog is `backlog::detail::CBackLogView`, drawn from
`archives/Rance10Pact_v1_04/Asra/バックログ.pactex.x` -- a background, two text
parts, a swipe area, a vertical scroll bar and a back button. The log itself is
`SYS_通常テキスト`:

| | |
|---|---|
| `座標` | 105, 127 |
| `フォントサイズ` | 40 |
| `字間隔` | 2 |
| `行間隔` | −5 |
| rows | 24, the scroll bar's `表示量` |
| the scroll bar | x = 1254 |

So the text starts at 105 rather than 250, and the font is two sizes smaller
than this file used to say. Anyone measuring the backlog with `フォントサイズ 50`
and `文字間隔 -2` was measuring the chronology frame.

**Its width is declared rather than derived.** The design note the placeholder
carries says so itself: the font, `字間隔`, `行間隔`, `文字数（横幅）` and the
coordinates are all read from this part, and the row count from the scroll
bar's `表示数`. The box is therefore the number of characters in the
placeholder's first line, and that line was thirty-three full-width digits.

Which is checkable, and this commit checked it: widened to thirty-six, the
backlog drew a row of 34.15 whole -- a width a box of thirty-three could not
have held. A row of 35.87 is still cut, so the edge now sits between 35.23 and
35.87. One measurement on one English row, and the character-class caveat below
applies to it as much as to the rulers.

There is not much left to take: 105 leaves almost nothing to the left, and the
scroll bar at 1254 stands about a character past where thirty-six ends.

## What the layout states, and what it does not

`archives/Rance10Pact_v1_04/MessageWindow0*.pactex.x` carries a placeholder, the
way every other part does — and a placeholder is the designer's own statement of
the box, which is how `docs/synopsis-screen.md` settled the synopsis panel at
twenty full-width characters by seven rows.

| part | placeholder | states |
|---|---|---|
| `MessageWindow01` | three lines of prose, 14/11/16 characters | three rows, and nothing about the width |
| `MessageWindow02` | `１２３４５６７８９０１２３４５６７８９０１２３４５６７８９０１` twice | **31 × 2** |
| `MessageWindowHistory` | forty full-width characters, eighteen lines | **40 × 18**, and it is the chronology frame rather than the backlog |

`テキストエリア` is an origin and two zeroes: `{337, 170, 0, 0}` for the event
window, and `{470, 226, 0, 0}` for the ordinary one as the game shipped it. This
patch moves the latter to `{390, 226, 0, 0}`, where the name plate's own left
edge is -- `Game/Adv/NamePlate.pactex.x` puts its root child at x=390, and the
plate is drawn directly above the text that now lines up with it. No part in the
whole `.pactex` tree carries a text area with a width in it, so there is no
width to read directly.

## Twenty-four characters, from three directions

The event window fixes the scale. Its placeholder is 31 characters, its text
starts at x=337 and its key-wait mark sits at x=1580, which makes a full-width
character **40.1 px** at `フォントサイズ` 57 — that is 0.70 of the nominal size,
so `フォントサイズ` is not the advance and cannot be used as one.

At that scale:

- **the ordinary window is (1440 − 470) / 40.1 = 24.2 characters** — its text
  started at x=470 and its mark is at x=1440. This patch moves that origin to
  390, which makes the same box 26.2, and every count of characters from the
  origin below gains the same two;
- the chronology frame is (1670 − 250) / (40.1 × 50/57) = 40.3, against the 40
  its own placeholder states. A third window, a different font size, and within
  one percent. It is not the backlog -- see below.

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

## It clips, and the edge is measured

Rulers over `ネルソン／キャライベントＣ`, built into the game and screenshotted in
both windows: thirteen rows, four of them position rulers with a letter every
fifth character and nine of them ordinary English grown to an exact width and
labelled with it. The wrap had to be skipped for those rows — at 31.2 the build
folds every ruler before the game can be asked anything.

**It clips. Nothing wraps at runtime.** No ruler moved onto a second line; each
one simply stops. So a row wider than the window loses its tail rather than
growing a line, and `docs/text-languages.md` was right.

**The ordinary window draws to about 36 full-width characters, 1570 px.** Three
rulers agree, which is what makes it a measurement rather than a reading:

| ruler | stops at | width |
|---|---|---|
| `[40]`, `[44]`, `[48]` — three different rows | all three at the same word | 36.1 |
| the `M` ruler | inside the eighth group | 36.7 |
| full-width digits | about the 36th | 36.0 |
| `[36]` | drawn whole | 33.3 |

Those rulers were read with the origin at 470, and what they found is the
screen edge rather than a property of the window: 470 + 36.1 × 40.1 = 1918
against a 1920-wide screen, which is arithmetic agreeing with three rulers to a
fifth of a character. So the origin is what decides that edge, and moving it to
390 buys two characters -- **the window draws to about 38.1 now**. Derived
rather than measured: nobody has put a ruler in it since the move.

**The backlog cuts earlier**, and it is therefore the binding constraint. A
second run pinned it, with three English rows grown a character at a time so the
cut would land mid-token rather than at a space — which is what made the first
run's `[36]`…`[52]` all stop at the same word and say nothing finer:

| row | width | what the backlog did |
|---|---|---|
| `[30]` | 29.99 | drawn whole |
| `[32]` | 31.54 | cut after `walk`, losing two characters |
| `[34]` | 33.95 | cut in the same place |

So the last character it draws ends at **30.58** and the first it does not
begins at **31.10**. Call the edge 30.8. `wrapAt`'s budget of 31.2 is a hair
past it: **1790 rows, 0.67%, lose a character or two there today.**

That kills the headroom the ordinary window seemed to offer. Raising the budget
to 33 would take the tails off 4360 rows in the backlog, to 35 off 7790. Lowering
it to 30.5 would fold those 1790 instead, and a fold costs a fourth line that is
cut at the bottom, which is worse than two characters at the right of a log
nobody reads twice. **So the budget was left where it was**, and that was the
measurement saying so rather than a preference.

It held only while the box was thirty-three. The box is declared in the layout,
widening it is a number, and once it was widened the budget followed -- see
below.

### One thing the rulers did not explain

Four instruments stop at the same place on the screen and disagree by 27% about
how wide that place is: the full-width digits say 33.0, the English rows 30.6,
the dots 26.1, the `i` ruler 28.1.

**The digits were right, and they were reading the box's own declaration.** The
backlog's width is the character count of the placeholder in `SYS_通常テキスト`,
and that placeholder was thirty-three full-width digits -- so the instrument that
answered 33.0 was the one measuring in the same units the designer wrote in. The
other three were measuring English, dots and `i` against a box declared in
full-width digits, which is a class the font does not scale between.

So `gameTextWidth` does not describe this window's proportions across character
classes, and no model here reconciles them. The English rows are what this file
quotes because the budget is applied to English and they answer in the units
`wrapAt` uses. Anyone starting a third ruler run should know the other three
instruments are not calibrated for it.

Both numbers are far past the 24.2 the window is drawn for. Being over the
designed width costs nothing until 36; the design is where Japanese sits
comfortably, not where the box ends.

### What that settles about the budget

The trade this file used to leave open — lower the budget to 24 — was the wrong
direction: it would have converted rows that draw perfectly well into folded
ones, and a fold costs a fourth line in a three-line window, which is cut at the
bottom. Horizontal overflow is free to the edge of the box. Vertical overflow is
not free at all.

The ordinary window looks like it offers headroom, and the rows are there to
take it:

| row width | rows | |
|---|---|---|
| ≤ 24, the designed width | 213 822 | 80.1% |
| 24 – 30 | 33 377 | 12.5% |
| 30 – 31.2 | 3 757 | 1.4% |
| **31.2 – 36** | **9 080** | **3.4%** — folded today, and the window would have drawn them |
| > 36 | 6 959 | 2.6% |

It became spendable when the backlog's box was widened, and the budget was
raised to take it: `WRAP_SAFETY_MARGIN` is 0.95 rather than 0.9. Running the
build's own wrap over the whole corpus puts that at 18 801 folded messages down
to 13 944 -- a quarter of them gone -- with the widest row it emits at 35.1 in
the backlog's metric, inside the 35.23 the backlog now draws to. Nothing is past
the edge at 0.95. At 1.00, 3501 rows would be.

## The current English is wider than the window

| | median | p90 | p95 | p99 | max | over its window |
|---|---|---|---|---|---|---|
| ordinary window, English | 15.7 | 26.7 | 28.5 | 30.0 | 31.2 | **17.6% over 24** |
| event window, English | 18.6 | 28.5 | 29.4 | 30.2 | 31.0 | 0.0% over 31 |

The wrap in `modules/TextNormalization.js` breaks a line at
`0.95 × getTextWidth(LONGEST_DIALOGUE_LINE)` — 0.9 until the backlog's box was
widened. The table above was measured at 0.9 and with the ordinary window's
origin still at 470, so read it as the state before both.

That it is measured in Meiryo, which is not the game's font, is the part worth
knowing. The row these rulers were cut from measures 427.0 Meiryo against a
budget of 421.7 and is folded; in the game's own font it is 34.15 against an
edge of 35.23 and would have been drawn whole. The instrument that decides the
fold is not the one that decides the clip.

Handing `wrapAt` `gameTextWidth` instead is worth 2123 folds at the same edge --
13 944 down to 11 821, with nothing past the edge either way. It wants a second
reading of that edge first: 35.23 is one measurement of one English row, and the
section above says why the other three instruments cannot check it.

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

**Keep a row inside the window.** Twenty-six full-width characters for the
ordinary window since its origin moved to 390, twenty-four before that; the
●…Ｅ lines get 31, which the scene file does not say.

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
