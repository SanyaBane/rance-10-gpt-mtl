# Letting the player choose which enemy action a shuriken cancels

**This is an investigation, not a plan.** Nothing here is built, nothing is
patched, and there is no promise that any of it ever will be — treat it as a
low-priority todo somebody asked about once. It is written down because the
answer turned out to be "smaller than expected, but not in the shape the
question assumed", and working that out of the code dump took a good deal
longer than reading it back will.

The question: 手裏剣 attacks and, on a roll, deletes one of the actions the
enemy has queued up for the end of the player's turn — the row of icons the
player is looking at while deciding what to do. It picks that action at random.
Could the player pick it instead?

## What the effect does today

Skill 1072 in `archives/Rance10EX_v1_04/11_スキルデータ.x`:

```
{ 1072,"Shuriken",1,2,"手裏剣",1,100,1,50,54,70,0,0,"",0,0,
  "Attack (Ranged) (0.5x)\rAction Prevention 70%" },
```

One AP, a ranged attack at half damage, and effect **54** with the value **70**.
`SkillEffectProcessFactory::CreateOne` maps effect 54 — and 55, which no skill
in v1.04 carries — to `SkillEffectProcessEnemyActionAbort`, constructed with
`(ef.Type, ef.Value)`.

The class splits the work the way every skill effect does. `Evaluate` decides
whether it happens:

```
s     = g_enemy.Actions.Current.SkillActions
ratio = 1 / 2^s.GetDisabledCount()
pass("行動止め率補正:%3.2f％", ratio * 100)
if (!checkRandomPercent((int)(m_value * ratio))) return false
if (!s.IsExistAvailable())                       return false
m_log = new BattleLog("<Enemy>の行動を阻止した！")
return true
```

and `Process` applies it:

```
s = g_enemy.Actions.Current.SkillActions
if (Type == 55) s.GetFirstAvailable().IsAvailable  = false
else if (Type == 54) s.GetRandomAvailable().IsAvailable = false
```

Three things in there matter for anything built on top of it:

- **The success chance decays inside one action set.** `ratio` is one over two
  to the power of how many actions are already disabled, so a 70% shuriken is
  70%, then 35%, then 17%. Even the 100% ones (`巨大手裏剣`, `魔王の視線`) are
  50% on the second go.
- **`Evaluate` rolls and `Process` applies**, and
  `SkillEffectExecuter@InnerProcess` runs them as
  `if (p.Evaluate()) { p.Process(); ... }`. Anything asked inside `Process` is
  asked only when the roll has already succeeded.
- **Nothing in the object says which skill it belongs to.** The struct is
  `<Type>`, `m_value`, `m_log` and nothing else, so an effect cannot tell a
  shuriken from `ストリップ` or from the auto-firing 支援攻撃.

What the player sees is already wired: `EnemySkillAction` carries an
`OnChangeAvailable` delegate that `EnemyActionIcon@Init` subscribes
`EnemyActionIcon@ShowNg` to, so the icon is crossed out the moment the action is
disabled. When the queue runs, `SceneBattle@IsEnemySkillActionFailed` skips a
disabled action and logs `s[3292]`. `EnemySkillActionCollection@Reset` re-enables
everything for the next set, and the same disabling happens from status ailments
through `BadConditionGroup@ProcessBlockAction`, which shares the decay counter.

Sixteen rows of the skill table carry effect 54 in one of their three effect
columns, and none carries 55.

## Where to look

Function ids are properties of the `.ain` and are the stable way to find this
again; a code dump is regenerable and gitignored:

```
alice ain dump -c -o local/Rance10.v1.04.code.jam game/ain/Rance10.v1.04.ain
```

| Id | Function |
|---|---|
| 27415 | `SkillEffectProcessEnemyActionAbort@0` — the constructor, takes type and value |
| 27417 | `SkillEffectProcessEnemyActionAbort@Evaluate` — the roll |
| 27418 | `SkillEffectProcessEnemyActionAbort@Process` — the disabling |
| 27423 | `SkillEffectProcessFactory::CreateOne` — `.CASE 431:11 55`, `.CASE 431:12 54` |
| 27320 | `SkillEffectExecuter@InnerProcess` — the evaluate-then-process loop |
| 24919 | `SceneBattle@ProcessSkillEffect` — its one caller for a player action |
| 24906 | `SceneBattle@ProcessPlayerAction` — knows the `PlayerAction`, and so the skill |
| 24924 | `SceneBattle@IsEnemySkillActionFailed` — skips a disabled action, logs `s[3292]` |
| 26888 | `BadConditionGroup@ProcessBlockAction` — the same disabling from an ailment |
| 25084 | `EnemyActionIcon@InitIcon` — builds one icon and wires its events |
| 36977 | the click lambda `EnemyActionIcon@<lambda : EnemyActionIcon@InitIcon()(36, 53)>` |
| 36978 | the hover lambda `(40, 53)` — tints the icon |
| 25085 | `EnemyActionIcon@ShowNg` — draws the crossed-out mark |
| 25954 | `BattleScenes::RunPopupDescription` — what a click opens today |
| 26379 | `Scenes::RunIScene(factory, postEvent)` — how a modal scene is run and read |
| 27725 | `Enemy@Actions::get` |
| 27742 | `EnemyActionCollection@Current::get` |
| 27735 | `EnemyAction@SkillActions::get` |
| 27755 | `EnemySkillActionCollection@Get(int index)` |
| 27756 | `EnemySkillActionCollection@GetFirstAvailable` |
| 27757 | `EnemySkillActionCollection@GetRandomAvailable` |
| 27758 | `EnemySkillActionCollection@IsExistAvailable` |
| 27761 | `EnemySkillActionCollection@GetDisabledCount` |
| 27752 | `EnemySkillActionCollection@Count::get` |
| 27754 | `EnemySkillActionCollection@Reset` |
| 27747 | `EnemySkillAction@IsAvailable::set` |
| 29245 | `pass(string)` — an empty body, which is where `s[3957]` goes to die |

## The literal reading is the expensive one

"On activation, show the player a choice" means a modal that appears when the
skill fires. Two things make it expensive.

**The roll comes first.** A chooser inside `Process` only ever appears when the
roll has already succeeded, so being asked *is* the answer: the shuriken becomes
a guaranteed cancel with a decoration on top, which is not what was asked for.
Keeping "try to cancel" honest means asking before `Evaluate` rolls, which means
a second hook and somewhere to keep the answer between the two.

**There is no chooser to reuse.** A modal that returns a value is
`Scenes::RunIScene(ss => new SceneXxx(ss), scene => result = scene.Result)`, so
it needs a scene class. The smallest one in the game,
`SceneSimpleBattleContinueDialog`, is eleven functions — constructor,
destructor, `Run`, `FadeOut`, the result getter and setter, four lambdas — plus
its own `.pactex` layout. The game's pickers that do return a chosen index
(`SceneAdvQuestSelection`, `SceneQuestListSelect`) are quest screens; none of
them is a thing you could point at a row of battle icons.

## What is already there, and the version it makes cheap

The row of enemy actions is not a picture. Every icon is a separate object that
already takes clicks:

- `EnemyActionIconBase.pactex.x` gives the `ClickArea` part `クリック許可 = 1`;
- `EnemyActionIcon@InitIcon` hangs `Parts@SetOnClickEvent` on it, and the lambda
  calls `BattleScenes::RunPopupDescription` — clicking an action already opens
  that action's description;
- the icon knows where it sits:
  `struct EnemyActionIcon { ref EnemySkillAction m_action; ref PlayerSkill m_skill; Activity m_act; Parts m_parent; int m_index; }`;
- and the collection can be addressed by index: `EnemySkillActionCollection@Get`
  sits right next to the two `Get…Available` calls `Process` uses.

So the interface for choosing is drawn, hit-tested and informative already. What
is missing is only that a click remembers nothing and `Process` reads nothing.

That points at a different shape of the same feature: **the player marks the
action beforehand by clicking it, and the shuriken respects the mark.** Note
that this is not a compromise on the semantics — the mark is made before the
skill is used, so the roll still decides whether the cancel lands. It is a
compromise on discoverability: nothing tells the player the click means anything.

## What the toolchain allows

The existing feature in `features/enemy-panel/` already records the constraint
that decides the shape of any of this: alice-tools' `.jaf` compiler *"resolves
neither `this` nor a struct's own members inside an override — only arguments,
locals, globals and super()"*. Both functions worth patching here work entirely
through `this`, so the patch has to be `.jam`, which replaces a whole function
body but cannot add locals to it.

The rest was tested against `alice ain edit` rather than assumed:

| | |
|---|---|
| `.jaf` adds a new global | **yes** — `int ShurikenPickIndex;` compiled, the globals section went 360 → 361, and a function read it back through `.GLOBALREF` |
| `.jaf` adds a new function | yes, and the repository already does it (`EnemyInfoPanelEnabled`) |
| `.jaf` adds a new struct | yes with `struct`; `class` is a syntax error |
| `.jaf` adds a method to it | compiles as `int Type@Method(void)`, and lands in the functions section |
| `.jam` adds a local | no — the function keeps the locals it was compiled with |

The new global is the one that mattered: it is where a click can leave its
answer. `Process` needs no new local either — an index read from a global and
handed straight to `Get` lives on the stack.

## A sketch, if it is ever built

Three files, laid out like `features/enemy-panel/`:

1. **`.jaf`** — `int ShurikenPickIndex;`, plus the switch-file helper if the
   feature wants one, exactly like `EnemyInfoPanelEnabled`.
2. **`.jam`** — replace the click lambda (`FUNC 36977`, thirteen instructions)
   so that besides opening the popup it stores its own `m_index` in that global.
   The lambda is a method of `EnemyActionIcon`, so `m_index` is in reach.
3. **`.jam`** — replace `SkillEffectProcessEnemyActionAbort@Process`
   (`FUNC 27418`): if the stored index is inside `Count` and that action is
   still `IsAvailable`, disable it; otherwise fall through to
   `GetRandomAvailable()`.

The fallback is what makes it safe. The index is never reset, only validated
where it is used — which matters because the action set is rebuilt every round
(`EnemySkillActionCollection@Reset`) and the enemy can change mid-battle
(`SceneBattle@OnInsertionEnemyChanged`). Any mismatch degrades to exactly
today's behaviour instead of to a crash.

It also adds no strings, so it builds under `--text-lang=jp` the way
`docs/text-languages.md` requires of a feature.

## What it would still not do

- **It would apply to every effect-54 skill**, not to the shuriken alone: the
  effect object cannot name its own skill. Narrowing it to skill 1072 needs a
  fourth hook — a `.jam` on `SceneBattle@ProcessSkillEffect` (24919), which does
  hold the `PlayerAction`, to leave the skill id in another global before the
  executer runs. That would also catch `ストリップ`, `魔王の視線`, `威嚇射撃`,
  `差し押さえ` and the auto-firing `支援攻撃` otherwise.
- **Nothing would show which icon is selected.** The click opens the description
  popup, which is feedback of a sort, but a real marker means clearing the
  previous one, which means reaching the sibling icons through
  `EnemyActionView.m_icons` — another hook. This is the weakest part of the idea
  and the best argument against building it.
- **Two more hard-coded function indices.** Every number in a `.jam` is an index
  into one build of one `.ain`; there is one such file today and this would make
  three.
- **One step untested:** whether the assembler accepts a quoted lambda name in
  `ENDFUNC "EnemyActionIcon@<lambda : …>"`. The dumper writes it that way and
  the tool is the same, but it has not been tried.

## The one-number alternative

`Process` already has a second branch. Type **55** takes
`GetFirstAvailable()` instead of `GetRandomAvailable()` — the enemy's *next*
action rather than a random one — and no skill in the v1.04 table uses it.
Changing 効果２ on skill 1072 from 54 to 55 makes the shuriken predictable
without a line of code.

The catch is where it lives: the skill table is in `Rance10EX.ex`, and
`features/` patches the `.ain`, so this cannot be a `--with=`/`--without=`
switch. It would be an unconditional change to how the game plays, in a
repository whose other unconditional changes are all translation.
