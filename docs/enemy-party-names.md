# The name over the enemy's HP bar

Every fight puts a plate at each end of the screen: `ランス部隊` over your own HP
bar, and over the enemy's whatever the enemy is called — `ジャハルッカス`,
`魔物兵(25匹)`, `魔人ケイブリス(猛撃)`. The enemy half is what this is about. The
party half is `Party@Name::get`, four strings translated where they sit rather
than through an override, and it is [party-name.md](party-name.md).

```
npm run regenerate-enemy-party-names   # only after the .ain changes
npm run regenerate-ain                 # the build; generates build/enemy_party_names.jaf and applies it
```

| File | What it is |
|---|---|
| `game/extracted/enemy_party_names.v1.04.tsv` | the 231 Japanese names, and which slot each is in — generated |
| `glossaries/enemy_party_glossary.tsv` | the English, keyed by the Japanese — hand-written |
| `build/enemy_party_names.jaf` | the override the build compiles — generated, gitignored |

## Where the name comes from

One function names every enemy in the game. `Ｔ敵本体生成` takes a code name,
sets some thirty locals from it, and calls `Ｔ敵本` — 178 times, for 231 distinct
values of `▲名前`. That local becomes `Enemy@Id`, and five things draw it:

| Reader | What the player sees |
|---|---|
| `BattleHpBar@PartyName::get` | the plate over the bar |
| `SceneSimpleBattleInfo` | the name on the quick battle info panel |
| `SceneBattleInformation@Run` | the same on the full one |
| `BattleLog@EnemyName::get` | `<Enemy>'s <Skill>！` in the log, in red |
| `PlayerAction@StarterName::get` | who started an action, in the log |

Nothing compares it. The keys are the fields next to it: `コード名`
(`m55ジャハルッカス`) is what the fight is looked up by, `▲ＣＧ名` is what
`Enemy::ResolveFlat` builds the picture's name out of, and `▲盗み` is a card Id.
`Ｔ敵本体情報`, which the status panel calls with the name, ignores the argument
entirely and reads four globals instead — see
[enemy-status-lines.md](enemy-status-lines.md).

## Why the strings cannot simply be translated

A string slot is shared by everything that pushes it, and 45 of these 231 are
pushed somewhere other than `Ｔ敵本体生成`. For 14 of them that somewhere is a
key:

| Name | Slot | Also |
|---|---|---|
| `ジャハルッカス` | `s[10836]` | the card Id `Ｔカード箱` hands the card box |
| `アスタコ`, `アレキサンダー`, `冬将軍１９４２`, `ＰＧ` | | the same |
| `アームズ`, `カチューシャ`, `トッポス`, `バスワルド`, `ランスＪｒ`, `リック` | | the card box, and `Ｔ肩書き`'s compare |
| `機々械々` | `s[11955]` | `Ｔクリアボーナス` |
| `マエリータ隊` | `s[9610]` | a flag name `TadaFlags::Parse` reads back, and `難易度調整`'s compare |
| `黒部` | `s[10339]` | a flag name |

The rest of the 45 are display — a speaker's nameplate in `●台詞Ａ`, an admiral's
title on the war map (`Ｐ武将更新`'s `positionName`), a buff's own label in
`Ｔ支援状態生成`, the race in `表示種族` — but the fourteen above are enough:
translating `ジャハルッカス` where it sits would hand the card box a card Id no
table has.

So the build overrides `Enemy@Id::get` instead, the way
[card-name-localization.md](card-name-localization.md) overrides the card
accessors and [race-names.md](race-names.md) overrides `表示種族`. Every string
keeps its Japanese, nothing that compares text notices, and `super()` is the
fallback — an enemy the glossary does not know draws exactly what it drew before.

## The suffixes

`▲名前` does not reach `Enemy@Id` unchanged. `難易度調整` runs between the two
and appends:

- `+` where it strengthened an enemy the party had outgrown, `v` where it cut one
  down. Either can land twice, so `ジャハルッカス+` and `魔物兵vv` are real.
- `(25匹)` when `▲数` is more than one — a bracket, the number, and the counter
  word for what is being counted: `匹` for beasts, `名` for people, `体` for
  things.

The generated `.jaf` takes those off before the lookup and puts them back after
it. The count is the exception: `Monster Soldiers (25匹)` is worse than either
language alone and English has no counter word to put there, so it comes out as
`Monster Soldiers ×25`.

Nine of the game's own names end in a bracket of their own —
`魔人ケイブリス(猛撃)` is five different fights, one per battle preset — which is
why a count is recognised by its counter word rather than by the bracket.

## What moved out of the cherry picks

64 of these names were translated as strings in
`patches/system_cherry_picks.v1.04.ain.txt` before this existed. That reached the
ones whose slot was theirs alone and could not reach the rest, and it had drifted
in the usual ways: `Cyclops Type` for `サイクロ系` (the card is a Cycloknight),
`Return Devil` for `リターンデーモン`, `Daikon Squad` for a `ダイコン群生` the
synopsis calls a radish, `Miiran` where the card glossary says Myiran.

50 of them — the ones whose slot nothing else pushes — are out of that file and in
the glossary. The other 14 stay, because their slot is drawn somewhere else too
and the string still has to say it in English there; those spell it the way the
glossary does, so the plate and the nameplate cannot drift apart. The glossary
carries them all the same, so that removing a cherry pick later changes nothing.

## Width

Nothing clips and nothing wraps: `Name` in `HpBarEnemy.pactex.x` and
`HpBarPlayer.pactex.x` carries `表示領域 = 0,0,0,0`, so the label runs from where
it starts — left to right from x=15 for the enemy, right to left from x=1906 for
the party. What it can run across is the bar it labels, 867 pixels of
`シス／戦闘／敵ＨＰ下地` at font 32, and the game's own longest name,
`魔人レッドアイ（トッポス憑依）`, uses 531 of them. The build measures each entry
against the bar and names the ones over it; nothing is truncated, because an
overhanging name is still legible and shortening it is a judgement about wording.

## Adding to it

Put the Japanese and the English in `glossaries/enemy_party_glossary.tsv`. A name
left out stays Japanese in game, so a partial glossary is a working build.

Names are checked against `glossaries/mistranslated_names.json` as the file is
rendered, and the build says so when a name the Japanese carries is spelled some
other way in the English. That check is why `アスタコプロト` reads `Asutakoputo`
here and not `ASTACO Proto`: the table says so, and the table is where a name is
decided. The terms follow the dialogue rather than a fresh guess —
`node scripts/lookup_term.js 中隊 大隊 群生` is how they were settled: a Company,
a Battalion, a colony.

`闘将` is where that stopped working. The dialogue called it a fighting general
in 56 lines and a Fighting God in one, which was also its word for `闘神` — it
could not hold the two apart, so following it would have put a Holy Corpse
Fighting General over the HP bar of the boss the synopsis calls a Holy Corpse
Tousho, and a third General beside the Monster Generals and the Great General.
It is a Tousho on both, which is what `glossaries/summary_terms.tsv` and
`glossaries/card_name_glossary.tsv` already said. `闘神` is a Toushin for the
same reason and by the same table, so the pair reads apart now wherever it
appears.
