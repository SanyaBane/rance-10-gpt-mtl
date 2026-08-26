# base-stats-on-card

The back of a card shows `HP` and `AT`, and both are the number *after* the character's rank has
been applied. Which means the card never tells you the thing you actually want when deciding who to
sink experience into: what that card is worth before its rank flattered it. Turn this feature on and
each row carries that figure in brackets ahead of the live one — `HP (150) 390`, `AT (250) 650`.

The bracket is **what the card is worth at rank 0**, so on a fresh character the two numbers on a row
are the same and the bracket explains itself. Everything above rank 0 is that figure grown:

```
shown = (base + 10 × (tier − 1)) × (5 + rank) × (1 + 0.1 × (copies − 1))
```

`tier` steps at ranks 10, 20, 40, 80 and 160; `rank` belongs to the character, not the card, so all
five Pastel cards share it; `copies` caps at 11, which is exactly double. Nothing in there is
per-card: the bracket is the whole of what separates one card from another, and two cards with the
same bracket are the same card as far as the arithmetic is concerned.

What it is *not* is a ratio you can read straight off. The `+10` per tier is added to the base rather
than scaled, so a small base catches up — a card worth five times another at rank 0 is worth 1.67
times it by rank 200. [docs/card-base-stats.md](../../docs/card-base-stats.md) has the table.

## Turning it on and off

The game looks for `custom_mods\base_stats_on_card_on`, beside `Rance10.exe`. Create that empty file
and the brackets appear; delete it and the card reads the way it always did.

Unlike the other features, this one is best set **before** starting the game. The layer it draws on
is cached per card the first time you look at that card, so a card already seen this session keeps
the face it was drawn with; a card you have not opened yet picks up the change at once.

A release folder ships that file already made. An install straight into a game folder does not —
those files are the player's.

## Leaving it out of a build

It is built into `Rance10.ain` by default, and does nothing until the file above exists:

```
node scripts/ain.js --without=base-stats-on-card
```

## What it does not touch

Only the back of the card. The front and the `統合部隊DATA` face are separate classes with caches of
their own, and neither shows HP or ATK at all.

Item cards go through the same face, and most of them carry 0 in both columns — so an item reads
`(0) 0`, which is what it already read minus the brackets. The live `0` is the game's own.

Nothing about the arithmetic moves. This is a number the screen was withholding, not a change to
what any of it means.

## How it works

`CardConstructProcessCacheBackCard@Create` (FUNC 23037) already blends three text lines through a
`FontProperty` it owns, and its cache key is the card Id — which is exactly what the base stats
depend on. So the addition is two more `ConstructProcess::BlendText` calls at the end of it, needing
no local the function was not compiled with.

A `.jam` rather than a `.jaf`, and for a sharper reason than the other features: probed against this
`.ain`, the `.jaf` compiler rejects every piece of it — `card.Hp` is a property
(`Invalid struct member name`), `fp.SetSize` is a struct method (the same), and
`array<CASConstructionProcess>` is `Unresolved typedef`. `base_stats_on_card.jaf` is left with the
switch alone, and has to be compiled before the `.jam` is assembled.

The two files say the rest, and [docs/card-base-stats.md](../../docs/card-base-stats.md) has the
formula, where each number lives, and the layout of the card face down to the pixel.
