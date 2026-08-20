# The Japanese number format

The war panels count in myriads. `総兵力 26万0000人` is 260,000 troops written
the way Japanese groups digits — by ten thousands, with the 万 standing where a
Western reader expects a comma and the four digits after it padded with zeros.
The same panel's damage line reads `1万0000人` for 10,000.

Nothing is built out of this. It is an investigation: where the format is
decided, what it would take to make it `260,000`, what was tried and what it
told us. Nothing here is a plan, and no file in the repository changes because
of it.

## It is the .ain, not the engine

The numbers are drawn by `NumberJp2`, a class in `Rance10.ain`. A layout asks
for one by name:

```
archives/Rance10Pact_v1_04/Game/QuestSelect/CountryDetailBase.pactex.x
データ = (list) { "オブジェクト名", "NumberJp2", "パラメータ", "シス／数字／幅４２／黄,-5,3,127890,人" }
```

`NumberJp2@Init(array<string>)` reads that list as: the digit sheet, the kerning
after a separator, the origin, a placeholder value, and — where a fifth field is
present — a suffix, which becomes the CG `<sheet>／人`. So the `人` on the panel
is a picture rather than a translated string, and so is every digit: the sheet
is a sprite strip of ten glyphs, and `万`, `億`, `人` are separate one-glyph CGs
beside it.

The myriad arithmetic is the class's own, in four methods. Every one of them is
a constant, which is what makes this cheap:

| Method | What it does | What a Western format needs |
|---|---|---|
| `NumberJp2@CreateInfo` | splits the value: `% 10000`, `/ 10000`, `Math.Pow(10000, i)` | `1000` in all three |
| `NumberJp2@GetNumber` | puts it back together over `Math.Pow(10000, k)` | `1000` |
| `NumberJp2@Set` | lays the groups out; the leading group gets numeral length 1, every other group **4**, which is the zero padding | `3` |
| `NumberJp2@Init` | hangs `<sheet>／万` and `<sheet>／億` on the two separator parts | a comma CG |

`GetNumber` is in that list because of the count-up animation: `MoveNumber`
reads the current value back out of the laid-out groups and `OnUpdate` feeds
`Set` an interpolated one, so a `GetNumber` still working in myriads would start
every animation from the wrong number.

`Set` is worth reading once, because it is what makes a new separator free:

```
x = 0
foreach (index, info in m_info) {
    dig = m_partsDigit[info.Type];  dig.SetShow(true);  dig.SetNumber(info.Value)
    dig.X = x;  Ｐ＿数字桁設定(dig.PartsNumber, index != 0 ? 4 : 1, 1)
    x += dig.Width
    sp = m_partsSplitter[info.Type]
    if (sp.IsInitialized()) { sp.SetShow(true);  sp.X = x;  x += sp.Width;  x += m_span }
}
```

The separator is an ordinary picture part and the layout takes its width from
the picture, so whatever is drawn in that CG is what appears and the digits
after it move over by exactly that much. `m_span` — the negative number in the
layout string — is kerning applied only after a separator.

`m_partsSplitter` has three entries: `[0]` is the suffix (`人`, `枚`), `[1]` is
`万`, `[2]` is `億`. `m_partsDigit` has three as well, so a number can carry at
most three groups: 999,999,999,999 in myriads, 999,999,999 in thousands. The
largest number any of these panels shows is an army in the millions, so the
lower ceiling costs nothing.

## What it would change

`NumberJp2` is one class and there is no per-widget switch, so all seventeen of
its instances move together — nine layouts, not just the war panel:

| Layout | Sheet | Shows |
|---|---|---|
| `Game/QuestSelect/CountryDetailBase` ×6 | `幅４２／黄`, `幅３３／青`, `幅３３／赤` | total troops, reinforcement forecast, casualty forecast |
| `Game/QuestSelect/HumansInformationView` | `幅２７／黄` | humanity's numbers |
| `Game/Result/ResultArmyCountView01/02` ×4 | `幅３９／黄`, `幅２７／赤` | the war result |
| `Game/Result/AddedArmyView01/02` ×2 | `幅３３／ピンク` | reinforcements gained |
| `Game/Party/OrganizationCardCounter` | `幅２２／黒グラデ` | cards in an organisation |
| `Game/Party/PartyCommonParamView` | `幅４７／黒グラデ` | food tickets |
| `Game/TurnEnd/BraveModeView` ×2 | `幅４０／黒` | brave mode |

Ten distinct digit sheets between them.

There is a second, unrelated myriad formatter: `万千表示`, `万千表示Ｂ` and `Ｋ数`
build strings like `２６万` for dialogue text. They share nothing with this and
would be their own job.

## The one thing that is missing is a comma

There is no comma anywhere in `Rance10CG2.afa` — not as a standalone CG, and not
as a glyph in any sheet. All ten sheets are exactly ten cells wide:

```
シス／数字／幅４２／黄.ajp    420×58, ten cells of 42
シス／数字／幅３３／青.ajp    330×45, ten cells of 33
```

The AJP header carries the dimensions at offsets 12 and 16, so this is checkable
without decoding the image.

Two ways to get one, and they cost about the same:

**A separator CG beside `／万`.** One small picture per sheet, named
`<sheet>／カンマ`, and `Init` points the two separator parts at it instead of
`／万` and `／億`. Nothing about it is uncertain — it is the mechanism the game
already uses for `万`, and the layout follows the picture's width. A fully
transparent picture in the same place gives `260 000` instead of `260,000` for
the same effort, which is worth knowing because there is no code-only way to get
that spacing: the `x += m_span` above sits inside the `IsInitialized()` branch,
so a separator that does not exist advances nothing and the groups run together
as `260000`.

**Widen the sheets and use the engine's own comma.** `Parts@InitAsNumber` reads
the cell width out of the CG's own name — `getIntFromString("シス／数字／幅４２／黄")`
is 42 — and hands `Ｐ＿数字連結ＣＧ設定` twelve widths: ten digits, minus, comma.
Twelve slots against ten cells, so the sheets stop two glyphs short of what the
engine will index. Add cells 10 and 11, turn on `Ｐ＿数字コンマ表示設定`, and one
numeral part draws `260,000` by itself, which would also open up commas
everywhere else in the game.

The catch is that this rests on the comma living in slot 11, which nothing here
proves. The flag is `コンマ表示 = 0` in all 53 layouts that carry it and 1 in
none of them, and `Parts@InitAsNumber` sets it to 0 for every numeral part the
game builds — so the feature exists in the engine's HLL and has never been used.
`シス／数字／幅１６／スラッシュ` and `シス／数字／幅１９／薄青／マイナス` being separate
one-glyph CGs says the artists never filled those slots either. One sheet and
one run of the game would settle it.

Either way this needs `Rance10CG2.afa` repacked, which is the expensive part:
`ar pack` rebuilds the archive out of all 4243 entries, so it needs the whole of
`CG2-raw` and there is no `npm run` for it. `docs/image-archives.md` has the
procedure and the warning that goes with it — the destination is truncated
before the first source file is read.

## What the toolchain will and will not take

**`.jaf` cannot write this class.** The two builds disagree about how far they
get, and neither gets far enough:

| | `ALICE_EXE` (0.9.x) | `ALICE_EXE_PACK` (0.13.0) |
|---|---|---|
| `override void NumberJp2@CreateInfo(int val) { super(val); }` | compiles | compiles |
| `m_info` bare | `Undefined variable: m_info` | `Undefined variable: m_info` |
| `this.m_info` | `Undefined variable: this` | resolves |
| `this.m_span = val`, `this.m_info.Free()`, `this.m_info[0].Value = val` | — | compiles |
| `info.Type = 1` | — | `compile_pop: Unsupported type` |
| `NumberJpType t = 1` | — | `Unsupported variable type: 92` |

`NumberJpInfo` is `{int Value; NumberJpType Type;}` and every group has to say
which power of ten it is, so the one thing 0.13.0 cannot compile is the one
thing this needs. No spelling of the enum constant helps: `NumberJpType.Man` and
`(NumberJpType)1` are syntax errors and `NumberJpType::Man` is an undefined
variable.

The note at the top of `patches/enemy_panel_cards.jam` says the .jaf compiler
resolves neither `this` nor a struct's own members. That is true of `ALICE_EXE`,
which is the build the note was written against; 0.13.0 resolves both, and stops
one step later.

**`.jam` takes it.** Which is the answer, and an easy one here, because all four
edits are constants inside functions that already exist. Take the function
verbatim from

```
alice ain dump -c -o code.jam game/ain/Rance10.v1.04.ain
```

and change the numbers. Tried on `NumberJp2@CreateInfo` — `F_PUSH 10000.000000`
and `PUSH 10000` to `1000`, nothing else touched — assembled with `ain edit
--jam`, and read back out of the built `.ain`, where both constants are 1000.

None of the four edits adds a local, which is the constraint that matters:
`--jam` rewrites code and leaves the `FUNC` section alone, so a patched function
keeps the locals it was compiled with. Substituting constants stays inside that.
Every number in such a file indexes one build of one `.ain`, so it would be
regenerated the same way if the game version moves.

## If it is ever built

1. One `.jam` over the four methods, with a transparent separator CG: `260 000人`,
   ten small transparent pictures and no artwork. Check in the game that the
   origin alignment still lands — the panels right-align these numbers, and the
   group widths change.
2. Replace the transparent placeholders with drawn commas per sheet colour.
   `canvas` is already a devDependency.
3. The labels are pictures too, and a separate job with the same CG2 repack
   behind it: `シス／数字／総兵力.ajp`, `シス／数字／被害.ajp`, and the `人` suffix
   at `シス／数字／幅４２／黄／人.ajp`.
