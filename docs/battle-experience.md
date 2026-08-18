# Experience after a battle

One number is computed per battle, and then handed **in full** to every
character standing in a party slot at the moment the result screen runs. It is
not divided, and it is not shared: seven characters in the party means seven
copies of the same figure. Which characters those are is decided later than you
would expect — after the battle is over, and before the party is rolled back to
what it was when the battle started. This is a read of how it is assembled and
who it reaches, written while working out whether the recipient list can be
changed; nothing here is patched yet.

Everything below is in `Rance10.ain`. Nothing about experience lives in the
`.ex` tables or the `.pactex`.

## Where to look

Function ids are properties of the `.ain` and are the stable way to find any of
this again; line numbers are from a code dump, which is regenerable but
gitignored:

```
alice ain dump -c -o local/Rance10.v1.04.code.jam game/ain/Rance10.v1.04.ain
```

A method call is `PUSH <function id>` followed by `CALLMETHOD <argc>`, so
reading the dump means resolving ids to names, and the dump carries both — a
name comment above every `FUNC n`. `docs/treasure-chest-chance.md` has the `awk`
one-liner that builds the table; everything named here was found that way, plus
a reverse pass over `PUSH <id>` to find each function's callers.

One warning about that one-liner if you extend it to record where each function
*ends*: the dump has 35934 `FUNC` lines and only 15684 `ENDFUNC` lines, so
bounding a body by `ENDFUNC` silently loses more than half the file — including
`CalcExp` itself. Bound it by the next `FUNC` instead.

## The chain

```
BattleSceneSet@Open                                  (FUNC 27582)
 │
 ├─ RunBattle → BattleSceneSetNormal@Process          (27585 → 27588)
 │    ├─ BattleScenes::RunBattle                        the battle itself
 │    ├─ BattleBonusCalculator::Calc(g_battleResult.Type)  (24818)
 │    │     └─ CalcExp (24819) — the five percentage bonuses
 │    ├─ BattleSceneSetNormal@ResetParam                (27592)
 │    │     skill counts, swap records, banned characters — not the party
 │    └─ BattleScenes::RunBattleResult → SceneBattleResult@0   (25418)
 │           ├─ CalcResult       (25420)  g_playerCommonParam.TotalExp += GetTotalExp()
 │           ├─ InitCardView     (25423)  one card view per occupied party slot
 │           ├─ InitResultView   (25424)  prints BaseExp and GetTotalExp
 │           └─ ShowExpUpEffect  (25426)  ← the experience is handed out here
 │
 └─ RunPostProcess                                    (27586)
      └─ Party@ProcessPostBattle (27821)
            IsFixStatus = false; RestoreCardIds()     ← the party is rolled back
```

`ShowExpUpEffect` is not called inline — `SceneBattleResult@Run` (25421) hangs it
on a one-second `instantTimer`, through the lambda FUNC 37040, which also sets
`m_state = 1`. It still runs well before `RunPostProcess`, because the whole
result scene is inside `RunBattle`.

The order is the whole point. `RestoreCardIds` — the half of
`docs/party-total-hp.md`'s snapshot machinery that puts the pre-battle party back
— runs **after** the payout, not before it. So the characters who are paid are
the ones in the slots when the battle ends, not the ones who were in them when it
began.

## Who gets it

`SceneBattleResult@ShowExpUpEffect` (FUNC 25426), reconstructed:

```c
void SceneBattleResult@ShowExpUpEffect()
{
    int index = -1;
    foreach (ref LeaderCard t in g_party._Leaders.GetAvailableInstance())
    {
        index++;
        ref LevelUpResult r = CharacterLevel::AddExp(
            g_character.Get(t.CharacterId),
            g_battleResult.GetTotalExp());       // the same figure every time

        if (r == NULL)
            continue;
        if (r.UpRank > 0)
            m_rankUp.PushBack(r);
        m_cardView[index].ShowApplyExpEffect(r.UpStar);
    }
}
```

Three things are worth stating plainly:

- **`GetTotalExp()` is re-read inside the loop and never divided.** Every
  recipient receives the whole amount. A one-character party and a seven-
  character party each get the same number *per character*; the party size is
  purely a multiplier on how much experience the fight produces in total.
- **The recipient list is `g_party._Leaders.GetAvailableInstance()`** (27828 →
  27162), the same "occupied slots only" filter `PartyStatus@CalcTotalHp` uses.
  It is read live, at payout time.
- **`m_cardView` is built from the same call** in `InitCardView` (25423), and
  `ShowExpUpEffect` indexes into it positionally. Those two are the *only* two
  places the whole of `SceneBattleResult` touches `g_party` — so they move
  together, and anything that changes one has to change the other or the
  animation lands on the wrong card.

Nothing anywhere asks whether a character acted, attacked, took damage, or was
even present for a single round.

## The formula

`BattleResult@GetTotalExp` (FUNC 27295):

```c
int BattleResult@GetTotalExp()
{
    return (int)(BaseExp * ((100 + Bonus.GetTotalPerExp()) / 100.0));
}
```

`GetTotalPerExp` (27281) is `GetTotalPerBonus(GetExpList())` — `GetExpList`
(27278) is an `Array Where` over `BattleBonus@IsExpBonus::get` (27272), which is
`Type < 5`, and `GetTotalPerBonus` (27285) is a bare sum of the `Value` field.
No weighting and no cap. The float division is done before the multiply and the
result is truncated, so the bonuses behave as an ordinary percentage.

`BattleBonusCollection@AdjustBonusValues` (27283) — the one interaction hidden in
`Set` — only ever zeroes bonus 9 when bonus 6 is present, both of which are
treasure bonuses. It cannot touch the experience half.

### The five bonuses

`BattleBonusCalculator::CalcExp` (FUNC 24819), reconstructed:

```c
void BattleBonusCalculator::CalcExp()
{
    ref BattleContext context = g_battleContext;
    ref BattleResult  r       = g_battleResult;

    CommonStatus st = context.GetPlayer(0).TotalStatus;
    r.Bonus.Set(部隊_ＥＸＰ増加, st.PerExpUp);

    if (r.Type == Win)
        r.Bonus.Set(結果_勝利, 20);

    if (context.Round.Value <= 3 && r.Type == Win)
        r.Bonus.Set(結果_３ラウンド内撃破, 50);

    if (g_battleContext.IsOneRoundKill)
        r.Bonus.Set(結果_１ラウンド撃破, 50);

    if (g_battleContext.GetPlayer(0).HpRatio <= 0.1)
        r.Bonus.Set(自軍ＨＰ１０％以下, 50);
}
```

| # | Caption | Value | When |
|---|---|---|---|
| 0 | `部隊.ＥＸＰ増加` | the party's summed `PerExpUp` | always |
| 1 | `結果.勝利` | 20 | the battle was won |
| 2 | `結果.３ラウンド内撃破` | 50 | won, on round 3 or earlier |
| 3 | `結果.１ラウンド撃破` | 50 | `BattleContext.IsOneRoundKill` |
| 4 | `自軍ＨＰ１０％以下` | 50 | party HP at 10% or less |

Captions are from `BattleBonus@Caption::get` (27268, and its identical twin
`::get#1`, 27269) — the five treasure captions in the same switch are documented
in `docs/treasure-chest-chance.md`, and `Type < 5` is the whole of the split.

`BattleResultType` is `0 None, 1 Win, 2 Lose, 3 TimeOver`
(`BattleResultType@String`, FUNC 36278). `BattleBonusCalculator::Calc` (24818)
runs `CalcExp` **and** `CalcTreasure` on a Win, and `CalcExp` alone on a
TimeOver — so a timed-out battle still pays experience, just without bonuses 1
and 2, and without a chest.

Note that bonus 0 reads `context.GetPlayer(0).TotalStatus`, the *battle* party's
aggregate — computed when `Calc` runs, immediately after the battle and before
the result scene. Both the percentage and the recipient list are therefore taken
from the post-swap party, but at two different moments.

### Where `BaseExp` comes from

Two writers, both through `BattleResult@BaseExp::set` (27294):

**`Ｐ敵本体追加` (FUNC 28898)**, the scenario command that creates the enemy body,
sets it from that enemy's own `exp` argument:

```c
g_battleResult.BaseExp = (int)(exp * g_clearPointBonus.RatioExpUp);
```

`RatioExpUp` (`ClearPointBonusCollection@RatioExpUp::get`, 27623) is a float
multiplier bought with clear points. Because this is an assignment rather than an
accumulation, the last body created wins — it is the main enemy's figure, not a
sum over everything on the field.

The `exp` handed in is `▲経験値`, which `難易度調整` (FUNC 35788) has already had
a pass at: under the `弱すぎ補正` "too weak" correction it is multiplied by 110%,
the same block that doubles the enemy's attack and adds half again to its HP.
That correction triggers on the party's total HP, so `docs/party-total-hp.md`'s
formula feeds this one. The base figure per difficulty level comes from
`基礎経験値取得` (FUNC 35789) — a flat table running 24 at difficulty 0 to 8500 at
difficulty 35 — and `TadaFunc::GetBasicExp` (28990) is that table doubled.

**`経験値ＧＥＴ` (FUNC 28897)**, the scenario command for a scripted award, which
fakes a whole battle result around it:

```c
void 経験値ＧＥＴ(int exp)
{
    BattleInitializer::Init();
    g_battleResult.BaseExp = exp;
    g_battleResult.Type    = Win;
    BattleScenes::RunBattleResult();
}
```

so a scripted award goes through exactly the same screen, the same bonuses, and
the same recipient list as a fought one.

## What `AddExp` actually does

`CharacterLevel::AddExp(c, exp)` (FUNC 28006) wraps `Character@AddExp` (27962)
and packages the before/after into a `LevelUpResult` for the animation. The
arithmetic is all in `Character@AddExp`:

```c
int Character@AddExp(int val)
{
    if (IsMaxStar)                       // m_star == Character::GetMaxStar()
        return 0;

    int rankUpCount = 0;
    int addValue    = val;

    while (Exp + addValue >= NextExp) {
        addValue = Exp + addValue - NextExp;
        Exp      = 0;
        if (AddStar())                   // ++m_star, false at the cap
            rankUpCount++;
        NextExp = Character::CalcNextExp(m_star);
    }

    Exp = IsMaxStar ? 0 : Exp + addValue;
    return rankUpCount;
}
```

`Character::CalcNextExp(star)` (27972) is `min(99999, (int)(100 * 1.1^star))`,
and a flat 99999 from star 100 up. `Character::GetMaxStar` (27971) reads the
`ランク上限` entry out of the `.ex` tables, defaulting to 999.

The star count is not the star *rank*: `Character::GetStarRankFromStar` (27969)
buckets it — under 10 → 1, under 20 → 2, under 40 → 3, under 80 → 4, under 160 →
5, else 6.

## The other three ways experience is handed out

**`SceneQuestMapExp`** (FUNC 23846–23858) is a second, separate screen with its
own recipient list, reached through `QuestScenes::RunQuestMapExp` (26318) and
`#1` (26319):

| Caller | What it is |
|---|---|
| `QuestMapSystemEventDispatcher::Run` (28426) | the quest map's experience tile |
| `ExtraCardConverter::Convert` (26052) | the `擬態／ＥＸＰＵＰ` mimic result |
| `SceneSimpleBattleResult@Run` (25475) | the chapter-3 simple battle |

The no-argument form builds its list from `g_party.GetCardId(i)` for all seven
slots at construction and passes `exp = INT_MIN`, which
`SceneQuestMapExp@ShowExpUpEffect` (23856) reads as a sentinel meaning "fill to
the next rank or ranks":

```c
foreach (id in m_cardIds) {
    if (id == "") continue;
    ref Character c = findCharacterFromCardId(id);
    int exp = m_exp;
    if (exp < 0)
        exp = CalcRankUpExp(c.Star) - c.Exp;
    ...  CharacterLevel::AddExp(c, exp)
}
```

`CalcRankUpExp` (23857) sums `Character::CalcNextExp(star + i)` over
`i < g_clearPointBonus.MapExpBonusUp` (27625) — another clear-point purchase,
this one buying *how many* ranks the tile is worth. The two-argument form
(`RunQuestMapExp#1`) takes an explicit amount and an explicit list, which is how
the simple battle pays its own `SimpleBattleParty.CardIds` — a roster kept apart
from `g_party` entirely — scaled by `SimpleBattleParty.ExpRatio` and by a further
0.2 when the battle ended in retreat.

**The food ticket** — `SceneFoodTicket@RunApplyExpEffect` (FUNC 24708) — is the
game's own catch-up mechanism, and it is worth reading in full because it is one
line:

```c
int exp = g_playerCommonParam.TotalExp / 2;
CharacterLevel::AddExp(g_character.Get(card.CharacterId), exp);
```

Half of the *lifetime* accumulated battle experience, to one character of the
player's choosing, benched or not. That is what `PlayerCommonParam.TotalExp` is
for: `SceneBattleResult@CalcResult` adds every battle's `GetTotalExp()` to it and
nothing ever subtracts.

**`FriendPanel@RankUp` / `RankUpOtherCharacter`** (24773/24774) and
`SkillEffectProcessRankUp@Process` (27510) call `Character@AddExp` directly, for
the friendship screen and for the rank-up skill effect.

## What else reads these numbers

Changing any of this is not local, because three separate quantities are in play
and each is read elsewhere.

**`Character.m_star` — the character's level.** Through `Character@GetStar`
(27934) it reaches `PlayerCard@GetStar` (28156), and from there
`PlayerCard@RecalcHpAndAtk` (28151), which is where a card's HP and ATK are
derived from it. That in turn is what
`OrganizationCardCollection@RecalcStatus` sums into the faction pool that
`docs/party-total-hp.md` shows a party slot is mostly made of. So experience →
star → card stats → faction pool → party total HP → `難易度調整`'s "too weak"
correction, which makes ordinary enemies hit twice as hard and hands back 110%
experience. The loop closes on itself.

It is also read by `LeaderCardCollection@GetStarLessThan` (27165),
`PartyIndexer@SelectStarLessThan`, `NgPlayerCardManager@IsNg`,
`HastleProcessor@GetTargetCardId`, `SkillEffectProcessRankUp@FindLeader`,
`PlayerCardSorter@CreateInfo`, the card constructors, and
`CharacterCollection@GetTakeOverInfo` — the new-game-plus carry-over.

**`Character.m_exp` — progress toward the next star.** Read by the two views
that draw the bar (`ExpCardView@SetParam` 22957,
`ExpCardView@RunBarMotionCurrentToNewValue` 22961),
`PlayerDetailStatusView@SetParam` (24445), the friendship panel, and
`SceneQuestMapExp@ShowExpUpEffect` for its fill-to-next-rank sentinel.

**`PlayerCommonParam.TotalExp` — the lifetime running total.** Nine readers, and
two of them are not cosmetic:

| Reader | What it does with it |
|---|---|
| `SceneFoodTicket@RunApplyExpEffect` (24708) | a food ticket is worth `TotalExp / 2` |
| `SceneSaintGirlMonsterEvent@Evaluate` (23659) | the event fires when `TotalExp % 10 == 7` |
| `SceneBattleResult@CalcResult` (25420) | writes it |
| `BattleResultValueViewGroup@Init` (25411) | the third figure on the result screen |
| `QuestResultView@FadeIn` (23561) | the `ExpNumber` field on the quest result |
| `FoodTicketTargetGroup@RunExpCountUpMotion` (24695) | the ticket screen's count-up |
| `SceneFriend@0` (24796) | cached for the friendship screen |
| `ExtraCardConverter::Convert` (26052) | `擬態／累積ＥＸＰ倍増` doubles it |
| `累積ＥＸＰ取得` (29007) | the scenario scripts' handle, currently uncalled |

The saint-girl one is the trap: it is a modulo test on a number that every
battle moves, so anything that changes how much experience a battle produces
changes how often that event triggers. Anything that changes only *who is paid*
leaves it alone, since `CalcResult` adds `GetTotalExp()` once regardless of the
party.

## The consequence

Put the three facts together — the payout is per-character rather than split, it
is taken from the party as it stands at the end of the battle, and the rollback
happens afterwards — and the optimal play is to fight with whoever wins the
fight and then swap the whole party for characters who need levels before
landing the last hit. The swapped-in characters are paid in full, the
swapped-out ones are paid nothing, and `RestoreCardIds` hands the good party
back a moment later so the swap costs nothing beyond the battle it was made in.

It is not free, though, and the price is worth knowing before deciding how much
the problem is worth:

`PartyChangeRound@IsEnable::get` (26696) allows a change only when
`PartyChangeRound.Round == 0`, the collection allows it, and no available leader
has used a skill this round. Once changed, `PartyChangeRound@Reset` (26694) sets
`Round = GetNewRound()` (26695), which is:

```c
int PartyChangeRound@GetNewRound()
{
    if (g_partyBonus.IsEnable(3))
        return 1;
    return 7 + RAND(7);          // 8 to 14
}
```

and `PartyChangeRound@Dec` (26698) takes one off it per player turn, from
`SceneBattle@ProcessPostPlayerTurn` (24886). So without party bonus 3 the swap is
a once-per-8-to-14-rounds resource and the tactic is only worth it on a long
fight; with party bonus 3 enabled it is available every round, and the tactic
becomes routine.

The rearrangement itself goes through the ordinary path —
`FormationViewGroup@SetCard` (24115) → `Party@Set` (27787) / `Party@Unset`
(27788) — and `LeaderCardCollection@Set` (27132) calls `LeaderCard@Init`, which
resets that slot's HP, status, state and skill counters. A swapped-out
character leaves nothing behind that a payout rule could find.

## What could be changed, and where it would be cut in

Four options, roughly in order of what they cost to build. None of them is
implemented.

### A. Pay the party that started the battle

The pre-battle roster is still in memory when the payout happens:
`Party.m_preBattleCardIds`, a seven-slot `array<string>` written by
`Party@BackupCardIds` (27822) at `ProcessPreBattle` and only cleared by
`Party@RestoreCardIds` (27823) at `ProcessPostBattle`, which runs afterwards.

The cheapest form of this does not touch the payout at all — it moves the
rollback earlier:

```c
void SceneBattleResult@0(ref SceneStack stack)
{
    g_party.ProcessPostBattle();      // ← the one added call
    ...                               // the original body, unchanged
}
```

`SceneBattleResult@0` (FUNC 25418) is a thirty-instruction constructor that
calls `CalcResult`, `LoadActivity`, `InitCardView`, `InitResultView` and hangs
`OnClick` on the scene stack, so hand-assembling it with one call prepended is
small. Because `InitCardView` and `ShowExpUpEffect` are the only two places in
the whole of `SceneBattleResult` that read `g_party` — verified by grepping the
scene's function range for `g_party` — the display and the payout move together
and stay in sync automatically.

Calling `ProcessPostBattle` twice is safe: `RestoreCardIds` opens with an
`Array Empty` check and returns immediately the second time, having freed the
array on the first, and `IsFixStatus = false` is idempotent. The one behavioural
side effect is that `Party@RecalcStatus` becomes live again for the duration of
the result screen, so party total HP recomputes there — nothing on that screen
reads it. `BattleSceneSet@EraseLeaders` (27587), the chapter-3 permadeath pass in
`RunPostProcess`, already ran after the rollback in the original order and still
does.

What this deliberately accepts: a character swapped **in** mid-battle and left in
at the end is paid nothing, even if they did all the work. That is the trade —
the reward follows the roster you committed to before the fight.

This is a `.jam`, not a `.jaf`. `SceneBattleResult@0` is a method whose body is
almost entirely `PUSHSTRUCTPAGE`/`CALLMETHOD` against its own struct, and
alice-tools' `.jaf` `override` resolves neither `this` nor a struct's own
members — the same wall `patches/enemy_info_panel.jam` hit.

### B. Pay the union of the two rosters

Everyone who was in the party at the start **or** at the end. Strictly more
generous than A, and it removes the exploit's *advantage* without removing the
ability to swap for tactical reasons.

Both `m_preBattleCardIds` and the live slots are available at the same moment,
so the data is there — but the recipient list stops matching `m_cardView`, and
`ShowExpUpEffect` indexes that array positionally. So this needs `.jam` of both
`InitCardView` (25423) and `ShowExpUpEffect` (25426), or an accepted cosmetic
compromise where the animation only plays for the current party and the
off-screen characters are paid silently. The second is much less work and the
result screen already scrolls past quickly.

### C. Pay a share to the whole faction

Rance 10's party is one character per faction (`Party@SetCardIdAutoWithIndex`,
27793 — see `docs/party-total-hp.md`), and the faction collections are already
indexed: `g_playerCard.GetOrganization(orgId).GetOrganizable()` (28068) is the
same candidate filter `Party@Set` applies. So "every card of each represented
faction gets *N*% of the battle's experience" is expressible.

It is the largest balance change of the four — it makes the party's *factions*
the thing you level rather than its characters — and it is the one most likely
to run into the open question `docs/party-total-hp.md` already flagged: how much
of a loop over `ref PlayerCard` arrays the `.jaf` compiler will accept. The
helper would be a `.jaf` global function called from a `.jam` stub, with `--jaf`
passed before `--jam` as `scripts/ain.js` already does.

### D. Leave the battle alone and widen the existing catch-up

The design problem the exploit is a symptom of — the game wants every unit
levelled, and only the party gets paid — already has an answer built in: the
food ticket, worth `TotalExp / 2` to any character. Changing that divisor, or
the rate at which tickets are handed out
(`PlayerCommonParamEvent::AddFoodTicket`), addresses the shortage without
touching the battle path at all.

`SceneFoodTicket@RunApplyExpEffect` (24708) is a method that reads `m_cardIds`,
`m_selected`, `m_levelUpResult` and `m_selector` — struct members again, so
`.jam` — but the arithmetic being changed is a single `PUSH 2 / DIV`. This is by
far the smallest patch of the four, and it composes with any of the others.

It does not fix the exploit. It makes it less worth doing.

---

Whichever it is, verify against the built `.ain` rather than the patch, the way
the rest of this repository does, and build into a scratch `GAME_DIR` while
testing:

```
alice ain dump -c -o built.code <built>.ain
```
