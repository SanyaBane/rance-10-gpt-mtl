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

Which is checkable, and a ruler of forty-five full-width digits checked it:
widened to thirty-six, the backlog draws thirty-six of them and stops. The
declaration is the box, to the character.

What English does in that box is a different number, and it is below -- 35.4
rather than 36.0, because `gameTextWidth` reads English about a percent and a
half narrow against full-width digits.

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

A reading rather than a measurement, and about a percent generous: the key-wait
mark need not sit flush against the last character it waits after, and the
rulers below put the same division nearer 39.6. Everything in this section is
within that percent either way; where it matters is that the numbers derived
from 40.1 are the *designed* box, and the edge a row actually stops at was
measured instead.

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

Rulers built into a scene and screenshotted in both windows. Two kinds: a run of
full-width digits, which reads a box off directly because a full-width character
is one unit in every metric here, and English rows grown to an exact width and
labelled with that width at **both** ends -- so the reading is whether a row's
closing bracket is on the screen rather than a count of glyphs off a screenshot.
The wrap has to be skipped for those rows: the build folds every ruler before
the game can be asked anything.

**It clips. Nothing wraps at runtime.** No ruler moved onto a second line; each
one simply stops. So a row wider than the window loses its tail rather than
growing a line, and `docs/text-languages.md` was right.

Three runs, and each answered what the one before could not. The first, over
`ネルソン／キャライベントＣ` with the text area still at x=470, found the ordinary
window stopping at 36.1 and the backlog somewhere between 30 and 33. The second
widened the backlog's declared box and put one English row through it. The
third, over `０２／スタート`, is the two tables below: both windows read after
both moves, each in its own metric.

### The ordinary window: 38.4 to 38.8

| ruler | width | drawn |
|---|---|---|
| forty-five full-width digits | -- | **38** of them |
| `[W37.6]` | 37.60 | whole |
| `[W38.0]` | 37.99 | whole |
| `[W38.4]` | 38.39 | whole, closing bracket and all |
| `[W38.8]` | 38.80 | cut; the last character drawn ends at 38.39 |
| `[W39.2]` | 39.20 | cut; the last character drawn ends at 38.80 |

So the edge is in **[38.39, 38.80)**. The 38.1 this file used to carry was
arithmetic -- 1920 less the origin at 390, over 40.1 px a character -- and it is
about 1.3% low, because that 40.1 was itself read off where the event window
puts its key-wait mark rather than measured. These rulers make the same division
nearer 39.6 px.

What the edge is a property of has not changed: 390 + 38.6 × 39.6 = 1919 against
a 1920-wide screen. No layout in the `.pactex` tree gives the window a width, so
what stops a row is the screen, and the origin is the whole of what decides how
much of it the window gets.

### The backlog: 35.4, and it is what binds

| ruler | width | drawn |
|---|---|---|
| forty-five full-width digits | -- | **36** of them, the declared box exactly |
| `[B34.6]` … `[B35.4]` | up to 35.39 | whole |
| `[B35.6]` | 35.61 | cut; the last character drawn ends at 35.16 |
| `[B35.8]` | 35.80 | cut; the last character drawn ends at 35.35 |
| `[B36.0]` | 35.99 | cut through a character, at 35.54 |

**The edge is in [35.39, 35.54)** -- a quarter the width of the 35.23 … 35.87
one row of the second run left, and it is what a budget is held to. The ordinary
window is nowhere near binding: at any budget the backlog allows, the widest row
the build emits is about 33.5 in the window's metric against the 38.4 above.

Both are far past the 24.2 the window is drawn for. Being over the designed
width costs nothing up to the edge; the design is where Japanese sits
comfortably, not where the box ends.

### What the four instruments were disagreeing about

The first run left a puzzle this file recorded as unexplained: four rulers
stopped at the same place in the backlog and disagreed by 27% about how wide
that place was -- full-width digits 33.0, English 30.6, dots 26.1, `i` 28.1.

The model is the tracking. All four were quoted in the **ordinary window's**
metric, `文字間隔 -2` at font 57, while standing in the **backlog**, `字間隔 2`
at font 40. That is 0.085 of a full-width character per character between them,
which is nothing across thirty full-width glyphs and most of the width of a
hundred dots. Read again in the metric of the window they were actually in:

| instrument | quoted | characters | read again |
|---|---|---|---|
| full-width digits | 33.0 | 33 | **33.00** |
| English | 30.6 | 56 | **32.74** |
| dots | 26.1 | 100 | **32.28** |
| `i` | 28.1 | 107 | **34.53** |

Against a box of thirty-three. So `gameTextWidth` with the layout's own `字間隔`
does describe this window across character classes, to about 5%, and the lesson
is the one `trackingFor` already exists for: **a width quoted without saying
which layout's tracking it is in is not a width.**

What is left after that is real and small, and the third run's class rulers say
which way it goes: a row of dots measuring 35.60 is cut where a row of `M`
measuring 35.61 is drawn whole, so wide glyphs are still overstated a little and
narrow ones understated. English falls between, about 1.4% narrow -- the box
that draws 36 full-width digits stops English at 35.4. That is a correction to
carry on the answer rather than a change to the model, because the question is
only ever asked about English.

### What that settles about the budget

Lowering the budget toward 24 was always the wrong direction: it would convert
rows that draw perfectly well into folded ones, and a fold costs a fourth line
in a three-line window, which is cut at the bottom. Horizontal overflow is free
to the edge of the box. Vertical overflow is not free at all.

Where the rows sit, in the backlog's metric, over the 268 541 rows carrying
English a build renders today:

| row width | rows | |
|---|---|---|
| ≤ 24, the designed width | 199 756 | 74.4% |
| 24 – 35.4, over the design and inside the box | 60 486 | 22.5% |
| > 35.4, past the backlog's edge | 8 299 | 3.1% |

The last row is what no budget reaches: those rows are folded, and shortening
them by meaning is the only thing that would draw them in one line.

**And there is no headroom left in the margin.** The widest row the build emits
today is 35.19 against an edge of 35.39, so `WRAP_SAFETY_MARGIN = 0.95` already
sits two tenths of a character inside the box: 0.96 puts 2 rows past it and 0.97
puts 45. What is still on the table is the instrument rather than the margin,
and the section below has that.

## The current English is wider than the window

| | median | p90 | p95 | p99 | max | over its window |
|---|---|---|---|---|---|---|
| ordinary window, English | 15.7 | 26.7 | 28.5 | 30.0 | 31.2 | **17.6% over 24** |
| event window, English | 18.6 | 28.5 | 29.4 | 30.2 | 31.0 | 0.0% over 31 |

The wrap in `modules/TextNormalization.js` breaks a line at
`0.95 × getTextWidth(LONGEST_DIALOGUE_LINE)` — 0.9 until the backlog's box was
widened. The table above was measured at 0.9, with the ordinary window's origin
still at 470, and before `scripts/bake_speech_rows.js` laid 4535 speeches back
into their rows, so read it as the state before all three. The spread that is
current is the one in the section above.

That it is measured in Meiryo, which is not the game's font, is the part worth
knowing, and with the margin settled it is the only thing left to gain. **The
instrument that decides the fold is not the one that decides the clip.** Meiryo
understates capital-heavy English by about a sixth and overstates narrow letters,
so one budget over one corpus has to carry enough slack for the worst class of
row -- and the rows that are not that class get folded for nothing. 2279 of the
10 576 messages a build folds today would have been drawn whole.

Handing `wrapAt` `gameTextWidth` takes those back, at the measured edge and
without cutting anything:

| | folds | speeches over their window | rows past 35.39 |
|---|---|---|---|
| `getTextWidth` × 0.95, today | 10 576 | 839 | 0 |
| `getTextWidth` × 0.96 | 9 819 | 780 | 2 |
| `getTextWidth` × 0.97 | 9 079 | 729 | 45 |
| `gameTextWidth` ≤ 35.39 | **8 296** | **671** | **0** |

2280 folds, and 168 of the 839 speeches `find_speech_gaps` reports as running off
the window. The margin buys half of that and starts clipping to do it.

Not a change to make casually: `docs/text-width.md` says why `getTextWidth` is
still there, `modules/SpeechRows.js` and `modules/SceneAcceptance.js` both ask
it the same question on purpose, and every row of `en_grok` would render again.
But the measurement no longer leaves the question open.

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

**Keep a row inside the window.** Two different numbers, and they are not the
same rule. The *designed* width -- where Japanese sits comfortably and where the
key-wait mark is -- is twenty-six full-width characters for the ordinary window
since its origin moved to 390, twenty-four before that, and 31 for the ●…Ｅ
lines, which the scene file does not say. Nothing is lost for being over it.

What is actually lost is the tail of a row past the **edge**, and the backlog's
is the one that binds: **35.4**. The window's own is 38.4, so a row that survives
the backlog survives the window with three characters to spare.

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
