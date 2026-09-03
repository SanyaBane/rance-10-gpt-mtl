# The "new" badge on a button, and the label that is also its key

Two buttons in the game carry a badge when there is something unseen behind
them: `MENU`, for anything new in the menus, and the party button, for a party
bonus nobody has looked at. Both badges had been off for as long as those
buttons have been in English — because the badge is decided by comparing the
button's own label against a Japanese literal.

```
npm run regenerate-ain          # generates build/new_mark_buttons.jaf and applies both files
```

| File | What it is |
|---|---|
| `modules/NewMarkButtons.js` | the two keys and how to recognise a translation of each — hand-written |
| `archives/Rance10Pact_v1_04/` | the labels themselves, one per `TextButton` user component |
| `build/new_mark_buttons.jaf` | the mapping function the build compiles — generated, gitignored |
| `patches/new_mark_buttons.jam` | `TextButton@Init` re-emitted with the comparison patched |

## What the button does with its label

A text button is a user component, and the layout hands it one string:

```
データ = (list) { "オブジェクト名", "TextButton", "パラメータ", "幅１９６,ＭＥＮＵ" },
```

The engine splits that on the comma before the class sees it, so `param[0]` is
the template — `Game/Component/TextButton/幅１９６`, which is where the button's
width, font and frame live — and `param[1]` is the label. `TextButton@Init`
(FUNC 22890) draws the label and then asks two questions about it:

```
SetText(text);
if (text == "ＭＥＮＵ") {
        m_newMarkView = new NewMarkView("Menu");
        m_newMarkView.ParentPartsNumber = m_act.GetParts("").PartsNumber;
} else if (text == "部隊編成") {
        m_newMarkView = new NewMarkView("NewMarkFlagTypeLocal::PartyBonus");
        …
}
```

`NewMarkView@Init` (22623) reads that argument as the name of a flag: anything
starting with `NewMarkFlagTypeLocal::` is the local enum, everything else goes
through `NewMarkFlagTypeGlobal::Parse`, where `Menu` is 1. `UpdateShow` then
follows the flag, and the badge appears over the button while it is set.

So the label is a display string and a lookup key in the same breath, which is
the class of trap `CLAUDE.md` keeps a section for — except that here the two
cannot be separated the usual way, because the string being compared *is* the
string being drawn.

## What it cost

Both translations were made in good faith and neither showed a symptom. The
button still draws, the click still works, and a badge is absent exactly when
there is nothing new — so its absence reads as "nothing new" rather than as a
bug.

| Where | Was | Became | Commit |
|---|---|---|---|
| `Game/Title/SceneTitle.pactex.x` | `ＭＥＮＵ` | `Menu` | `1a3e20788` |
| seven layouts | `部隊編成` | ` Form\nSquad` | `bf46ac1bd`, reformatted in `0b842a319` |

The `MENU` half is narrower than it looks: ten buttons in the archive still say
`ＭＥＮＵ` and were never touched, so only the title screen's badge was lost. Two
more say `ＭＥＮＵ ` with a trailing space — `Game/Challenge/SceneChallenge` and
`Game/Omake/SceneYakata` — and those are the game's own files, untouched since
the archive was unpacked. They have never matched and never had a badge; making
them match would be changing the game rather than translating it, so they are
left alone.

## Why the comparison is patched rather than the string

The repository's usual answer to a string that is also a key is to keep the
Japanese in the data and patch whatever displays it — `patches/card_names.jaf`
for a card Id, `build/race_names.jaf` for a race. The mirror image of that,
where the string is already English and one caller wanted the Japanese, is
`build/party_bonus_icons.jaf` and `build/title_keys.jaf`.

Neither shape fits here. There is exactly one string, it is read once, and the
same read both draws the button and decides the badge. Keeping the key means
keeping the Japanese label; translating the label means losing the badge. What
is left is the comparison itself, and that is what
`patches/new_mark_buttons.jam` changes:

```
	.LOCALREF text
	A_REF
	CALLFUNC TextButtonNewMarkKey
	S_PUSH "ＭＥＮＵ"
	S_EQUALE
```

`TextButtonNewMarkKey` maps an English label back to the Japanese key and hands
everything else back unchanged, so every other button in the game — and both
keys still in Japanese — reaches the comparison exactly as it did unpatched.
The label itself is never touched: `SetText` has already run four instructions
above the first comparison, and nothing this function returns is ever drawn. The
worst case of a wrong row is therefore a missing badge, which is where this
started.

## Why a `.jam` and not an override

`override void TextButton@Init(array<string> param)` compiles, and then two
things in it do not:

- `param.Numof()` **segfaults the `.jaf` compiler**, in every form tried —
  as a condition, as an assignment to a local. The original's first statement
  is `if (param.Numof() != 2) return;`, so an override cannot even reproduce
  its guard.
- A method of the class being overridden does not resolve. Both `SetText(text)`
  and `this.SetText(text)` are `Undefined variable: SetText`, so an override
  cannot call `super(param)` with the key substituted and then put the English
  back on the button.

Calling `super()` twice — once with the key to get the badge, once with the
English to get the label — is worse than it looks: the base `Init` re-runs
`Init#1(param[0])`, which reloads the button's activity, and the badge created
by the first call is parented to the parts of the activity the second call
replaces.

So the function is re-emitted, the way `patches/lp_date.jam` re-emits
`GameYear@ToString` and for a related reason: what the `.jaf` compiler cannot
reach, a `.jam` can leave exactly as it was. Two `CALLFUNC` are inserted and
nothing else is touched — no local is added, which is what makes it possible at
all, since `--jam` rewrites code and leaves the FUNC section alone.

Order matters in `scripts/ain.js`: the generated `.jaf` is passed before the
`.jam` that resolves `TextButtonNewMarkKey` by name, or alice-tools stops with
`Unable to resolve function`.

## Why the party label is matched by prefix

The two keys are recognised differently, and it is a judgement about each label
rather than a preference:

```
if (text == "Menu")  return "ＭＥＮＵ";
if (text == "MENU")  return "ＭＥＮＵ";
if (text.StartsWith("Form") || text.StartsWith(" Form")) return "部隊編成";
```

`Menu` is a word, it is the whole label, and nothing else in the archive starts
with it. The party button's label is `" Form\nSquad"` — a leading space and a
line break, both of them layout rather than words, both inside the string
because a `TextButton` has nowhere else to put them, and both **already edited
once** in `0b842a319`. A table of exact strings would go stale the next time
somebody nudges that spacing, and it would go stale silently, which is the
failure this whole file exists to stop. A prefix survives it.

## What the build checks

`renderNewMarkButtonsJaf` reads every `TextButton` parameter in
`archives/Rance10Pact_v1_04/` and reports what it found:

```
Translated 6 English new-mark button labels, beside 10 still Japanese and matching unpatched
```

A key that no button in the archive answers to — neither in Japanese nor as
anything the table recognises — is reported as stale, because that is the state
this cannot otherwise be noticed in: somebody retranslates a label, the badge
stops appearing, and nothing else changes. It does not check the other
direction, since a label that is neither the key nor a known translation is what
ninety other buttons in the game legitimately are.

The generated function is checked the way every code patch here is — against the
built file rather than against the patch:

```
alice ain dump --function=TextButton@Init build/scratch/Rance10.ain
```

should show the two `CALLFUNC TextButtonNewMarkKey` in place, immediately before
the `S_PUSH` of each key.

## What this does not cover

A `--text-lang=jp` build applies none of this, and the UI archive is not built
per language — so a Japanese build still gets the archive's English labels and
therefore no badge. That is the existing asymmetry between the two archives
rather than something this patch introduces; `docs/text-languages.md` has what
else a Japanese build leaves out.
