# The name on the Location plate

Every quest map draws a banner across the top: the word `Location` on the left,
and on the right whatever the party is standing in — `スルメ山`, `首都　ラングバウ`,
`戦場　セキガハラ`. The banner was half translated for years. The frame is a
picture and somebody redrew it; the name inside it is data and nobody touched it.

```
npm run regenerate-ex          # writes the English into the table on the way past
```

| File | What it is |
|---|---|
| `archives/Rance10EX_v1_04/5_クエストデータ.x` | the game's own table, 655 `地名` rows — never edited by hand |
| `glossaries/place_name_glossary.tsv` | the English, keyed by the Japanese — hand-written |
| `CG2-raw/シス／クエスト／地名.png` | the frame, with `Location` where `地名` was — see [image-archives.md](image-archives.md) |

## Where the name comes from

```
SceneQuestMap@UpdateMusicAndView          on entering a quest, and on every step
  QuestInformationPanel@PlaceName::set      writes the Place label of
                                            Game/Quest/QuestInformationpanel2
    QuestMapParamAccessor@PlaceName::get    reads the map param's 地名
```

and a map param's `地名` is the `地名 = "..."` of `5_クエストデータ.x`. There are
655 of them carrying 254 distinct names: at the quest, at a step inside it, and
inside a `選択分岐` branch, so the plate changes as a quest runs.

Nothing else reads the field. The whole `.ain` has two `S_PUSH "地名"` and both
are the getter above, which is what makes this display text rather than a key —
unlike the `背景`, `音楽`, `戦闘` and `物語` sitting beside it in the same node,
every one of which is a lookup.

## Why it was untranslated

The tables under `archives/Rance10EX_v1_04/` carry their English in the file
rather than in a glossary, and whoever went through this one did the `説明` —
1957 of 1961 — and walked past the `地名`. Nothing reported it either: the name
check does not run over the `.ex` tree and `scripts/find_untranslated.js` reads
the `.ain`.

Three rows were English, and they were the reason to build this as a glossary
rather than to keep editing the file. The `ホルスの宇宙戦艦` quest had its `地名`
translated to match its own name in `6_クエスト情報.x` — written **over** the
Japanese, so `巨大戦艦遺跡` was gone from the table and the row was keyed by
nothing. `巨大戦艦遺跡内`, the same place one word longer, sat next to it still in
Japanese. The three rows are restored and the English is in the glossary now.

Against an `alice ex dump` of an original v1.04 `Rance10EX.ex`, those three rows
were the only drift in the whole field: 655 rows and 254 names on both sides.

## `ランス城` is a sentinel, not a name

`QuestMapParamAccessor@PlaceName::get` does not simply return the field:

```
place = param.地名;
if (place == "ランス城") return RanceCastlePositionString;
return place;
```

and `RanceCastlePositionString` switches on `TadaFlagFunc::Get(1)` between
`ランス城空中`, `ＪＡＰＡＮ城`, `ランス砦` and `ランス城` — where the castle is at that
point in the game. So the 25 rows saying `ランス城` are not naming a place, they
are asking which of the four applies, and English in them answers that question
once and for the rest of the game.

Those 25 rows keep their Japanese. `modules/PlaceNames.js` knows the value and
skips it even if the glossary names it.

Which leaves the four literals, and they are a `.ain` job rather than an `.ex`
one — the plate is the only thing that shows them, but the strings are not the
plate's:

| Literal | Slot | Pushed | Safe to translate in place |
|---|---|---|---|
| `ランス城空中` | `s[4218]` | 2 | both are the two getters |
| `ＪＡＰＡＮ城` | `s[4219]` | 2 | both are the two getters |
| `ランス砦` | `s[2966]` | 19 | no — also a CG and quest key |
| `ランス城` | `s[2915]` | 157 | no — also a CG and quest key |

So the way to finish this is a `.jaf` override of
`QuestMapParamAccessor@PlaceName::get`, the same shape as `patches/card_names.jaf`
and the generated `build/race_names.jaf`: the strings keep their Japanese,
nothing that compares text notices, and `super()` falls back to the original.
Until that lands, a quest whose `地名` says `ランス砦` outright draws `Rance Fort`
while one going through the sentinel draws `ランス砦`.

## How wide the plate is

`Place` in `Game/Quest/QuestInformationpanel2.pactex.x` sits at x=230 of a
458-pixel frame with `原点座標モード 5`, the middle of the nine, so the name grows
both ways from the centre of the plate. It is drawn at `フォントサイズ 32` with
`字間隔 -1`.

The frame's left end is the label. In the game's own picture `地名` ends at
column 52; in ours `Location` ends at 79, so the English label costs about 54
pixels of the room a name has:

| | label ends at | a name may spend |
|---|---|---|
| `地名`, the game's | 52 | 344 pixels |
| `Location`, ours | 79 | 300 pixels |

Nothing clips and nothing wraps. 55 of the game's own 254 names are already past
that label — `国際共同都市　シャングリラ` covers `地名` completely — and the widest,
the joke name of the `ｖｓホーネット` quest, is 744 pixels against a 458-pixel
plate. So crossing the label is not by itself wrong, and the build reports two
numbers rather than shortening anything:

- **over the label**, which English crosses far more often than Japanese does —
  123 names against the game's 55, because English spends more width on the same
  meaning. This is a count, not a list;
- **wider than the plate**, which is the list somebody has to shorten by
  meaning. Five, and one of them is the joke name, which is narrower than the
  Japanese it replaces and therefore the game's own doing.

Measure with `placePixels` from `modules/PlaceNames.js`, which is
`gameTextWidth` with this layout's own tracking — see [text-width.md](text-width.md)
for the font and the two numbers that are not in it.
