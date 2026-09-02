# The party bonus icons, and the name that is also a file name

The party bonus screen draws sixteen buttons, each an icon with a name beside it
and a short description under that. The names were translated years ago, in
`patches/system_cherry_picks.v1.04.ain.txt`, and every icon has been blank ever
since — because the name is what the icon is filed under.

```
npm run regenerate-ain          # generates build/party_bonus_icons.jaf and applies it
```

| File | What it is |
|---|---|
| `patches/system_cherry_picks.v1.04.ain.txt` | the English names, `s[4020]`–`s[4035]` — hand-written |
| `archives/Rance10CG2_manifest.txt` | which icons the archive actually holds |
| `build/party_bonus_icons.jaf` | the override the build compiles — generated, gitignored |

## What the button does with the name

`PartyBonusButton@InitParts` (FUNC 24325) fills the three parts of
`Game/Party/PartyBonusButton`:

```
Icon.SetCg("シス／部隊ボーナス／アイコン／%s" % PartyBonus@GetIconSubName())
Name.SetText(PartyBonus@GetName())
Desc.SetText(PartyBonus@GetDesc())
```

`GetIconSubName` (27851) has one case of its own — type 5 answers `s[4039]`
`全アイテム強化`, because that bonus is called `全アイテム★強化` and no file name
carries a ★ — and everything else falls through to `GetName()`, whose sixteen
slots are `s[4020]`–`s[4035]`. So the same string is a label on the button and
half of a CG name, and `archives/Rance10CG2_manifest.txt` proves the second
half: it lists `シス／部隊ボーナス／アイコン／リーダー枠追加.ajp` and fourteen more,
filed under exactly the words `GetName` returns.

With the slots translated the button asks for
`シス／部隊ボーナス／アイコン／Add Leader Slot`, which no archive has.

## Why the table is keyed on the English

The obvious override is on the type: `switch (Type) { case 0: return
"リーダー枠追加"; … }`. It cannot be written in a `.jaf` — the compiler cannot read
a struct's properties, which is the same reason `patches/lp_date.jam` exists
rather than a `.jaf` for `GameYear@ToString`.

What a `.jaf` *can* do is take what the original returned:

```
override string PartyBonus@GetIconSubName(void)
{
	return PartyBonusIconName(super());
}
```

`super()` is the original function, so the type 5 case and the empty-name
fallback (`s[4040]` `部隊強化`) stay where they are, and both of those come back
in Japanese already — the map does not know them and passes them through
unchanged. What it does know is the fifteen English labels, which it turns back
into the Japanese the icon is filed under.

That leaves one coupling: the map's keys are whatever the cherry-picks say
today. So the map is **generated from that file** rather than written beside it
— `modules/PartyBonusIcons.js` pairs each of the sixteen slots with the Japanese
of the same slot out of the committed dump, and a name edited in the
cherry-picks cannot go stale here. That is the difference from
`glossaries/enemy_party_glossary.tsv`, whose rows for a slot the cherry-picks
have already translated are dead and have to be kept agreed by hand.

The build checks two things it cannot decide:

- a Japanese name `archives/Rance10CG2_manifest.txt` has no `.ajp` for, which
  would be a button with no icon whatever this patch did;
- two bonuses under one English label, which would give one of them the other's
  icon.

## The type table

The engine names the sixteen itself, in `PartyBonusType@String` (FUNC 36320),
and that is what settles the labels rather than a reading of the Japanese.

| Type | Enum | Japanese | `GetDesc` |
|---:|---|---|---|
| 0 | `AddLeader` | `リーダー枠追加` | `＋%D` |
| 1 | `ApMaxUp` | `ＡＰ最大値強化` | `６→１０` |
| 2 | `ApHealUp` | `ＡＰ回復強化` | `偶数ターン＋１` |
| 3 | `ChangeLeader` | `リーダー入れ替え` | — |
| 4 | `Jinma` | `神魔枠解禁` | — |
| 5 | `ItemStar2Times` | `全アイテム★強化` | — |
| 6 | `TreasureLuckUp` | `レア運強化` | — |
| 7 | `HannyZippo` | `ハニージッポ` | — |
| 8 | `BoostPer` | `ブースト確率` | `＋%D％` |
| 9 | `OverkillEnable` | `全滅追い打ち` | — |
| 10 | `StatusHpPerUp` | `ＨＰ倍率強化` | `＋%D％` |
| 11 | `StatusAtkPhysicalUp` | `物理倍率強化` | `＋%D％` |
| 12 | `StatusAtkMagicalUp` | `魔法倍率強化` | `＋%D％` |
| 13 | `StatusExpUp` | `ＥＸＰ強化` | `＋%D％` |
| 14 | `StatusAllPerUp` | `全体強化` | `＋%D％` |
| 15 | `StatusMaxUp` | `上限解禁` | `＋%D％` |

Two of those answer a question the Japanese alone leaves open. `６→１０` is the
description of `ＡＰ最大値強化`, so it is the AP bar rather than a rank; and
`上限解禁` is `StatusMaxUp`, so `解禁` lifts a stat cap rather than imposing one.

## What is not translatable here

`s[4039]` `全アイテム強化` and `s[4040]` `部隊強化` look like two more names and are
neither: they are the only two strings `GetIconSubName` returns without asking
`GetName`, and both of them go straight into the CG name. The cherry-picks carry
a note by them saying so.
