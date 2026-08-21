# The two cooking skills, and the MISS they print

`調理準備` — Meal Preparation — is Martina's Lv7 skill and Varen's second, and
it fails a quarter of the time. `菓子作り` — Sweets Making — is the same skill
one tier up and fails a fifth of the time. Both spend their AP either way, and
the battle log prints `ＭＩＳＳ（skill activation failed）` when they lose.

`features/reliable-cooking/` makes both of them always work, behind a switch
file the player owns. This is the read behind it.

```
node scripts/ain.js --text-lang=jp --out=build/scratch   # the feature over the game's own script
node scripts/ain.js --without=reliable-cooking           # a build without it
```

| File | What it is |
|---|---|
| `features/reliable-cooking/cooking_skill_chance.jaf` | the switch: the file lookup and the two skill Ids |
| `features/reliable-cooking/cooking_skill_chance.jam` | the hook: `PlayerSkill@PerSkill::get`, reassembled |
| `custom_mods\reliable_cooking_on` | in the game folder, beside `Rance10.exe` — create it to turn the feature on |

## It is not an accuracy roll

Both skills are rows of `archives/Rance10EX_v1_04/11_スキルデータ.x`:

```
{ 1131,"Meal Preparation",1,7,"",3,75,60,0,0,0,0,0,"",0,0,"Buff: <75%>\r[Meal Ticket Holder]" },
{ 1974,"Sweets Making",1,7,"",3,80,60,0,0,0,0,0,"",0,0,"Buff: <80%>\r[Meal Ticket Holder]" },
```

`処理` is 7, which `ActionSkillProcessType@String` calls `Preprocess`: no
attack, no target, nothing to hit. `効果１` is 60, `支援配置`, the effect that
places a support — here the `[食券保持中]` buff, the one that pays out a meal
ticket. So no hit calculation runs at any point, and effect 7, `必中`
"Guaranteed Hit", would change nothing if it were added: it feeds the damage
path these skills never enter.

What does run is the skill's own activation roll, against the `確率` column —
the 75 and the 80 above, which is also what the description prints in its
`<75%>`. Four functions, and nothing else is involved:

| Function | Id | What it does |
|---|---|---|
| `PlayerSkill@PerSkill::get` | 28274 | `EX_IA2Int("スキルデータ", this.Id, "確率")` |
| `SceneBattle@CheckSkillPer` | 24907 | `checkRandomPercent(action.Skill.PerSkill)` |
| `checkRandomPercent` | 24976 | `RAND(100) <= percent` |
| `SceneBattle@ShowActionMiss` | 24908 | logs `s[3279]`, the MISS line |

`SceneBattle@ProcessPlayerAction` calls `CheckSkillPer` and, when it comes back
false, calls `ShowActionMiss` and returns before the effect runs at all. The
enemy's side of it, `SceneBattle@ProcessEnemySkillAction`, does the same. There
is one escape hatch and it does not apply here: an action whose skill is
`行動タイプ` 10 — the self-firing ones, `自動発動` — returns silently instead of
printing a MISS.

So the whole of the change is that one number, and `RAND(100) <= 100` cannot
lose.

## Why the `.ain` and not the table

Changing 75 to 100 in `11_スキルデータ.x` is one character and would work. It
would also be in every build anybody ever makes, because `features/` patches the
`.ain` only — `modules/Features.js` knows `--jaf` and `--jam` and there is no
third flag for a table. A gameplay change nobody can decline is not a feature,
so the table keeps the game's own numbers.

They *are* the game's own numbers, checked rather than assumed: the row in the
pristine v1.04 `Rance10EX.ex` reads `{ 1131, "調理準備", 1, 7, "", 3, 75, 60, ...`.
75 is not something the v1.00 → v1.04 forward-port dropped a digit from. It is
also the house number for the whole family of snatch-a-thing skills — `捕獲ロープ`,
`パン泥棒`, `金品泥棒`, `捕獲突撃`, `盗み攻撃` are all 75 — which is worth knowing
before deciding this one is a bug.

The cost of leaving the table alone is that the description still says
`Buff: <75%>` while the switch is on. Nothing can be done about that from a
feature, and rewriting the description in the table would be exactly the
unconditional edit this avoids.

## Why `PerSkill::get` and not `CheckSkillPer`

`CheckSkillPer` is the more obvious hook — it is the roll, it takes the action
as an argument, and it needs no `this`, which is what `.jaf` overrides cannot
resolve. It still does not work:

```
error: Invalid struct member name: Skill
    in: action.Skill
```

`PlayerAction@Skill` is a property rather than a field, and alice-tools' `.jaf`
compiler will not reach one through a ref argument any more than through `this`.

`.jam` has no such limit, so the hook is the accessor instead:
`PlayerSkill@PerSkill::get`, reassembled as its own nine instructions plus a
call handing `(確率, this.Id)` to the `.jaf`. Patching the accessor rather than
the roll means the number is replaced once and every reader of it agrees. There
are three readers: `CheckSkillPer`, and two in `SacrificeFinder` — `FindLeader`
and `FindAegisEffect` — which collect leader skills, `行動タイプ` 20, and so
never see either of these two.

`PlayerSkill@PerSkill::get#1` (28275) is the compiler's twin of the accessor,
reading the same column through `PlayerSkill@Id::get#1`. No `PUSH 28275` appears
anywhere in the dump, so it is left alone rather than patched blind.

## Reading it back

Function ids are properties of one build of one `.ain`; regenerate them from a
dump if the game version moves.

```
alice ain dump -c -o local/Rance10.v1.04.code.jam game/ain/Rance10.v1.04.ain
```

A method call is `PUSH <function id>` followed by `CALLMETHOD <argc>`, and the
dump carries a name comment above every `FUNC n`, so resolving ids to names is
one pass — `docs/treasure-chest-chance.md` has the `awk` for it.

Verify against the built `.ain` rather than the files: `--jam` appends the
rewritten function at the end of the code and repoints the function table, so
the original body is still in the dump, above, dead. The live one is the copy
after `; NULL / FUNC 0`.

```
alice ain dump -c -o built.code build/scratch/Rance10.ain
grep -n "CALLFUNC CookingSkillPercent" built.code
```
