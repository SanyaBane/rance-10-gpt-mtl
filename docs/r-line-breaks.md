# The letter r is a line break, and the separator is a slot

`s[4159]` reads `"HP and skill uses|are restored|Yay!"` and the recovery-point
dialog draws it in six lines: `HP and skill uses`, `a`, `e`, `esto`, `ed`,
`Yay!`. Every `r` of "are restored" is a line break, and the `|` the string was
written with works exactly as intended -- which is the shape of the whole
fault. The game's own line-break marker is the **ASCII letter r**, and English
cannot avoid it.

```
node scripts/find_r_breaks.js
```

## The marker is a letter, not a control character

The game's data says so on both sides of the archive boundary:

```
game/ex/Rance10EX.v1.04.ex.txt   { 1003, "全力突撃", …, "攻撃(2倍)r　ＡＰ累積" }
game/ain/Rance10.v1.04.ain.txt   ;s[15018] = "リーザス城に…侵入するも撃退r"
```

and it is a letter rather than a CR the dumper failed to escape, because the
same dump escapes a real CR where the game has one: `;s[802] = "\r\n"`, and the
sixteen-row ASCII art in `s[2354]`–`s[2357]`. The other direction was checked by
round-tripping one slot through `alice ain edit -t`: `\r` in a patch puts CR in
the `.ain` and comes back out of `alice ain dump -t` as `\r`, a bare `r` stays a
bare `r`. The two are different characters and always were.

Latin letters do not occur in the Japanese, so a Latin letter is a free marker
there. It is not free in English, and nothing in the pipeline warns about it.

## Two shapes, and LF underneath both

```
S_PUSH "|r" / PUSH 0      / CALLHLL String Split    -- a set of characters
S_PUSH "r"  / S_PUSH "\n" / CALLHLL String Replace  -- straight to LF
```

`String.Split` takes a **set** of characters, not a delimiter string, which is
why `"|r"` breaks on `|` and on `r` alike. LF is what the engine actually draws:
`StringHelper::ConvertToLf` exists to turn `r` and `|` into it, and
`SceneImageDialog@0` joins the pieces back with `"\n"` before handing them to
`Ｐ＿テキスト設定`. So a string that reaches a text part with a real LF in it
breaks there whatever any separator says.

## The separator is a string slot, and that is the fix

Thirteen places read the letter, and between them they push **three** slots:

| Slot | Compiled as | Pushed by |
|---|---|---|
| `s[2527]` | `"r"` | `AssistantMessageView@SetText`, `CardConstructorBackExtra::Create`, `CardConstructProcessCacheBackSkill@Create`, `PlayerDetailSkillView@SetParam`, `SkillDescriptionView@0`, `AegisEffectView@Init`, `BadConditionDescView@0`, `LargeSkillButton`'s lambda, `AegisEffect@Name::get` (twice) |
| `s[3501]` | `"\|r"` | `BraveModeView@SetParam`, the lambda of `DialogScenes::RunImageDialog` |
| `s[3717]` | `"r\|"` | `StringHelper::Split`, and through it `InformationDialog@0`, `QuestMapSelectionButton@Init`, `ResultDescriptionView@UpdateText` and `PlayerCardProfile@ItemDesc::get` |

Nothing else in the `.ain` pushes any of the three -- the fourteen pushes the
dump lists are these thirteen sites plus the one `S_EQUALE` in
`AssistantMessageView@SetText` that compares a piece against the separator, and
which reads the same slot, so it moves with it. That makes this the rare case
where the rule in `CLAUDE.md` about a shared slot points the other way: the slot
is shared by exactly the code that wants it changed.

So a separator cherry-picked as CR takes the letter out of the set without a
`.jam`, without touching a caller, and without asking anything of the text:

```
; AssistantMessageView@SetText
s[2527] = "\r"
```

Two of the three have been in `patches/system_cherry_picks.v1.04.ain.txt` for
years, which is the answer to why the fault shows on some screens and not
others. `s[3501]` was the one nobody had found.

## What a line then has to say

With a separator closed, the game breaks where the text holds CR or LF, so a
line means a break by writing `\r` -- which is what
`archives/Rance10EX_v1_04/11_スキルデータ.x` does in 781 fields, and what 129
lines of the cherry-picks do. `\n` draws too, and one cherry-picked line uses it.
A break spelled as a bare `r` is the one thing that stops working, which is what
`Four war reports ended in a letter r that meant a line break` had already
repaired in the four lines that had it.

The capital-R workaround the cherry-picks file opens with -- `Repelled`,
`Reinforcements`, `Retreating`, `Received` -- is the other half of the same
history, from before any separator was closed. It is no longer needed on a
closed path, and the file's own `upd.: nowadays it should be good` is right
about the paths it was written for and wrong about the two `s[3501]` serves.

## What the report reads, and where it stops

`scripts/find_r_breaks.js` answers two questions with two different methods,
because neither one is enough.

**Which separators are still open** comes from the code, and is exact: every
`String Split`, `splitToken` and `String Replace` whose separator holds the
letter, paired with the slot it pushes and with whatever the cherry-picks have
made of that slot.

**What an open separator is damaging** comes from two directions:

- walking the callers of an open site to the literal strings handed in. This is
  the half that finds a slot whose Japanese has no break at all --
  `友情を取得しました。`, which is drawn as two lines -- and no report keyed on
  the marker could. It reads *the last string pushed before a call* as the text,
  which is right for every dialog entry point here and would be a miss, never a
  wrong answer, for one that passes its text in another position. A branch stops
  as soon as a call site yields a literal; walking past that turned nine call
  sites into twenty-six slots, three quarters of them a sound name or a CG name
  from the scene function above.
- every slot whose own Japanese carries the marker, which is on such a path by
  construction. 271 slots, 130 of them translated. The one piece of noise is a
  Latin `r` the Japanese quotes rather than uses -- `ランスJr.` -- which the
  count guards against by requiring no Latin letter on either side of the
  marker. That guard is asked of the Japanese only: intent is what it measures,
  and what the game does to the English is every `r` there is.

Two things it does not answer. It says nothing about `archives/`, where the same
marker lives in four tables and only `11_スキルデータ.x` was ever converted --
`5_クエストデータ.x` had the marker in 671 fields and its English has none, so
669 quest-branch labels lost a break somewhere in the translation and nobody has
looked. And it cannot tell an intended break from an accident in a line that
never had a Japanese counterpart, which is why the walk half exists.
