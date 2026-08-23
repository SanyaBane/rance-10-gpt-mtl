# rank-up-keep-progress

Two things hand a character a rank outright: the `ＥＸＰ` tile on a quest map, and the in-battle
effect behind `<Player>がランクアップ！`. Both give exactly what is missing from the next rank and no
more, so the experience bar is empty afterwards — which makes a rank-up worth least to whoever had
earned the most toward it. A character 99% of the way there collects a single point. Getting a
tile's full value means saving it for somebody who has just ranked up, which is busywork rather than
a decision.

Turn this feature on and the whole price of the rank is handed over instead, so what was already
earned stays in the bar: rank 22 at 545 of 814 becomes rank 23 at 545 of 895, rather than 0 of 895.

## Turning it on and off

The game looks for `custom_mods\rank_up_keep_progress_on`, beside `Rance10.exe`, as the rank is
awarded. Create that empty file and the progress is kept; delete it and the bar empties the way it
always did. Neither direction needs the game restarted, and switching part-way through a playthrough
is safe — your saved games are not touched, and only what happens from then on changes.

A release folder ships that file already made. An install straight into a game folder does not —
those files are the player's.

## Leaving it out of a build

It is built into `Rance10.ain` by default, and does nothing until the file above exists:

```
node scripts/ain.js --without=rank-up-keep-progress
```

## How it works

It carries the points rather than the percentage. Each rank costs 1.1× the one below it, so a kept
percentage drifts down about a tenth of a rank each time — and holding it exactly would mean float
arithmetic at both sites, where this needs none at all.

There are two sites, because the game gives a rank away in two places and both hand over exactly the
shortfall:

| Function | File |
|---|---|
| `SceneQuestMapExp@ShowExpUpEffect` (23856) | `quest_map_exp.jam` |
| `SkillEffectProcessRankUp@Process` (27510) | `skill_rank_up.jam` |

Both are patched: leaving one behind would make the same rank-up worth different things depending on
where it came from. They are `.jam` files — methods reading their own struct members, the same wall
the enemy panel hit — over one shared `rank_up_keep_progress.jaf`, which has to be compiled before
either is assembled.

What each gains is a single `CALLFUNC` between the `c.Exp` read and the `SUB` that was already
there: the switch answers `0` in place of `c.Exp`, the subtraction stays where it was, and a build
that carries the feature with no switch file is instruction-for-instruction identical to the game's
own.

The friendship screen's own rank-ups (`FriendPanel@RankUp` 24773 and `RankUpOtherCharacter` 24774)
are deliberately left alone. They pay a flat amount rather than a shortfall, so there is nothing in
them to carry — they already leave whatever they do not spend in the bar.

[docs/rank-up-keep-progress.md](../../docs/rank-up-keep-progress.md) has the arithmetic, the
alternative it did not take, and the four places it deliberately leaves alone.
