# The name over your own HP bar

Every fight puts a plate at each end of the screen. The enemy's end is
[enemy-party-names.md](enemy-party-names.md); this is yours -- `ランス部隊` at
the start of the game, and the three names it becomes as the story moves on.

There is no command and no glossary. Four strings in
`patches/system_cherry_picks.v1.04.ain.txt`, and `npm run regenerate-ain` applies
them with the rest of that file.

## The four names

`Party@Name::get` is a switch on `TadaFlagFunc::Get(2)` -- the global `tt[2]` --
and four `S_PUSH`es. Nothing else is in the function.

| `tt[2]` | Slot | Japanese | English | Set by |
|---|---|---|---|---|
| 0 | `s[4007]` | `ランス部隊` | Rance Squad | the initial value: the first part, before the party is named |
| 1 | `s[4008]` | `魔人討伐隊` | Fiend Extermination Squad | `ＴターントップフェイズＢ`, at the event `反撃作戦開始` |
| 2 | `s[4009]` | `魔王討伐隊` | Demon King Extermination Squad | `Ｔ初期化２`, the second part |
| 3 | `s[4010]` | `統合部隊` | Combined Squad | `Ｔ初期化３`, the third |

The Japanese keeps `隊` on all four and swaps one word in the middle -- `部隊` at
the ends, `討伐隊` between them -- so the English does the same. That is the whole
of why `統合部隊` is a Squad rather than a Force: it is the word `ランス部隊` ends
in, and a series should read as a series. The event that names the party on
screen is `m[72642]`/`m[72643]`, and it says what the plate says.

`魔王討伐隊` is not only yours. Parties raised against the Demon King are a
numbered series in this world -- the dialogue has a `第17次魔王討伐隊`, and Tiger's
East Helman unit introduces itself as one -- so all seven dialogue lines carrying
the word are about somebody else's squad, and they spell it the way the plate
does on purpose.

## Where else each string is drawn

| Reader | What the player sees |
|---|---|
| `BattleHpBar@PartyName::get` | the plate over your own bar, via `BattleHpBar@UpdatePartyName` setting the `Name` label |
| `BattlePlayer@Name::get` | nothing directly -- it feeds the next one |
| `BattleLog@PartyName::get` | the `<Party>` token in a battle-log line, wrapped in `{128,200,255}%s{}` |
| `Ｔ武将計算` and `AdmiralView` | `s[4008]` only: the army's name on the war map |

That last one is why this is four translated strings rather than an override of
`Party@Name::get`, the way the enemy half of the same plate is an override of
`Enemy@Id::get`. An override is what a **key** needs -- `ジャハルッカス` is a card
Id, `モンスター` is what `Party::OrganizationIdFromString` compares against -- and
none of these four is compared by anything. Meanwhile `Ｔ武将計算` pushes `s[4008]`
straight into its own `▲Ａ`, which `＞武将更新` hands to `Ｐ武将更新` as
`positionName` and `AdmiralView@InitParts` writes into the `Title` label, beside
`Leazas 1st Army` and `Free Cities Alliance`. `Party@Name::get` is nowhere on that
path. An override would translate the plate, leave the war map Japanese, and
still need the string written out -- which is two sources for one slot, and
alice-tools applies the last one it reads without saying so.

Checking that is `alice ain dump -t`, which groups every string under the function
that pushes it: `s[4007]`, `s[4009]` and `s[4010]` appear under `Party@Name::get`
and nowhere else, `s[4008]` under that and `Ｔ武将計算`, and no `S_EQUALE` or
`String.Contains` follows any of the seventeen pushes.

Three more strings say one of the names inside a longer sentence, in slots of
their own, and they are in the same file so they cannot drift apart from it:
`s[14926]` (the war-map situation report), `s[10623]` (Rance's own title on the
dialogue name plate) and `s[10975]` (the title East Helman's Defenders carry).

## Width

Nothing clips and nothing wraps. `Name` in `HpBarPlayer.pactex.x` carries
`表示領域 = 0,0,0,0` and is drawn right to left from x=1906 at font 32; the bar
under it, `シス／戦闘／味方ＨＰ下地`, starts at x=1042. So a name has 864 pixels
before it runs off the end of the thing it labels, and the longest of the four --
`Demon King Extermination Squad` -- uses 488 of them. The game's own longest enemy
name is 435 by the same measure. Width decided nothing here.

Beware of reading that against [enemy-party-names.md](enemy-party-names.md),
which quotes 531 for that same enemy name. `namePixels` there measures with
`gameTextWidth`'s default tracking, which is the synopsis panel's `字間隔`, and
this plate declares its own `字間隔 = -3`; the two differ by 6.4 pixels per
character. The numbers above are the plate's own,
`gameTextWidth(name, trackingFor(-3, 32))`. [text-width.md](text-width.md) has why
a panel is measured with the tracking it declares.

The other place `s[4008]` is drawn is the `Title` of `AdmiralView`, font 30 and
`字間隔 = -2`, also unclipped. The widest name the Japanese puts there is
`ヘルマン第２軍（番裏守備隊）` at 392 pixels; `Fiend Extermination Squad` is 386, and
the patch already ships `Helman 3rd Army（Imperial Capital Garrison）` at 657.

## The dialogue

The plate is four strings; the script says the same words 214 times. Before this,
`en_grok` spelled `魔人討伐隊` **twenty-five different ways** over its 201 lines --
Majin Extermination Squad 53 times, Demon Extermination Squad 30, demon
extermination unit 17, and a tail of hunting squads, slaying teams and one
warlock extermination squad.

They are repaired at build time rather than line by line, by an entry in
`glossaries/mistranslated_names.json`. That table is a repair pass rather than
translation: where the Japanese line says the word and the English does not spell
it the settled way, `createNameNormalizer` swaps a known misspelling out. It
already holds terms as well as people -- `魔軍` is Monster Army there and `魔人` is
Fiend -- so a party's name is nothing new in it.

**The two new entries have to sit above the `魔人` one**, because the file's order
is the order the normalizer applies them in. `魔人討伐隊` contains `魔人`, so with
the shorter entry first it sees an English line that does not say "Fiend", finds
"Demon" inside "the Demon Lord subjugation squad", and leaves "the Fiend Lord
subjugation squad" behind for the longer entry to fail to recognise. In the right
order the longer entry fires first, and the `魔人` one then finds "Fiend" already
in the sentence and skips.

That reaches 186 of the 201. The other fifteen are lines where the translation
moved the name onto its neighbour -- `ランスの率いる` / `魔人討伐隊が防衛ラインに向かい、`
came out as "Thus, the Majin Extermination Squad led by Rance" / "headed toward
the defense line" -- and the normalizer keys on the Japanese of the line it is
repairing, so it cannot see a name sitting one record away. Thirteen of those were
edited in the dialogue directly -- then the chunk files, the scenes now -- along with
`まじんとーばつたい`, which is the same word in kana and no kanji key can match. Two
are left as they are: `ラング・バウから出発したランス達、` / `魔人討伐隊が昼間、城に到着した。`
reads "Rance and the others who departed from Lang Bau" / "arrived at the castle
during the day", which does not name the squad and does not contradict it either.

`ランス部隊` is deliberately **not** in the table. Its six lines are description
rather than naming -- "Rance's unit arrives again in front of Hoffhoff Castle" --
and the Japanese is doing the same, since at that point in the story the party
has no name yet. `統合部隊` never appears in the dialogue at all.

## The synopsis

`glossaries/summary_terms.tsv` carries both `討伐隊` for whoever translates the
next batch of captions, and nine rows of `glossaries/summary_glossary.tsv` say
them. Seven of the nine were a straight swap. The other two were panels with no
room:

- `０６／反撃作戦開始` has seven captions and the panel has seven rows, so nothing in
  it may wrap. "Rance forms the Fiend slayers" fitted one row and "Rance forms the
  Fiend Extermination Squad" is 127% of one, so the caption is now "Fiend
  Extermination Squad raised" -- 97%, and Rance is named in the panel above it
  anyway.
- `１０／１／迎撃開始` has six captions and one of them already wrapped, which used the
  seventh row up. Shortening that one -- "The targets: Fiends and Monster Generals"
  to "Targets: Fiends, Monster Generals" -- gives the row back, and the party's
  name takes it.

`crampedCaptions` over all 2208 events reports zero either side of the change.
[synopsis-screen.md](synopsis-screen.md) is how that layout works.

## Checking it

```
node scripts/ain.js --out=build/scratch-party
alice ain dump -t -o build/scratch-party/built.txt build/scratch-party/Rance10.ain
```

Then read the four slots back, and sweep the whole dump for a spelling that should
no longer be in it. Flatten `\n` before matching: the dialogue wrapper puts line
breaks inside a name, so a grep for `Fiend Extermination Squad` misses every line
where it wrapped -- which is how three stale spellings survived the first pass of
this and were caught only on the second.
