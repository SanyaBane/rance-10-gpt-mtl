# The treasure chest after a battle

Every won battle ends with the 宝箱だんご carrying a box on or off screen, and
whether it is the good box or the bad one is one `RAND` against one number. That
number is a plain sum of five bonuses, each of which is written down on the
result screen next to its own caption. This is a read of how it is assembled,
written while looking for the "first kill by this character" rule — which is now
the one thing here that is patched, optionally, by
`features/always-first-finisher/`.

Everything below is in `Rance10.ain`. Nothing about the chest lives in the `.ex`
tables or the `.pactex`.

## Where to look

Function ids are properties of the `.ain` and are the stable way to find any of
this again; line numbers are from a code dump, which is regenerable but
gitignored:

```
alice ain dump -c -o local/Rance10.v1.04.code.jam game/ain/Rance10.v1.04.ain
```

That dump inlines strings and names `CALLFUNC` targets, but a method call is
`PUSH <function id>` followed by `CALLMETHOD <argc>`, so reading it means
resolving ids to names. The dump carries both — a name comment above every
`FUNC n` — so one pass over it builds the table:

```
awk '/^;/ { if (!c) { name=$0; c=1 }; next }
     /^FUNC / { print $2 "\t" substr(name,3); c=0; next }
     { c=0 }' local/Rance10.v1.04.code.jam > funcmap.tsv
```

Everything named in this document was found that way.

## The roll

`SceneBattleResult@CalcResult` (FUNC 25420):

```c
m_isGetTreasure = IsForceNoTreasure
    ? false
    : RAND(100) <= g_battleResult.GetTotalPerTreasure();

if (!m_isGetTreasure && !IsForceNoTreasure)
    g_playerCommonParam.TreasureNotGetCount++;
else if (m_isGetTreasure)
    g_playerCommonParam.TreasureNotGetCount = 0;
```

`RAND` (FUNC 5830) is `Math.Rand() % max + 1`, so it returns 1 to 100 inclusive
and the comparison is exact: the total *is* the percentage. A total of 100 or
more is a guaranteed chest, a total of 0 or less never gives one, and there is no
rounding or hidden floor anywhere in between.

`IsForceNoTreasure` (FUNC 25430) is `TadaFlagFunc::Get(369) != 0` — a scenario
flag that suppresses the chest entirely, and which also keeps the failure
counter from advancing, so a scripted no-chest battle does not pay out later.

`m_isGetTreasure` is then what `SceneBattleResult@InitTreasureFlat` (FUNC 25425)
picks the 当たり or ハズレ sound and animation with, and what
`SceneBattleResult@ProcessGetCard` (FUNC 25432) branches on.

## Where the number comes from

`BattleBonusCalculator::CalcTreasure` (FUNC 24820), called from
`BattleBonusCalculator::Calc` right after `CalcExp`. Reconstructed:

```c
void BattleBonusCalculator::CalcTreasure()
{
    ref BattleContext context = g_battleContext;
    ref BattleResult  r       = g_battleResult;

    CommonStatus st = context.GetPlayer(0).TotalStatus;
    r.Bonus.Set(部隊_宝箱発見率, st.PerFindTreasure);

    if (g_enemy.IsBoss)
        r.Bonus.Set(対象_ボス, 100);

    int per = (-g_enemy.Hp * 100) / g_enemy.HpMax;
    per = Math.Max(0, per);
    r.Bonus.Set(オーバーキル, per);

    string id = g_battleContext.RecentUsedSkill.KillingCharacterId;
    if (id != "") {
        ref Character c = g_character.Get(id);
        if (!c.IsFinishAttack) {
            c.IsFinishAttack = true;
            r.Bonus.Set(初トドメ, 50, id);
        }
    }

    if (g_playerCommonParam.TreasureNotGetCount > 0)
        r.Bonus.Set(累計失敗ボーナス, g_playerCommonParam.TreasureNotGetCount * 10);
}
```

The overkill line reads oddly until you notice the enemy's HP is negative by the
time this runs — `INV` is unary minus, not a logical or bitwise not — so it is
the overkill damage as a percentage of the enemy's maximum HP, floored at zero.

## The five bonuses

`BattleBonusType` has ten values. `BattleBonus@IsExpBonus::get` (FUNC 27272) is
`Type < 5`, which is the whole of the split: the first five feed the experience
total, the last five feed the chest. Captions are from `BattleBonus@Caption::get`
(FUNC 27268, and its identical twin `::get#1`, FUNC 27269):

| # | Caption | Value |
|---|---|---|
| 5 | `部隊.宝箱発見率` | the party's summed `PerFindTreasure` |
| 6 | `対象.ボス` | 100 |
| 7 | `オーバーキル` | overkill damage as a percentage of the enemy's max HP |
| 8 | `%sで初トドメ` / `初トドメ` | **50** |
| 9 | `累計失敗ボーナス` | 10 per battle since the last chest |

`BattleBonusCollection@GetTotalPerBonus` (FUNC 27285) is a bare sum over the
five. No weighting, no cap, and nothing clamps the result before the comparison
— so the boss bonus alone already guarantees a chest, and everything else on a
boss is decoration.

One interaction is hidden in `BattleBonusCollection@AdjustBonusValues`
(FUNC 27283), which `Set` calls every time and which does exactly one thing:

```c
if (IsSetValue(対象_ボス))          // IsSetValue is "present and non-zero"
    m_bonus[Find(累計失敗ボーナス)].Value = 0;
```

The failure counter is therefore spent silently on a boss — the count itself is
reset by the roll, but its bonus contributes nothing to the roll that reset it.
Since `Set` runs `AdjustBonusValues` unconditionally and the boss bonus is
written before the failure bonus, order does not save it either.

The collection is built full: `BattleBonusCollection@0` (FUNC 27274) pushes one
`BattleBonus` per enum value at construction, so `Find` always succeeds and
`Set` (FUNC 27276, and the three-argument FUNC 27277 that also stores a character
id) is always an overwrite rather than an append.

## The first-kill rule

This is the one the search started from, and it is the four lines in the middle
of `CalcTreasure` above. In full:

**Who counts as having landed the kill.** `RecentUsedSkill@SetKilling`
(FUNC 26754) copies the skill's current `CharacterId` into `KillingCharacterId`.
It is called from one place — the lambda `BattleContext@SetDamageEvent` hangs on
the enemy player's death event (FUNC 37337) — so it is the character whose skill
was resolving when the enemy died, not whoever is nominally attacking.

**The flag.** `Character.IsFinishAttack` is struct member 6, accessors at
FUNC 27956/27957/27958. It is written in exactly two places: `CalcTreasure` sets
it, and `CharacterCollection@ClearIsFinishAttack` (FUNC 27986) clears it for
every character. Nothing else in the `.ain` reads it. It is not, in other words,
a stat or a display flag that happens to be reused here — it exists only for this
bonus.

**How long it lasts.** `ClearIsFinishAttack` has one caller,
`SceneQuestSceneSet@ResetParm` (FUNC 23654), which also heals the party to
`Party.TotalHp`, clears every card's skill counts, and zeroes both
`TreasureNotGetCount` and `IsUsedHannyZippo`. `ResetParm` in turn is called from
`SceneQuestSceneSet@Run` (FUNC 23645) under its `isResetParam` argument, on the
way into a quest and again on the way out, and from `RunStacked`. So the scope is
one run of one quest: every character is worth +50 once per quest, on their first
kill, and the slate is clean the next time you enter.

The consequence worth stating plainly, because it is what makes the rule matter:
in a quest where the party spreads its kills around, the chest chance is 50
points higher on the first kill of each character than it is on any later kill by
that same character, and it stacks with nothing — the bonus is flat, and a second
character's first kill in a *later* battle is a fresh +50 in that battle, not a
running total.

## The captions

The result screen lists these bonuses by caption, and the six treasure ones are
`s[3939]`–`s[3944]`. Each appears exactly twice in the dump, in
`BattleBonus@Caption::get` and its `#1` twin, and nowhere else — no other
function pushes them, so unlike the race names in `docs/race-names.md` these are
ordinary cherry-picks and translating the slots is safe. All six are translated,
in `patches/system_cherry_picks.v1.04.ain.txt`; `%sで初トドメ` is
`First Finisher by %s` there. The five experience captions above them,
`s[3934]`–`s[3938]`, are in the same position and are translated alongside.

The `%s` is a second job, and this document got it wrong for a while by saying
`patches/card_names.jaf` had already done it. What fills it is
`BattleBonus@ViewName::get` (FUNC 27270), reached from `Caption::get` and from
nowhere else, and it returns `BattleBonus.CharacterId` raw — the 識別名 that
`CalcTreasure` copied out of `RecentUsedSkill.KillingCharacterId`, which is a
save key rather than a label. It shares nothing with `PlayerCard@ViewName` but
the property name, so patching the card plate and the combat log left this
caption ending in a Japanese name under an English sentence. It is
`Character@Name::get` written out a second time, chapter-2 branch and all, and
`card_names.jaf` now overrides it a second time to match, against a
`識別名情報.短縮英名` node that `scripts/generate_card_names.js` writes. The
*short* name, not the full one the combat log uses: see the comment over the
override for the widths. `docs/card-name-localization.md` has the tree.

## What the feature patches

`features/always-first-finisher/` makes that +50 unconditional: with its switch
file in place, every won battle earns it, whoever took the killing blow and
however many they have taken already this quest. Rotating the last hit around the
party is the chore it exists to remove.

The hook is `Character@IsFinishAttack::get` (FUNC 27956), overridden to answer
`false` while `custom_mods\always_first_finisher_on` is in the game folder and to
call `super()` otherwise. That reaches the rule rather than the figure, which is
the whole reason it is not the `Set#1` knob listed below: `Set` is not called at
all on a repeat kill, so there is nothing there to intercept — it is the `if`
that has to change.

It also reaches exactly one decision in the game. Four functions in the whole
`.ain` touch the member, and this is all of them — two reads, one of which
nothing calls, and two writes:

| | | |
|---|---|---|
| `Character@IsFinishAttack::get` | FUNC 27956 | one caller, `CalcTreasure` |
| `Character@IsFinishAttack::get#1` | FUNC 27957 | no callers, the compiler's twin |
| `Character@IsFinishAttack::set` | FUNC 27958 | `CalcTreasure` and `ClearIsFinishAttack` |
| `.STRUCTASSIGN Character <IsFinishAttack> 0` | FUNC 27952 | the constructor |

The one read is `PUSH 27956 / CALLMETHOD 0` rather than a struct reference, which
is what makes it interceptable at all.

Nothing else moves. The setter still runs, so `CalcTreasure` still marks the
character — with the switch on, nobody reads the mark. Removing the file part way
through a quest restores the original rule at once, because it is read as the
result is calculated rather than at launch, and the marks that quest has already
collected are still where it left them.

What the feature deliberately leaves alone is the `id != ""` test above the flag:
a kill the game credits to nobody earns nothing, switch or no switch. Reaching
that case means overriding a total, and a total is the one thing here that cannot
be changed quietly — `CalcResult` and `InitResultView` read the same getter, so
the sum on the result screen would stop adding up to the list printed under it.

The screen needs nothing further: `Set` stores the character id, and the caption
is already English, so the line is simply there after every won battle instead of
some of them.

Being one `.jaf` and no `.jam` is the other thing worth noting, since both other
features are a pair. A property getter needs neither `this` nor a caller's
argument, and that — not the `override` keyword — is what sent those two to
hand-written assembly.

## The other handles

`CalcTreasure` itself is a namespace function, not a method, and alice-tools'
`.jaf` `override` is written for methods — the same wall
`features/enemy-panel/enemy_info_panel.jam` ran into from the other side, and the reason that
patch is hand-assembled. If anything else here is ever tuned, the class methods
around it are the practical handles, and all three have a `super()` that
reproduces the original exactly:

| Override | Reaches |
|---|---|
| `BattleBonusCollection@GetTotalPerTreasure` (FUNC 27280) | the total, after every bonus is in |
| `BattleResult@GetTotalPerTreasure` (FUNC 27296) | the same total, at both of its call sites |
| `BattleBonusCollection@Set` / `Set#1` (FUNC 27276/27277) | one bonus as it is written, by type |

Overriding a total changes the roll and the number the result screen prints,
since `CalcResult` and `InitResultView` read the same getter — which is the right
behaviour, and worth keeping if anything here is ever tuned. Overriding `Set#1`
by type is the narrower knob: it is where a different figure than 50 goes
without touching the other four bonuses, and it is exactly what
`features/first-finisher-100/` now does — the First Finisher line paid as 100
rather than 50, so the itemised value and the total both move and still agree.
That feature is a `.jam` plus a switch-file `.jaf` rather than a plain `.jaf`
`override`, because `Set#1`'s first parameter is the enum `BattleBonusType`,
which the `.jaf` compiler will not name: an `override` of it is a parse error as
`BattleBonusType type` and a type error the moment `super()` is handed it back as
`int type`. So the figure is substituted in assembly, gated on the type being
`初トドメ` (`BattleBonusType` 8). Paired with `features/always-first-finisher/`,
which pays that line every won battle rather than the first kill, +100 makes
every won battle a certain chest.

Whichever it is, verify against the built `.ain` rather than the patch, the way
the rest of this repository does. An `override` shows up in
`alice ain dump -c` twice — the original body where it always was, and the
replacement appended at the end of the dump under the same `FUNC` number, calling
the original as `::get#2`. The appended one is the live one; `Character@Name::get`
from `patches/card_names.jaf` reads exactly the same way.
