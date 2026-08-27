# A card's base HP and ATK, and what rank does to them

Every card the game shows you carries two numbers, `ＨＰ` and `ＡＴ`, and neither
is written down anywhere the player can see. What is on the card is the number
*after* the character's rank has been applied. Two characters standing at the
same rank with wildly different figures look like two different growth curves,
and they are not: there is one curve in the game, and the only thing that tells
two cards apart is a column in a table.

This is the read behind `features/base-stats-on-card`, which puts that column on
the card in brackets — times five, for the reason under "Which number to show"
below.

## Where the base is

`archives/Rance10EX_v1_04/8_カードデータ.x`, one row per card, columns `ＨＰ` and
`ＡＴＫ`:

```
{ "Lv50 パステル", "パステル", "パステル／基本", 8, 4, 2, 1088, 1054, 30, 50, 0, ... }
                                                所属 属性 性別  skills  ＨＰ ＡＴＫ
```

997 rows are not marked `削除`: 819 character cards and 178 items.

`PlayerCard@Hp::get` (FUNC 28091) and `@Atk::get` (28093) are that column and
nothing else — both are one `EX_SA2Int` through `PlayerCard@GetInt`.

## Where the rank is

Not on the card. `PlayerCard@GetStar` (FUNC 28156) ends at
`Character.m_star`, so the rank belongs to the **character** — the `識別名` the
card is filed under — and every card of that character shares it. Ranking up
Pastel ranks up all five Pastel cards at once.

A character is constructed at `m_star = 0` (`Character@2`, FUNC 27952), so ★0
is the floor rather than ★1. The ceiling is `ランク上限` from
`archives/Rance10EX_v1_04/12_ランク上限.x`, which is **200**;
`Character@IsMaxStar` compares against it and `Character@AddStar` refuses past
it. The experience one rank costs is
`Character::CalcNextExp` (FUNC 27972) = `min(99999, 100 * 1.1^star)`, which
reaches the cap around ★73.

Item cards do not use a character's rank. `PlayerCard@GetStar` sends them to
`PlayerCommonParam@GetAlteredItemStar` (FUNC 26289) instead — one global item
rank, doubled while `m_itemStarUp` is set.

## The formula

`PlayerCard@CalcTotalHp` (FUNC 28154) and `@CalcTotalAtk` (28153) are the same
function twice over, once per column:

```c
int CalcTotalHp(int star)
{
    int baseHp = Hp;                                        // the table column
    baseHp += (Character::GetStarRankFromStar(star) - 1) * 10;
    int r = baseHp * (5 + star);
    return (int)(r + r * 0.1 * (m_count - 1));
}
```

`Character::GetStarRankFromStar` (FUNC 27969) is a tier, not a scale:

| ★ | tier | flat bonus to the base |
|---|---|---|
| 0–9 | 1 | +0 |
| 10–19 | 2 | +10 |
| 20–39 | 3 | +20 |
| 40–79 | 4 | +30 |
| 80–159 | 5 | +40 |
| 160–200 | 6 | +50 |

`m_count` is how many copies of the card you hold. `PlayerCard@Count::set`
clamps it to `PlayerCard::GetMaxCount` = `重ね上限` + 1 = **11**
(`archives/Rance10EX_v1_04/38_重ね上限.x`), so a full stack is exactly ×2.0.

`@GetTotalHp` / `@GetTotalAtk` (28150 / 28149) are the cached readers; the cache
is invalidated by `m_lastStar` and `m_lastCount` in `@RecalcHpAndAtk` (28151).

Checked against two screenshots. Lv50 パステル is 30 / 50 in the table, and at ★8
with one copy the card reads 390 and 650: `30 × 13 = 390`, `50 × 13 = 650`.
Lv35 シィル is 30 / 35, and at ★0 the card reads 150 and 175 — which is the other
half of the check, because ★0 is where the multiplier is at its floor and the
floor is **five**, not one.

## What follows from it

**The progression is identical for every card.** There is no per-card growth
column, no per-character curve, nothing conditional. The multiplier `(5 + ★)` is
the same for the weakest card in the game and the strongest, so the ordering of
two cards never changes with rank and the table column *is* the growth
potential.

**But the flat tier bonus compresses the gap, hard.** It is added to the base,
not scaled, so a low-base card gains proportionally more from it:

| ★ | ×  | base 10 → | base 50 → | base 100 → |
|---|---|---|---|---|
| 0 | 5 | 50 | 250 | 500 |
| 9 | 14 | 140 | 700 | 1400 |
| 20 | 25 | 750 | 1750 | 3000 |
| 50 | 55 | 2200 | 4400 | 7150 |
| 80 | 85 | 4250 | 7650 | 11900 |
| 200 | 205 | 12300 | 20500 | 30750 |

Five times the base is 1.67 times the total by ★200.

## Which number to show

`features/base-stats-on-card` puts `base × 5` in the brackets rather than the
column itself, and the reason is legibility rather than arithmetic. Any constant
multiple of the column ranks the cards identically, so nothing about *who to
invest in* turns on the choice; what turns on it is whether the number needs
explaining.

The column alone does. It is a coefficient — the game displays it at no rank,
ever, so a card at ★0 reading `(30) 150` invites exactly one question, and it
was the first question asked of the first build. `base × 5` is `(5 + star)` at
star 0 with the tier bonus still at zero, which makes it a state the card really
passes through: at ★0 the row reads `(150) 150`, and the bracket says what it is
without a word of documentation.

It costs one digit, and it makes the bracket-to-live ratio mean something —
`150 → 3300` is "twenty-two times grown", where `30 → 3300` is 110 and folds the
×5 floor into a figure about nothing.

What is given up is that the bracketed number is no longer greppable: `150` is
in no table, and cross-referencing a card against `8_カードデータ.x` by eye means
dividing first.

The median character card is 35 HP / 40 ATK. The top of the table is the handful
of story-scale cards: `１級魔神 ネプラカス` 1600/3000, `１級神 ＡＬＩＣＥ` 3000/2500,
`魔王ランス(制限)` 1500/2000, `２級神 バスワルド` 2200/1900.

## What the card still does not tell you

**The displayed number is the real one.** `PlayerAttackDamageCalculator@CardAtk`
(FUNC 26958) reads `GetTotalAtk`, and `OrganizationCardCollection@RecalcStatus`
(28082) sums both columns over a faction's cards, so nothing is scaled again
behind the screen.

**`割り込みバトル倍率` is invisible and is not small.** `PlayerCard@InsertionAtkRatio`
(FUNC 28125) turns that column into the multiplier a card fights an interrupt
battle at: 0 → ×0.5, 1 → ×1.0, 2 → ×2.0. Of the 819 character cards, 112 are at
half, 631 at one and 76 at double — the whole Rance line among them. Two cards
with the same base ATK can be a factor of four apart there, and no screen says
so.

**`必殺連撃効果`** decides whether the card's attack draws its effect
(`@IsEnableAttackEffect`, 28123), which is cosmetic.

## Where it is drawn

`CardConstructProcessCacheBackCard` builds the card back in two halves, and the
split is worth knowing before patching either:

| | |
|---|---|
| `@Create` (FUNC 23037) | the frame, the art, the element/faction/name text. Cached in `m_proc` under the **card Id**, so anything here is per-card and drawn once. |
| `@CreateStatus` (FUNC 23038) | the copy count, the ★, and the two live numbers. Not cached — it runs on every draw. |

`@Get` (23036) is `m_proc[id]` ++ `CreateStatus()` ++ `CreateSkill()`.

The canvas is 208×312 (`ConstructProcess::CreateBase`). Positions, all from the
two functions above:

| | at | anchor |
|---|---|---|
| element icon | 9, 9 | CG |
| element name | 84, 41 | centre / middle, size 25 |
| copy-count plate | 109, 23 | CG |
| copy count | 196, 51 | right / bottom, digits 15×19 |
| ★ tier plate | 6, 57 | CG |
| ★ | 196, 81 | right / bottom |
| faction name | 198, 86 | right / top, size 25 |
| HP | 196, 134 | right / bottom |
| ATK | 196, 160 | right / bottom |
| skills | 194 + 39·i | |
| card name | 105, 289 | centre / middle |

The `origin` argument of `ConstructProcess::BlendText` (23076) and
`BlendNumber` (23078) is a numpad: **1,4,7** left / **2,5,8** centre / **3,6,9**
right for x, and **1,2,3** bottom / **4,5,6** middle / **7,8,9** top for y. It
reads backwards from the two switch tables, which adjust local 3 — `y` — before
local 2 — `x` — and it is easy to get the wrong way round.

The overlay CG `シス／カード／詳細` draws the `HP` and `AT` labels at x 16..44,
banding the two rows y 112..138 and y 138..165. That, and the numbers being
right-aligned at x=196, is the whole of the room a caption has to fit in.

The front of the card and the 統合部隊DATA face are different classes with
caches of their own — `CardConstructProcessCacheFront` and
`CardConstructProcessCacheBackCardListInfo` — and neither shows HP or ATK at
all, so a patch here reaches exactly one face.
