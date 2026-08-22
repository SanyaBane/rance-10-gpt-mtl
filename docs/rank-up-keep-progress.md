# A rank-up that keeps the progress it lands on

Two things in Rance 10 give a character a rank outright: the `ＥＸＰ` tile on a
quest map, and the in-battle rank-up skill effect. Both work out what is missing
from the next rank and hand over exactly that, which leaves the bar empty
afterwards — so the further along the bar already was, the less the rank-up was
worth. A character 99% of the way to the next rank collects a single point of
experience from a tile that a freshly-ranked character collects hundreds from.

`features/rank-up-keep-progress/` hands over the full price of the rank instead,
so what the character had already earned stays in the bar. This is the read
behind it.

```
node scripts/ain.js --text-lang=jp --out=build/scratch     # the feature over the game's own script
node scripts/ain.js --without=rank-up-keep-progress        # a build without it
```

| File | What it is |
|---|---|
| `features/rank-up-keep-progress/rank_up_keep_progress.jaf` | the switch: the file lookup, and the one number the two hooks read |
| `features/rank-up-keep-progress/quest_map_exp.jam` | the map tile: `SceneQuestMapExp@ShowExpUpEffect` (23856), reassembled |
| `features/rank-up-keep-progress/skill_rank_up.jam` | the skill effect: `SkillEffectProcessRankUp@Process` (27510), reassembled |
| `custom_mods\rank_up_keep_progress_on` | in the game folder, beside `Rance10.exe` — create it to turn the feature on |

`docs/battle-experience.md` has the call chains that reach both sites, what
`Character@AddExp` does with a number once it has one, and the full list of what
else reads a character's star and experience. This note is only about the
subtraction.

## The two sites

They are one instruction apart in shape:

| Function | What it hands `AddExp` |
|---|---|
| `SceneQuestMapExp@ShowExpUpEffect` (23856) | `CalcRankUpExp(c.Star) - c.Exp` |
| `SkillEffectProcessRankUp@Process` (27510) | `c.NextExp - c.Exp` |

The difference between them is only where the threshold comes from — the map
tile recomputes it from the star count through `SceneQuestMapExp@CalcRankUpExp`
(23857), because it may be paying for more than one rank; the skill effect reads
the stored `Character@NextExp` field. Neither is touched here. What both have in
common is the `- c.Exp`, and that is the whole of the change.

The map tile reaches `ShowExpUpEffect` through the no-argument
`QuestScenes::RunQuestMapExp` (26318), which has two callers — the quest map's
own event dispatcher and the `擬態／ＥＸＰＵＰ` mimic result — and both are
affected. The two-argument form (26319), which the chapter-3 simple battle uses
to pay an explicit amount, never enters the branch below.

## What the patch changes

Only the subtrahend. `RankUpExpToConsume` returns `c.Exp` with the switch file
absent and `0` with it there, and the call sits between the `c.Exp` read and the
`SUB`:

```
	.LOCALREF c
	PUSH 27941
	CALLMETHOD 0                 ; c.Exp
	CALLFUNC RankUpExpToConsume  ; c.Exp, or 0 while the switch is on
	SUB
```

Subtracting a zero rather than deleting the `SUB` is deliberate. A deleted
instruction cannot be put back by a file in `custom_mods`, so the `.ain` would
carry the change for everybody; with the subtraction left in place the
switched-off path is instruction-for-instruction what the game shipped. Verified
by diffing both functions out of a `--without=rank-up-keep-progress` build
against `alice ain dump -c` of the game's own `.ain`: identical.

## The arithmetic

`Character::CalcNextExp(star)` (27972) is `min(99999, (int)(100 * 1.1^star))`,
and a flat `99999` from star 100 up. So rank 22 costs 814 and rank 23 costs 895.
Take a character at rank 22 with 545 in the bar:

| | rank | bar | what the rank-up hands over |
|---|---|---|---|
| before | 22 | 545 / 814 — 67% | |
| unpatched | 23 | 0 / 895 — 0% | `814 - 545` = 269 |
| switch on | 23 | 545 / 895 — 61% | `814 - 0` = 814 |

`Character@AddExp` (27962) does the rest without being asked: it spends the sum
one rank at a time, and whatever is left when it can no longer afford another
rank is what stays in the bar. Here that remainder is 545 — the number the
character started with.

It cannot overshoot into an extra rank, and that is a property of `AddExp`
rather than of anything here. It only ever leaves a remainder smaller than the
rank it just paid for, so `c.Exp < c.NextExp` holds going in and coming out, and
the carried amount is by construction too small to buy anything. The rank-up
count the result screen animates (`LevelUpResult.UpStar`, from the star before
and after) is right for the same reason.

## Why the points and not the percentage

Carrying the bar's *percentage* — rank 22 at 67% becoming rank 23 at 67% — is
the other reading of "keep the progress", and it is not what this does. Each
rank costs 1.1× the one below it, so holding the points means the percentage
drifts down by about a tenth per rank: 67% becomes 61% above.

Holding the percentage instead would mean computing `exp / NextExp(star)` as a
ratio and multiplying it back out against the next rank's threshold, in float,
at both sites — `ITOF`/`F_MUL`/`F_DIV`/`FTOI`, the way the quest map's own damage
tile does its percentage. In integers it would overflow: `99999 * 99999` is
about five times `INT_MAX`.

That is a real patch and not a hard one, but it buys a sixth of a rank over a
version that needs no arithmetic at all — one call and one existing `SUB`, with
the switched-off path left bit-identical. The points version is what is built.

## More than one rank at a time

`CalcRankUpExp` sums `CalcNextExp(star + i)` over
`i < g_clearPointBonus.MapExpBonusUp` (27625), the clear-point purchase that
buys how many ranks a tile is worth — `SumValues(MapExpBonusUp) + 1`, so 1 by
default and up to 3 with both points spent. The carry composes with it without
any special handling: `AddExp` spends the whole sum rank by rank, and the same
remainder is left at the end of it.

## What it does not touch

**A character at maximum star.** `Character@AddExp` returns 0 before doing
anything when `IsMaxStar`, so the experience is discarded — exactly as it is
now, with or without the switch.

**The friendship screen.** `FriendPanel@RankUp` (24773) and
`RankUpOtherCharacter` (24774) pass their caller's `exp` straight to `AddExp`.
There is no shortfall in them to carry: they already leave whatever they do not
spend in the bar.

**The food ticket and the battle payout.** `SceneFoodTicket@RunApplyExpEffect`
(24708) and `SceneBattleResult@ShowExpUpEffect` (25426) also pay flat amounts.
`docs/battle-experience.md` covers both.

**Anything that is said rather than counted.** No string is patched, which is
what lets the feature build under `--text-lang=jp` along with everything else.
The rank-up banner and the bar animation are unchanged; what changed is a
number, not what is displayed about it.

## Verifying

Build into a scratch directory and read the result back, rather than trusting
the patch:

```
node scripts/ain.js --out=build/scratch-rankup
alice ain dump -c -o built.code build/scratch-rankup/Rance10.ain
```

`CALLFUNC RankUpExpToConsume` should appear exactly twice, once inside
`FUNC 23856` and once inside `FUNC 27510`. Note that alice-tools relocates a
reassembled function to the end of the code section and re-resolves its labels,
so the addresses in the built dump will not match the ones in the `.jam` — the
instruction sequence is what to compare.
