# first-finisher-100

Whether a won battle gives you a treasure chest is a `RAND(100)` roll against five bonuses added
together, and a total of 100 or more is a guaranteed chest. One of the five, `%sで初トドメ` — First
Finisher — ships worth **+50**. Turn this feature on and it is paid as **+100** instead, which clears
the roll on its own: any battle that pays the First Finisher line becomes a certain chest, whatever
the other four bonuses add.

It is the companion of [always-first-finisher](../always-first-finisher/README.md). That feature
decides how *often* the line is paid — once per character per quest by default, every won battle with
it on. This one decides how *much* it is worth. So:

- **This feature alone** — the first kill of each character in a quest is a sure chest; later kills by
  that same character fall back to the other four bonuses.
- **Both features on** — the line is paid on every won battle *and* is worth enough to guarantee the
  chest, so every won battle gives one.

With it on, the result screen's First Finisher line reads `+100` instead of `+50`; the total above the
list still adds up, because the figure is changed where the bonus is stored rather than at the total.

## Turning it on and off

The game looks for `custom_mods\first_finisher_100_on`, beside `Rance10.exe`, as the result screen is
calculated. Create that empty file and the bonus is +100; delete it and it goes back to +50. Neither
direction needs the game restarted.

A release folder ships that file already made. An install straight into a game folder does not — those
files are the player's.

## Leaving it out of a build

It is built into `Rance10.ain` by default, and does nothing until the file above exists:

```
node scripts/ain.js --without=first-finisher-100
```

## How it works

The figure `50` is the `value` argument to `BattleBonusCollection@Set#1`, the function every treasure
and experience bonus is stored through. `BattleBonusCalculator::CalcTreasure` calls it directly for the
First Finisher — `Set(初トドメ, 50, id)` — so the hook re-emits that function with a four-instruction
prefix: when the bonus type is `初トドメ` (`BattleBonusType` 8), it replaces `value` with the switched
figure and lets the rest of the function store and total it as before. Every other bonus type falls
straight through untouched.

That is why the feature is a `.jam` plus a `.jaf` rather than a plain `.jaf`, and this is the reason
worth knowing: `Set#1`'s first parameter is the enum `BattleBonusType`, which alice-tools' `.jaf`
compiler will not name — an `override` of it cannot be written as source, because the parameter is
either a parse error (`BattleBonusType type`) or a type error the moment `super()` is handed it back
(`int type`). Assembly has no type system in the way. The `.jaf` half is only the switch-file check,
which is cleaner as source; the `.jam` half is the substitution.

[docs/treasure-chest-chance.md](../../docs/treasure-chest-chance.md) has the arithmetic: the five
bonuses, the roll, and why changing the figure at `Set#1` is the one knob here that keeps the result
screen's itemised list and its total agreeing.
