# Clear point bonuses, and the slots-versus-experience question

A small note rather than a working document. Nothing here is patched, nothing
here is planned, and no build reads any of it. It came out of reading
`docs/battle-experience.md` and asking an idle balance question — whether the
new-game-plus points are better spent on extra party slots or on the experience
multiplier — and the answer turned out to be more interesting than the question
deserved, so it is written down before it is forgotten.

## The table

`ClearPointBonusCollection@0` (FUNC 27614) seeds the whole list, as five calls to
`Add(type, value, count)` (27620), which pushes `count` separate `ClearPointBonus`
instances each carrying `value`:

| Type | `ClearPointBonusType@String` | Value | Instances |
|---|---|---|---|
| 0 | `PartyBonusUp` | 1 | 4 |
| 1 | `ExpUp` | 50 | 8 |
| 2 | `MapExpBonusUp` | 1 | 2 |
| 3 | `StarOnStart` | 5 | 2 |
| 4 | `AllCharacter` | 0 | 1 |

One instance is one point: `SceneClearPoint@PointUnused::get` (25793) is
`m_point - g_clearPointBonus.UsedCount`, and `UsedCount` (27632) is a bare count
of the instances with `IsUse` set. Nothing is weighted, so every purchase on that
screen costs the same regardless of what it buys.

Each type is read through its own accessor, all of them over
`SumValues(type)` (27616), which sums `Value` across the *used* instances of that
type:

| Accessor | Formula |
|---|---|
| `PartyBonusOnStart::get` (27621) | `SumValues(PartyBonusUp)` |
| `RatioExpUp::get` (27623) | `(100 + SumValues(ExpUp)) / 100.0` |
| `MapExpBonusUp::get` (27625) | `SumValues(MapExpBonusUp)` |
| `BaseCardStarRank::get` (27627) | `SumValues(StarOnStart)`, read by `CharacterCollection@Create` (27974) |

## How the two reach the party

Extra slots go the long way round. `GameChapter1@InitPartyBonus` (FUNC 22548) is
three lines:

```c
g_partyBonus.Init();                                          // 27852
g_partyBonus.SetPoint(g_clearPointBonus.PartyBonusOnStart);   // 27858
g_party.SetAvailableCount(g_partyBonus.GetLeaderCount());     // 27794 ← 27867
```

so a clear point becomes a *party bonus* point, which then buys a party bonus.
Those cost one point apiece too — `PartyBonusSwitcher@UsedPoint::get` (27861) is
again a plain count of the enabled ones. `PartyBonusSwitcher@Init` (27852) seeds
`リーダー枠追加` (party bonus type 0) three times at value 1, and
`GetLeaderCount` (27867) is `4 + the enabled ones`, so slots run 4 to 7 and three
points is the whole of it. The fourth `PartyBonusUp` point has to buy something
else.

Experience goes straight in, and this is the part that matters:

```c
// Ｐ敵本体追加, FUNC 28898
g_battleResult.BaseExp = (int)(exp * g_clearPointBonus.RatioExpUp);
```

`RatioExpUp` multiplies `BaseExp` **before** the percentage bonuses
`docs/battle-experience.md` describes, so it is a true multiplier on the final
figure and nothing dilutes it. Three purchases is ×2.5, always.

That is worth contrasting with the *party* bonus of the same name, `ＥＸＰ強化`
(party bonus type 13), which `PartyStatus@CalcStatusPartyBonus` (27916) adds into
`CommonStatus.PerExpUp` — bonus 0 of the five in `CalcExp`. That one is worth 30
flat, and it lands in the same sum as the +20 for a win and the +50 for a
three-round kill, so its real value shrinks as the other bonuses grow: on a
`100 + 170` battle it is worth +11%, not +30%. Two things with nearly the same
name, on completely different footings.

## The arithmetic

Because experience is duplicated rather than divided — the point of
`docs/battle-experience.md` — a battle's total payout across the party is simply

```
T = (4 + s) × (1 + 0.5k)          s = slot points (0..3), k = ExpUp points (0..8)
```

in units of one character's base share. Which makes the trade a plain product to
maximise, and the marginal rule falls out of it: a slot point adds one more
recipient, worth `1 × ratio`; an ExpUp point adds half a share to everyone
already there, worth `0.5 × (4 + s)`. At four slots that is 2 against 1 — an
ExpUp point is worth exactly twice a slot point, and stays ahead until the ratio
catches up.

Spending three points:

| | Slots | Ratio | Total | Per character |
|---|---|---|---|---|
| 3 slots | 7 | 1.0 | 7.0 | 1.0 |
| 2 slots + 1 exp | 6 | 1.5 | 9.0 | 1.5 |
| 1 slot + 2 exp | 5 | 2.0 | **10.0** | 2.0 |
| 3 exp | 4 | 2.5 | **10.0** | 2.5 |

Going all-in on slots is the worst of the four, by a wide margin. But going
all-in on experience stops being optimal as the budget grows, because the slot
term is the one still climbing — at seven points the best splits are 3+4 and 2+5,
both at 21.0, against 18.0 for 0+7.

## Two things that argue the other way

**×2.5 experience is not ×2.5 power.** `Character::CalcNextExp` (27972) is
`min(99999, 100 × 1.1^star)`, so below star 73 — where `100 × 1.1^s` finally
reaches the cap — the cost of a star grows exponentially and the cumulative cost
of reaching star *s* is about `1000 × (1.1^s − 1)`. Multiplying the income by 2.5
therefore buys a *fixed offset* of roughly `ln(2.5) / ln(1.1) ≈ 9.6` stars, not
two and a half times as many: worth about +32% at star 30 and +12% at star 80.
Above star 73 the cost is a flat 99999 apiece and the multiplier finally means
what it says. The bonus is weakest exactly where a new-game-plus run starts.

**Slots pay immediately.** Three extra slots are three combat units, and by
`docs/party-total-hp.md` a slot is worth its faction's pooled HP plus that
character's own HP times four — available from the first battle rather than
accumulated. The cost is on the other side of the same document: more total HP
pushes `難易度調整` (35788) over its `弱すぎ補正` threshold more often, which
doubles ordinary enemies' attack and adds half again to their HP, in exchange for
110% experience.

## The footnote worth keeping

The fourth `PartyBonusUp` point cannot buy a fourth slot, because only three
`リーダー枠追加` exist. One of the things it can buy instead is `リーダー入れ替え`,
party bonus type 3 — and `PartyChangeRound@GetNewRound` (26695) is:

```c
if (g_partyBonus.IsEnable(3))
    return 1;
return 7 + RAND(7);
```

So that one point takes the party-change cooldown from eight-to-fourteen rounds
down to one. Which is what turns the swap described at the end of
`docs/battle-experience.md` — fight with the good party, swap in the characters
who need levels, then land the killing blow — from a once-a-battle trick into
something available every round.

Nothing here changes what this repository builds. It is recorded because working
it out of the dump took an afternoon and reading it back will not.
