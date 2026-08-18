# The party's Total HP

The number under the party's health bar is one field, `PartyStatus.m_totalHp`,
written in one place and read by everything else. It is a snapshot: it is
computed from the characters standing in the party's slots, and then frozen for
the duration of a battle even though the party can be rearranged mid-battle.
This is a read of how it is assembled, written while working out whether the
formula can be replaced; nothing here is patched yet.

Everything below is in `Rance10.ain`. Nothing about party HP lives in the `.ex`
tables or the `.pactex`.

## Where to look

Function ids are properties of the `.ain` and are the stable way to find any of
this again; line numbers are from a code dump, which is regenerable but
gitignored:

```
alice ain dump -c -o local/Rance10.v1.04.code.jam game/ain/Rance10.v1.04.ain
```

A method call is `PUSH <function id>` followed by `CALLMETHOD <argc>`, so reading
the dump means resolving ids to names, and the dump carries both — a name comment
above every `FUNC n`. `docs/treasure-chest-chance.md` has the `awk` one-liner
that builds the table; everything named here was found that way, plus a reverse
pass over `PUSH <id>` to find each function's callers.

## Where the number lives

There is exactly one writer and one chain of readers:

```
Party@TotalHp::get                (FUNC 27808, and ::get#1 27809)
  └─ PartyStatus@TotalHp::get     (FUNC 27920) → PartyStatus.m_totalHp
        └─ written only by PartyStatus@CalcTotalHp   (FUNC 27914)
              └─ called only by PartyStatus@Update   (FUNC 27913)
                    └─ called only by Party@RecalcStatus (FUNC 27804)
```

Everything that shows or uses the party's maximum HP goes through
`Party@TotalHp::get`:

| Caller | What it is |
|---|---|
| `BattlePlayer@HpMax::get` (FUNC 26643) | the battle HP gauge |
| `QuestMapHpView@SetValue` / `@MoveHp` (FUNC 23533/23534) | the bar on the quest map |
| `PartyCommonParamView@SetBaseValue` / `@SetAlteredValue` (FUNC 24359/24358) | the party screen readout, and its hover preview |
| `SceneQuestSceneSet@ResetParm` (FUNC 23654) | full heal on entering and leaving a quest |
| `Party@Hp::set` (FUNC 27812) | clamps current HP to it |
| `Party@HpRatio::get` (FUNC 27813) | current HP as a fraction |
| `部隊総合ＨＰ取得` (FUNC 29010) | the scenario scripts' handle on it |

So one change at `CalcTotalHp` moves every one of these together, and nothing
else has to be touched to keep them consistent.

## The formula

`Party@RecalcStatus`, `PartyStatus@Update` and `PartyStatus@CalcTotalHp`,
reconstructed:

```c
void Party@RecalcStatus()
{
    if (IsFixStatus)                       // set for the length of a battle
        return;

    m_status.Update(m_leaders);
    m_hp = (int)(m_hpRatio * TotalHp);     // keep the percentage, not the number
    if (m_hp == 0)
        m_hp = 1;
}

void PartyStatus@Update(ref LeaderCardCollection leaders)
{
    leaders.UpdateStatus();                // per-slot LeaderCard.m_hp, m_status
    CalcTotalStatus(leaders);              // sum the slots' CommonStatus
    CalcStatusPartyBonus();                // party bonuses on top
    CalcTrophyBonus();                     // trophies on top
    CalcTotalHp(leaders);                  // and only then the HP
}

void PartyStatus@CalcTotalHp(ref LeaderCardCollection leaders)
{
    int hp = 0;
    for (t in leaders.GetAvailableInstance())     // occupied slots only
        hp += t.Hp;

    float ratio = (m_status.PerHpUp + 100) / 100.0;
    m_totalHp = (int)(hp * ratio);
}
```

`GetAvailableInstance` (FUNC 27162) filters on `LeaderCard@IsExist`, so the loop
is over the slots that actually hold a card — one to seven of them — and the
count of them is already part of the original formula.

`PerHpUp` (`CommonStatus@PerHpUp::get`, FUNC 26013) is read off the aggregate
`CommonStatus` that `CalcTotalStatus` (FUNC 27915) has just built by summing the
occupied slots' own `CommonStatus`, with the party bonus and trophy passes added
after. It is a percentage and it does depend on who is in the party — the skills
they carry are in that sum.

## What one slot is worth

`LeaderCard@UpdateStatus` (FUNC 27130) is where a slot's `Hp` comes from, and it
is mostly not about the character in it:

```c
void LeaderCard@UpdateStatus()
{
    if (!IsExist())
        return;

    ref OrganizationCardCollection c = g_playerCard.GetOrganization(OrganizationId);
    float r = g_playerCard.LeaderRatio - 1.0;

    m_hp = (int)(c.GetHp() + CardInstance.GetTotalHp() * r);

    m_status.Clear();
    m_status.Add(c.GetStatus());
    m_status.Atk = (int)(m_status.Atk + CardInstance.GetTotalAtk() * r);
}
```

`c.GetHp()` (FUNC 28080) is the **faction's** pooled HP: `RecalcStatus`
(FUNC 28082) sums `GetTotalHp()` over every card of that faction that
`GetStatusAvailableCards` (FUNC 28074) lets through — the filter there is only
"not an NG card" — and caches it behind `m_isChanged`. Every card you own of a
faction contributes to it whether or not it is in the party.

`LeaderRatio` (FUNC 28192) starts at **5** — `PlayerCardCollection@0`
(FUNC 37503) assigns it — so `r` is 4.0 unless something raises it.
`PlayerCardCollection@CalcLeaderRatio` (FUNC 28195) runs on every `Add` and does
`LeaderRatio = Math.Max(LeaderRatio, max skill-effect-142 value on the card)`, so
it is a property of the whole collection rather than of a card, and it only ever
grows.

A slot is therefore worth `faction pool + that character's own HP × 4`. The
faction term is identical for any character of that faction; only the second term
distinguishes them, and that is what the party screen's hover preview moves.

## One card per faction, four to seven slots

`PlayerCardCollection@0` allocates `m_org` at **10** — the ten organizations
`Party::OrganizationIdFromString` (FUNC 27830) names: 主人公, リーザス, ヘルマン,
ゼス, 自由都市, ＪＡＰＡＮ, その他, 亜人, モンスター, 神魔.

One card per faction is enforced rather than merely conventional.
`Party@SetCardIdAutoWithIndex` (FUNC 27793) looks the incoming card's faction up
with `FindIndexFromOrganizationId` and **unsets** whoever of that faction is
already in the party before placing it.

The slot count is not fixed at seven: `PartyBonusSwitcher@GetLeaderCount`
(FUNC 27867) returns `4 + the number of enabled leader-count party bonuses`, and
`Party@SetAvailableCount` (FUNC 27794) is fed from it, so it runs 4 to 7 over the
game. Slots may also be left empty, so the party in play is one to seven
characters from one to seven distinct factions.

## Why it does not move during a battle

`Party@RecalcStatus` returns early while `IsFixStatus` is set, and that flag is
set for exactly the length of a battle:

| | |
|---|---|
| `Party@ProcessPreBattle` (FUNC 27820) | `BackupCardIds()`, then `IsFixStatus = true` |
| `Party@ProcessPostBattle` (FUNC 27821) | `IsFixStatus = false`, then `RestoreCardIds()` |

`ProcessPreBattle` is called from `BattleScenes::RunBattleInformation` and the
lambda behind `RunSimpleBattleInformation`; `ProcessPostBattle` from
`BattleSceneSet@RunPostProcess`, which also calls `RecalcStatus` right after, so
the number is correct again the moment the battle ends. `BackupCardIds`/
`RestoreCardIds` (FUNC 27822/27823) put the pre-battle party back, which is the
other half of the same design: the party can be rearranged in battle and the
rearrangement is temporary.

Swapping in battle goes through the ordinary path — `FormationViewGroup@SetCard`
(FUNC 24115) → `Party@Set` (FUNC 27787) or `Party@Unset` (FUNC 27788) →
`Party@RecalcStatus` — and that call is the one the flag turns into a no-op.

**The consequence.** Total HP is decided by whoever is standing in the slots at
the moment the battle starts, and cannot be changed afterwards. Entering with the
highest-HP characters available, letting the snapshot be taken, and then swapping
to the party you actually want to fight with — which
`PartyChangeRound` (FUNC 26684-26698) allows from round two — keeps the higher
number for the whole battle. Nothing in the code guards against it.

## Total HP is not a cosmetic number

Two places outside the UI read it, both through `部隊総合ＨＰ取得`:

**`難易度調整` (FUNC 35788), the "too weak" correction.** For a non-boss enemy
(`▲ボス == 0`) it computes `bb = 部隊総合ＨＰ取得() / ▲攻撃力` — the party's total
HP over the enemy's attack — and then:

```c
if (bb > 100) {                                  // 弱すぎ補正, name gets "+"
    ▲攻撃力 = 倍率計算関数(▲攻撃力, 200);
    ▲体力   = 倍率計算関数(▲体力,   150);
    ▲経験値 = 倍率計算関数(▲経験値, 110);
}
// bb recomputed, twice, each an independent roll, name gets "v"
if (bb > 60 && RAND(5) == 1)
    ▲攻撃力 = 倍率計算関数(▲攻撃力, 150);
```

`倍率計算関数` (FUNC 35764) is `min(value * percent / 100, 2e9)`, returning the
value unchanged at 100 and 0 for a negative input. So raising the party's total
HP pushes ordinary enemies over these thresholds more often and makes them hit
harder — the effect is stepped, not proportional.

**`Ｔ敵本体生成` (FUNC 35783)** keeps high-water marks
`tt[339] = max(tt[339], 部隊総合ＨＰ取得())` and
`tt[338] = max(tt[338], 部隊総合ＡＴ取得())`, and at least one scripted enemy —
behind the `★２部解放` achievement — is generated with
`▲体力 = tt[339] / 45` and `▲攻撃力 = 最強のリーダーＡＴ取得() * 25`.

The attack half of that pair is dead: `tt[338]` is read nowhere except in its own
`max`. And the party's summed ATK is not what damage is computed from either.
`PlayerAttackDamageCalculator@CardAtk::get` (FUNC 26958) takes
`action.Leader.Status.Atk` — the acting character's own `LeaderCard.m_status`,
which by `UpdateStatus` above is *that character's faction's* ATK plus their own
ATK × 4. The party total ATK on the party screen is a readout, and `陣営総合ＡＴ`
is what actually matters. Party total *HP*, by contrast, is the real thing.

## The change we settled on

Not implemented yet; recorded so the next session does not re-derive it.

The abuse above is possible because the snapshot depends on *which characters*
are in the slots. Removing that dependency without removing the party's influence
altogether:

```c
int BestOf(int orgId)                    // the best a faction could ever field
{
    ref OrganizationCardCollection o = g_playerCard.GetOrganization(orgId);
    int best = max over o.GetOrganizable() of c.GetTotalHp();     // 0 if empty
    return (int)(o.GetHp() + best * (g_playerCard.LeaderRatio - 1.0));
}

void PartyStatus@CalcTotalHp(ref LeaderCardCollection leaders)
{
    int N  = leaders.GetAvailableInstance().Numof();   // occupied slots, 1..7
    int hp = sum of the N largest of BestOf(1) .. BestOf(10);

    m_totalHp = (int)(hp * (m_status.PerHpUp + 100) / 100.0);
}
```

Total HP then depends only on **how many** slots are filled, not on which
factions or which characters fill them — so neither swapping within a faction nor
swapping factions can move it, and the intra-battle snapshot has nothing left to
capture. `PerHpUp` still comes from the characters actually in the party, so
composition keeps a real if smaller influence.

`GetOrganizable` (FUNC 28068) is the right candidate filter: it is
`isOrganizableCard` (FUNC 28875), the same test `Party@Set` applies — not an NG
card, not an item, and 神魔 only while party bonus 4 is on.

Two things this deliberately accepts:

- **It only ever raises HP.** The result is what the party would have had if it
  always fielded the best character of each chosen faction, so it is a buff
  wherever the player is not already doing that — and, per `難易度調整` above,
  partly self-correcting by making trash enemies stronger.
- **The number of occupied slots is still a lever.** Entering with seven and
  emptying slots afterwards is possible, and keeps the seven-slot HP. It is not
  worth doing: the game rewards rotating between characters — every round
  `LeaderCardCollection@UpdateSkillNotUsedRound` (FUNC 27152) advances a
  not-used-this-round counter per card — so thinning the party to hold a stale HP
  number costs more than it gains.

### How it would be patched

Same split as `patches/enemy_info_panel.{jaf,jam}`, and for the same reason:
`CalcTotalHp` has to write `this.m_totalHp`, and alice-tools' `.jaf` `override`
resolves neither `this` nor a struct's own members. So the logic goes in a `.jaf`
global function and a `.jam` replaces the body of FUNC 27914 with a `CALLFUNC` to
it plus the assignment — six instructions if the `.jaf` returns the finished
number, or the original's ratio tail kept verbatim if it returns only the sum,
which avoids depending on `g_party.Status.PerHpUp` resolving in `.jaf`. The
`--jaf` must be passed before the `--jam`, as `scripts/ain.js` already does for
the enemy panel, or the assembler cannot resolve the name.

The open risk is how much of a loop over `ref PlayerCard` arrays alice-tools'
`.jaf` compiler accepts — everything this repository has compiled so far is
`if`/`return` over strings. If it will not take it, the top-N selection can be
written without arrays (sum of all ten minus three passes finding the minimum),
and in the worst case the whole helper can be hand-assembled.

Verify against the built `.ain` rather than the patch, the way the rest of this
repository does, and build into a scratch `GAME_DIR` while testing.
