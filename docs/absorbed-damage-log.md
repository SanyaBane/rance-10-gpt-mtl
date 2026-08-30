# The damage a `制限装甲` enemy swallowed

`features/absorbed-damage-in-log` writes into the battle log the number the game throws away when an
enemy's `制限装甲` eats a hit. This is what it is patching, why that function, and the one thing it
costs.

## What the game does

`制限装甲` is skill effect **107**, and the effect's value is the threshold. There are twelve of them
in `archives/Rance10EX_v1_04/11_スキルデータ.x` — skills 1298, 1547, 1922, 1548, 1549, 1550, 2012,
1788, 1299, 2005, 2006, 2007, carrying 5 000, 10 000, 20 000, 40 000, 60 000, 100 000, 150 000,
200 000, 300 000, 500 000, 1 000 000 and 2 000 000. Each row's own description is the player-facing
statement of it: "Damage <5,000 is completely blocked".

The buff's own name is not translated, and this is worth knowing before writing about it anywhere a
player reads. `s[12708]` still says `制限装甲` on the support-state panel — no glossary has a row for
it and no cherry-pick assigns it — while the two lines of hint under the enemy's stats
(`s[13460]`/`s[13461]`) and the skill description in `11_スキルデータ.x` are both English. So the
English a player can actually match a sentence against is "Takes no damage unless a single hit clears
a certain threshold", "Damage <5,000 is completely blocked", and the guard reason `s[3891]`, "Limit
Break". Naming the buff in English would be inventing a name the game never shows, which is what
`scripts/find_unnamed_terms.js` exists to catch; the feature's README and its `feature.js` are worded
off those three instead.

`PlayerAttackDamageCalculator@CalcSpecificAegisEffect` (`FUNC 26978`) applies it, at the end of the
damage calculation:

```
if (aegis.IsExistSkillEffectType(107)) {
    value = aegis.GetSkillEffectValueMax(107);
    if (m_result.TotalDamage > value)  m_result.GuardType   = GuardBreak;
    else                             { m_result.GuardType   = Guard;
                                       m_result.GuardReason = DamageRange; }
}
```

`aegis` is the *enemy's* group — `AegisEffects(1)`, `1` being the enemy side, the way
`@CheckWeakAttack` reads `GetPlayer(1).Hp` as the target's. And `TotalDamage` still answers the real
figure at that moment, because `GuardType` has not been set yet.

From the assignment on it does not. `DamageInformation@TotalDamage` (`FUNC 27053`) reads

```
IsGuard ? 0 : GuardType == GuardBreak ? 100 : PreGuardDamage
```

so everything downstream sees 0 or 100 — including `@CheckWeakAttack` and `@CheckMaxDamage`, which
both compare against it and both return early as a result, so nothing scales the figure afterwards.
The number that was actually rolled survives in one place only: `DamageInformation@PreGuardDamage`
(`FUNC 27055`), the base damage plus every additional damage, which is exactly what was compared
against the threshold.

## Where the game already shows it, and where it does not

`DamageView@MotionNumber` (`FUNC 25071`) splits on the same question:

- **guarded** — it takes `@PreGuardDamage` and animates it down to zero over the enemy. So the figure
  *is* on screen for about a second, and there is no way back to it.
- **anything else** — it takes `@TotalDamage`. On a break that is the flat 100, so on a break the
  rolled figure is drawn nowhere at all.

The log says less again. `SceneBattle@ShowLogGuard` prints `限界値突破！` or
`ダメージを与えられない！(<Any>)` and no number, and the "took N of damage" line underneath it is
`SceneBattle@ShowAdditionalDamageLog`, which is reached from `PlayerAttackProcess@SpecificLog` — an
HP-change handler. An absorbed hit changes no HP, so on that path there is no second line either.

## The hook

`SceneBattle@ShowLogGuard` (`FUNC 24930`). Three things pick it out:

- it is the only place either outcome is put into words;
- it takes the `DamageInformation` as an argument, so `@PreGuardDamage` is one call away;
- it has one caller — `SceneBattle@ShowAttackDamage` (`FUNC 24913`), the `OnDamageEvent` handler,
  which reaches it only when the attacking side is the player's. Nothing else can produce a guard
  line.

And it already holds three `ref BattleLog` locals. That is the constraint that decides these patches:
`--jam` rewrites code and leaves the `FUNC` section alone, so a patched function has exactly the
locals it was compiled with, and a log entry has to be built somewhere.

Three shapes were tried against that constraint before this one:

- **Patch `ShowAttackDamage` instead**, which pushes no strings at all and would have cost nothing in
  translation. It has no locals whatsoever — two arguments and nothing else — so there is nowhere to
  put the log.
- **Use `SceneBattle@ShowLog(string)`** (`FUNC 24943`), which builds the `BattleLog` itself and would
  need no local from the caller. Its defaults are wrong and cannot be reached from outside: a
  `BattleLog` starts life with `IsShowCenterLog` **true** and `IsAddMode` false (`BattleLog@2`,
  `FUNC 27213`), so the number would announce itself across the middle of the screen on its own line.
- **Name the existing strings by slot number** rather than by text, `S_PUSH 3296`, which would have
  sidestepped the whole of the next section. The assembler takes it and reads it as text: the built
  file pushes a new string whose content is `"3296"`.

## The one thing it costs

Replacing a function means re-emitting all of it, and two of `ShowLogGuard`'s instructions push
strings the translation owns — `s[3295]`, the Fiend's barrier being removed, and `s[3296]`,
`ダメージを与えられない！(<Any>)`. A literal in a `.jam` is matched against the string table **by
text**, and the text patch has already run by the time alice-tools reads the file. Push the Japanese
and it matches nothing: a new Japanese slot is appended and the line reverts to Japanese in an English
build. That is the fault `patches/leader_state_names.jam` exists for, and it is invisible in a diff,
because the body is verbatim from the game's own dump — which is exactly what makes it wrong.

So the feature writes the English in directly. Which slot that then resolves to is not something to
rely on, and it was measured both ways:

| Run | `s[3295]` / `s[3296]` resolve to |
|---|---|
| the rendered dialogue plus this feature alone | 3295 and 3296 themselves |
| a real build — same text patch, the English `.jaf`/`.jam` ahead of it | two new slots, same text |

Both are correct: a duplicate holding an identical sentence is what the player reads either way, and
both leave 3295 and 3296 alone for the callers that keep them — the unpatched function a `--without=`
build runs, and `SkillEffectProcessDamageSelf@GetLog`, which pushes `s[3296]` too.

What it does mean is that the wording inside the `.jam` decides what the player reads with the feature
on, while the cherry-picked slot decides it with the feature off. Nothing in a diff would show those
two drifting apart, so `modules/GuardLog.js` holds them to each other at the start of every build, the
way `modules/CardBack.js` holds the two card-back `.jam` to each other.

And it is the reason the third line — the number itself — is language-neutral. `" raw"` and
`" absorbed"` are the only words this feature invents. A `--text-lang=jp` build with the feature in
reads those two guard lines in English; it builds and it plays, which is what that build is for, but
it is the reason not to add a third.

## What it writes

A log entry of its own, appended to the line rather than replacing anything:

```
log.Text            = " ({255,255,0}<Damage>{}<Any>)"
log.AnyString       = info.GuardType == GuardBreak ? " raw" : " absorbed"
log.Damage          = info.PreGuardDamage
log.IsAddMode       = true
log.IsShowCenterLog = false
```

`BattleLog@ReplaceText` (`FUNC 27230`) fills `<Damage>` from the `Damage` member and `<Any>` from
`AnyString`, and `BattleLog@Width` strips the `{…}` colour codes before measuring — so this is 16
units against `BattleLogCollection@IsFlushRequired`'s 60, and wraps to the next log line by itself
when the sentence before it is long.

The two words are chosen from `GuardType` rather than from which branch jumped to the block, which is
what lets both paths share one tail. It matters that they are chosen at all: on a break the damage was
not absorbed, it was replaced by a flat 100, and the number is what was rolled before the armour got
to it.
