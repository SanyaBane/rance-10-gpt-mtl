# The in-game date

`ＬＰ７年１２月前半` is the date the game counts turns in: year 7 of the LP era,
twelfth month, first half. It reads `LP 7 Dec, early` now.

Nowhere is that string stored. `GameYear@ToString` builds it out of four
pieces, and every screen that shows a date calls that one function:

```
s[3678] = "%s%D年%D月%s"    %  YearTitle  %  Year  %  Month  %  HalfText
```

`%D` is the full-width digit conversion, which is why the year and the month
came out as `７` and `１２` rather than as `7` and `12`.

## Where it is drawn

| Caller | What it is | Font |
|---|---|---|
| `LPYearView@SetParam` | the banner across the screen at the start of a turn | 50 |
| `CommonFrame@UpdateYear` | under the turn number in the corner frame | 24 |
| `AdvQuestInfo@SetParam` | the corner box during an ADV scene | 20 |
| `BraveModeView@SetParam` | inside the brave-mode caption, `s[3500]` | 60 |

Four callers, one function, so one patch covers all of them. Nothing compares
what it returns: each of the four assigns it to an `ActivityLabel` or formats
it into one.

There is a fifth screen that shows the same date and is not on this list.
`ResultYearView@SetParam`, the war-result screen, draws the year and the month
as numeral parts and the half as a **picture** — which is what makes the
translation harder than it looks.

## Two of the four strings are shared, and one of them is a filename

`s[3111]` = `前半` and `s[3112]` = `後半` are pushed by
`GameYear@HalfText::get`, and also by `ResultYearView@SetParam`:

```
Activity@GetCg("Half").SetCgName("シス／戦況／年月／%s" % (Half == 0 ? "前半" : "後半"))
```

That is a CG name. `シス／戦況／年月／前半.ajp` and `シス／戦況／年月／後半.ajp` are
real entries in `Rance10CG2.afa` — lines 1090 and 1091 of
`archives/Rance10CG2_manifest.txt`. Translate the slot and the war-result
screen asks for a picture that does not exist.

So the strings keep their Japanese and the display is patched, which is the
rule `CLAUDE.md` keeps for exactly this case and what `patches/card_names.jaf`
does for a card Id.

The other three are the easy kind and are patched anyway, because they are the
same decision. `s[3672]` `ＬＰ` and `s[3673]` `ＲＡ` are read by nothing but
`GameYear@YearTitle::get`, and `s[3678]` and `s[3679]` by nothing but
`ToString`. All four still say what they always said in the built `.ain`; the
English is pushed by the patched function instead.

## Why it is a `.jam` and not only a `.jaf`

The month has to arrive as a name, and a `.jaf` cannot get at it.

`GameYear` stores its four fields as properties, which is what the angle
brackets in `alice ain dump -S` mean:

```
struct GameYear {
    GameChapter#92 m_chapter;
    string <YearTitle>;
    int <Year>;
    int <Month>;
    int <Half>;
};
```

Every spelling of a read is refused:

| written in a `.jaf` | alice-tools 0.13.0 answers |
|---|---|
| `Year` | `Undefined variable: Year` |
| `this.Year` | `Invalid struct member name: Year` |
| `this.Year()` | `Invalid struct member name: Year` |
| `this.m_chapter` | compiles — a plain member resolves |

So `override string GameYear@ToString(void)` cannot read the month it has to
name. Overriding the getters instead does not help either: `Month::get`
returns an `int`, and the format string is what turns that into text.

Two more things the compiler will not take, found on the way and worth
writing down beside the ones in [number-format.md](number-format.md):
`switch` is `switch not supported`, and `"%d" % this.m_chapter` stops at
`compile_dereference: Unsupported type`, because the member is an enum.

What is built is therefore split:

- `patches/lp_date.jaf` — `GameYearEraName`, `GameYearMonthName` and
  `GameYearHalfName`. All the English, and a chain of twelve `if`s for the
  months.
- `patches/lp_date.jam` — `GameYear@ToString` re-emitted with the new format
  literal, calling those three by name.

`scripts/ain.js` hands the `.jaf` over first; the other order stops with
`Unable to resolve function`, the same way `patches/enemy_panel_cards.jam`
needs `patches/card_names.jaf` before it.

The `.jam` also swaps which getter supplies the half: the original called
`HalfText::get`, which returns `前半`, and the patch calls `Half::get` and
hands the `int` to the `.jaf`. That keeps `s[3111]` and `s[3112]` out of the
chain altogether rather than depending on them still reading Japanese. It
leaves both `HalfText` getters with no callers at all, the way `表示規模` has
none.

## What it says, and why

`"%s %d %s, %s"` — `LP 7 Dec, early`, `RA 15 May, late`.

The whole calendar is thirty-one rows of
`archives/Rance10EX_v1_04/36_ＬＰ情報.x`: chapter 1 runs LP 7/9 to LP 8/6 over
eighteen turns, chapter 2 RA 15/2 to RA 15/7 over thirteen. So there are three
year numbers, twelve months and two halves, and the widest string the patch can
produce is known rather than guessed.

Measured with `gameTextWidth` over every one of those turns, the English is
narrower than the Japanese it replaces at all four sites:

| | widest Japanese | widest English |
|---|---|---|
| turn-start banner (50) | 441px | 419px |
| corner frame (24) | 207px | 193px |
| ADV box (20) | 153px | 129px |

The corner frame is the one that decides the wording. Its 207 Japanese pixels
already fill the opening in `シス／共通枠／左上` where the text sits, at the
bottom of the turn circle, so there is no slack: `LP 7 Dec, 1st half` is 243px
and would run out over the gold. `early` and `late` fit, and say the same thing.

The layout placeholders are no help here and should not be trusted:
`CommonFrame01A` carries `LP9年12月後半` and `AdvQuestInfo` carries
`LP99年99月前半`, both typed half-width, and both are **narrower** than the
full-width text the game actually draws — 174px and 137px against 207px and
153px. The artwork is the budget.

## The brave-mode caption

`s[3500] = "%s（%Dターン）終了"` is the one place the date is wrapped in
something rather than drawn alone. Its slot is that caption's own, so it is a
line in `patches/system_cherry_picks.v1.04.ain.txt` rather than a second
function in the `.jam`:

```
s[3500] = "%s (turn %d) over"
```

`over` rather than `complete` because it has to fit. The underline under that
caption, `シス／勇者／年号下線`, is 1024 pixels wide and the caption starts 35 in;
the widest this renders is `RA 15 May, late (turn 10) over` at 972 of the 989
that leaves. `(turn %d) complete` is 1121 — wider even than the Japanese, which
at 1062 already overruns the underline.

## Chapter 2 always says "late"

`36_ＬＰ情報.x` stores `half = -1` for all thirteen turns of chapter 2, and the
original getter tests `Half == 0`, so the game has always drawn `後半` for every
one of them. `GameYearHalfName` keeps that test and therefore keeps the quirk.
It is the game's own, not a hole in the translation, and reproducing it is the
point of testing the value rather than inventing a third case.

## Rebuilding it for a new game version

Every number in `patches/lp_date.jam` indexes one build of one `.ain`. Take the
function again and put the four changes back:

```
alice ain dump --function GameYear@ToString game/ain/Rance10.v1.04.ain
```

The changes are listed at the top of that file. None of them adds a local,
which is the constraint `--jam` imposes: it rewrites code and leaves the `FUNC`
section alone, so a patched function keeps the locals it was compiled with.

Then verify against the built `.ain` rather than against the patch:

```
node scripts/ain.js --out=build/scratch-date
alice ain dump --function GameYear@ToString build/scratch-date/Rance10.ain
alice ain dump --function ResultYearView@SetParam build/scratch-date/Rance10.ain
```

The second of those is the one worth reading: it should still push
`シス／戦況／年月／%s`, `前半` and `後半`, untouched.
