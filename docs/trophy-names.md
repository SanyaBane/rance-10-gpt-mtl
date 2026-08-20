# The achievement names

The 実績 screen -- the trophy tab of Alice's mansion -- draws one string per row,
twenty-six rows to a page and five pages for the hundred and nine achievements
the game has. The same string is drawn again, at フォントサイズ 75, on the panel that
announces a newly earned one.

That string is the trophy's **Id**, and it is not text. This is the write-up of
what it is instead, where the English went, and how the row's two columns are
kept in line once the left one stops being Japanese.

## Three things at once

`TrophyPage@InitButtons` (FUNC 25925) sets the row button's text to `trophy.Id`;
`SceneTrophyDetail@0#1` (25740) writes the same `Id` into the panel's `Name`
label. Nothing else about it is display:

| Also | Where |
|---|---|
| the ex-tree key | `TrophyCollection@Create` reads `実績情報.<Id>.種類`, and `Bonus`, `IsHide` and `Desc` read `.ボーナス`, `.隠し表示`, `.説明` the same way |
| the scenario's handle | `Ｐ実績確認` (28902) and `Ｐ実績ＯＮ` (28903) take it as a string, from some two hundred call sites |
| the save key | `CompletedTrophy@Add` (28773) pushes a `TrophyInfo` carrying it and calls `CollectionSaveData::Save`; `IsExist` compares the stored strings |
| the list itself | `TrophyCollection@Ids::get` is `EX_GetNodeNameList("実績情報")`, so the node names *are* the screen |

The save is the one that cannot be worked around. Translate the Id in the table
and every trophy already earned in every existing save reads back as unearned,
which takes the clear points, the permanent stat bonuses and the route unlocks
with it. Two of the Ids are compared against literals in code as well --
`CompletedTrophy@Add` matches `達成(クリア時)　初クリア…` and
`達成(第２部クリア時)　全クリア` exactly, to light the new-content marks.

So the Id stays Japanese and the English goes in beside it, under `英名`, which is
the shape `patches/card_names.jaf` already uses for a card Id
(`docs/card-name-localization.md`). `patches/trophy_names.jaf` reads it back.

## The hook

There is no `Name` accessor to override: `Id` *is* the name, and overriding
`Id::get` would rewrite the lookups along with the label. Both display sites end
at the same place instead --

    TrophyPage@InitButtons -> TextButton@SetText -> Activity@GetLabel("Text") ->
    SceneTrophyDetail@0#1  -> Activity@GetLabel("Name") -> ActivityLabel@Text::set

-- so one override of `ActivityLabel@Text::set` covers both, where patching
either display function would mean reimplementing it (and the panel's is a
constructor).

That setter is every label in the game: 88 call sites. They are all view
construction, `SetParam` or an event handler -- the four named `Update` are
called from `Init`, `SceneSimpleBattle@PickCard`,
`SceneBattle@OnInsertionEnemyChanged` and `SceneResult@RunState` -- so none of
them runs per frame. The prefix test in the patch keeps the other 86 from paying
for the lookup at all: every Id begins with `クリア`, `達成` or `集結`. A label that
passes the test and is not a trophy resolves to nothing and comes back unchanged,
because the raw value is the `EX_String` default.

`alice-tools` compiles an `override` of a property setter and resolves `super()`
in it the same way it does the `::get` overrides already in the tree: the new
body takes the original function index and the original is copied to a new one at
the end. Note that `alice ain dump -c` then prints **two** functions with that
name -- the old body at its old place and the wrapper at the end -- which is what
the shipped `Character@Name::get` override looks like too. It is the dumper, not
a patch that failed to apply.

## The row is two columns

Fifty-seven of the hundred and nine Ids carry a `★` or `●` bonus flag, and every
one of them puts the marker at the **eighteenth full-width character**. The
padding that gets it there is one full-width space in one row and eleven in
another, chosen per row. On a page of twenty-six rows that column is the whole
reason the bonuses can be read down the page instead of hunted for at the end of
each line.

English is proportional, so the column cannot be reproduced by counting
characters. `modules/TrophyNames.js` measures the name with `gameTextWidth` and
fills the gap with ASCII spaces, which are about four tenths of a full-width
character -- close enough to land within half a character of the mark.

The budgets, in full-width characters, read off the Japanese rather than off the
plate:

| | Japanese uses | English gets |
|---|---|---|
| name, on a row with a tail | up to 16.8 | **18** |
| the tail | up to 10.0 | **10** |
| a row with no tail (52 of them) | up to 19.8 | **28** |

Eighteen is about thirty-four letters of English, which is tight: it is why the
names read `On Clear: ` rather than `Achieved (on Clear) - `. The prefix alone
was costing 11.5 of the 18.

Nothing clips and nothing shrinks to fit -- `TextButton@SetText` scales text down
only when `TextMaxWidth` is set, and that is initialised to `-1` and never
assigned anywhere -- so a name over budget runs out over the plate and stays
legible. The build says which ones rather than cutting them.

The plate itself is 792 pixels with the text inset 68, and a full-width glyph is
about 25 pixels at フォントサイズ 34 -- *not* the フォントサイズ, which is the mistake to
avoid when converting `gameTextWidth`'s units into pixels. That reading is what
`TRACK` in `modules/TrophyNames.js` rests on, and it is the one number here that
would be worth taking again with rulers if a name ever lands close enough to the
edge to matter.

## What must not be translated

- **The Id.** Above.
- **The `ボーナス` column.** It looks like the same words as the `★` tail and is
  not text at all: `CompletedTrophy@CalcStatus` and `ClearPoint::get` run
  `String.Contains` over it for `ＣＰ`, `物理倍率`, `魔法倍率`, `異常レジスト`,
  `自動戦闘倍率` and `割り込み発動`, and every achievement bonus in the game is
  decided by that. Translating it switches them all off silently. The tail the
  player reads is a *different* string -- the Id says `★割り込み発生率＋１` where the
  data says `割り込み発動＋１` -- and that one is in
  `glossaries/trophy_bonus_glossary.tsv`.

## What the descriptions were

The `説明` column had been translated with the English title repeated as its
first line, and the panel drew that under the Japanese name. The Japanese
original has a category there instead -- `正史ルート`, `未完`, `バッド` -- which the
translation had already folded into the second line ("Main story route. …"). With
the name in English above it the repeat is just the title twice in two spellings,
so it is gone; the description is the one line it always was.

Those first lines were also where the wrong names lived, and they had spread into
the second lines. Read against the Japanese the game ships, `魔人` and `魔王` had
both come out as "Demon Lord", `魔軍` as "demon army", `リーザス` as "Rizeas",
`ハウゼル` as "Hausel", `レイ` as "Ray", and `松下姫` as "Princess Matsushita" -- against
Fiend, Demon King, Monster Army, Leazas, Hawzel, Lei and Princess Panasonic in
`glossaries/`. Thirteen replacements, each one read against the Japanese, because
nothing but the Japanese separates a `魔人` from a `魔王` once both say "Demon Lord".

One conflict is left alone: `サイゼル` is "Seizel" in
`glossaries/mistranslated_names.json` and "Saizel" in
`glossaries/card_name_glossary.tsv`. The description keeps the card spelling,
since that is what the player has been reading on the card itself.

## Testing it

Ninety-three of the hundred and nine show their name in the list whether or not
they have been earned; the other sixteen draw `？？？` until they are
(`隠し表示 = 1`, and they are the second-part ones -- `全クリア`, `？？解放条件全達成`
and the fourteen `親友は…`). So the list is where to check the English, not the
panel: it is also the tighter of the two, since the panel has about thirty-six
full-width characters to the row's twenty-nine.

Both halves have to be built for anything to change. `npm run regenerate-ex`
writes the `英名` values in and `npm run regenerate-ain` applies the patch that
reads them; either alone leaves the screen exactly as it was.
