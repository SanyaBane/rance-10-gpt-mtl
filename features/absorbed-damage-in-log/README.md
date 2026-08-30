# absorbed-damage-in-log

Some enemies carry a support state the hint under their stats describes as "Takes no damage unless a
single hit clears a certain threshold" — `制限装甲` on the panel, which the translation has never
reached. A hit under that threshold does **nothing at all**; a hit over it does exactly **100**,
whatever you actually rolled. Either way the number you rolled is thrown away, and the battle log
never says what it was:

```
Rance's Rance Attack！ resulted in…Cannot deal damage！(Limit Break)
```

On an absorbed hit the game does draw that number over the enemy and count it down to zero, so if you
happen to be watching you see it once and never again. On a break it does not draw it at all — the
flying number there is the flat 100. Turn this feature on and both say so:

```
Rance's Rance Attack！ resulted in…Limit Broken！ (7340 raw)
Stone Guardian took 100 of damage！

Rance's Rance Attack！ resulted in…Cannot deal damage！(Limit Break) (1780 absorbed)
```

The two words are not interchangeable and the feature picks between them: on an absorbed hit the
damage really was swallowed, and on a break it was not — it was replaced by 100, so what the number
says is what you rolled before the armour got to it.

The threshold itself is already readable without this: it is written into the support state's own
description, "Damage <5,000 is completely blocked", which [enemy-panel](../enemy-panel/README.md) puts
on screen every round. There are twelve tiers, 5 000 up to 2 000 000. So your own damage was the only
half of the comparison you could not check, and with both features on the log answers "how much more
do I need" outright.

## Turning it on and off

The game looks for `custom_mods\absorbed_damage_in_log_on`, beside `Rance10.exe`, each time a guarded
hit is logged. Create that empty file and the number is written; delete it and the two lines read
exactly what they always read. Neither direction needs the game restarted — it takes effect on the
next attack.

A release folder ships that file already made. An install straight into a game folder does not — those
files are the player's.

## Leaving it out of a build

It is built into `Rance10.ain` by default, and does nothing until the file above exists:

```
node scripts/ain.js --without=absorbed-damage-in-log
```

## How it works

`制限装甲` is skill effect 107 and its value is the threshold.
`PlayerAttackDamageCalculator@CalcSpecificAegisEffect` compares the finished damage against it and
sets `GuardType` to `GuardBreak` or `Guard` — after which `DamageInformation@TotalDamage` answers 100
or 0 and the real figure survives only in `@PreGuardDamage`, which is the base damage plus every
additional damage. That is the number this feature prints, and it is the same one the game itself
takes for the flying number on an absorbed hit.

`SceneBattle@ShowLogGuard` is the hook: it is the one place either outcome is put into words, it has
the `DamageInformation` as an argument, and it has a single caller — `SceneBattle@ShowAttackDamage`,
the `OnDamageEvent` handler, which reaches it only for a player attack. It also already holds three
`ref BattleLog` locals, which is the part a `.jam` cannot arrange: `--jam` rewrites code and leaves
the `FUNC` section alone, so a patched function has exactly the locals it was compiled with, and
building a log entry needs one.

The number goes in as a log entry of its own rather than as a longer version of the two lines above
it, so turning the feature off leaves those two alone. `" raw"` and `" absorbed"` are the only words
this feature invents, and they are the only strings in it that are not translation.

The `.jaf` half is the switch-file check, which needs a string local and so cannot live in the `.jam`.
[docs/absorbed-damage-log.md](../../docs/absorbed-damage-log.md) has the write-up, including the one
thing this feature is not free of: it has to re-push two strings the translation owns, which is why
`modules/GuardLog.js` holds it to `patches/system_cherry_picks.v1.04.ain.txt` at every build.
