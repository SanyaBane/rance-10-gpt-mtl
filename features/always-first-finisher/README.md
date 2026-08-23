# always-first-finisher

Whether a won battle gives you a treasure chest is a `RAND(100)` roll against five bonuses added
together. One of them, `%sで初トドメ` — First Finisher — is worth +50, but only the first time a given
character lands a killing blow in a quest; every later kill by that same character is worth nothing.
Collecting it therefore means rotating who finishes each battle, which is busywork rather than a
decision. Turn this feature on and the +50 is paid on every won battle, whoever finished it.

With it on, the result screen lists First Finisher +50 after every won battle. That caption was
already English, so nothing had to be translated for this.

## Turning it on and off

The game looks for `custom_mods\always_first_finisher_on`, beside `Rance10.exe`, as the result
screen is calculated. Create that empty file and the bonus is paid every time; delete it and it goes
back to once per character per quest. Neither direction needs the game restarted.

A release folder ships that file already made. An install straight into a game folder does not —
those files are the player's.

## Leaving it out of a build

It is built into `Rance10.ain` by default, and does nothing until the file above exists:

```
node scripts/ain.js --without=always-first-finisher
```

## How it works

The flag it switches off is `Character.IsFinishAttack`, which exists for this bonus and nothing
else. It is read from exactly one place in the whole `.ain`, `BattleBonusCalculator::CalcTreasure`,
and read through its accessor rather than as a field — so overriding `Character@IsFinishAttack::get`
to answer `false` reaches that one `if`, and nothing else in the game can notice.

That also makes it the only feature here that is a plain `.jaf` and nothing else: a property getter
needs neither `this` nor a caller's argument, which is exactly what forced the enemy panel and the
cooking skills into hand-written assembly. One file, so there is no ordering requirement either —
the same `.jaf` defines the switch and overrides the getter.

[docs/treasure-chest-chance.md](../../docs/treasure-chest-chance.md) has the rest of the arithmetic:
the other four bonuses, the boss bonus that makes a chest certain on its own, and the one case this
feature deliberately leaves alone.
