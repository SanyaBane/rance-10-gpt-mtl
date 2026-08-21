# The cherry-picks are applied last, so they win

`patches/system_cherry_picks.v1.04.ain.txt` is the hand-translated system text:
menu labels, battle log lines, the war situation screen, character epithets.
`scripts/regenerate_aai_txt.js` appends it **after** the whole rendered dialogue,
and alice-tools keeps the last assignment it reads for a slot.

Which means the file does not merely add text. Anything in it overwrites what
the corpus put in the same slot, and nothing says so — not the build, not a
warning, not the diff.

## What that cost

The file carried 103 `m[N]` lines, and 102 of them were overwriting dialogue.
They were residue rather than a decision: `97bcdb11` added 697 of them in one
commit, `e47fd524` removed 638 the next day as "manual corrections for
mistranslated names that were already fixed globally in
mistranslated_names.json", and `e6e1e758` removed twelve more while moving 23
entries into the name table. The 103 were what those passes missed.

Their text said so too. Not one of them wrote `「」`, the convention every line
of the corpus follows; they were straight-quote lines from a different
translation. 31 spelled a name the corpus spells differently, and the Japanese
sided with the corpus every time — twelve said Sheila where 「……むう、シィルか？」
says シィル. `9f6a60a7` removed all 103; none was the only assignment for its
slot, so nothing was lost.

## The check

Parse the rendered patch for every `m[N] = …` and `s[N] = …`, group by slot, and
count the slots assigned **more than one distinct text**. That is a complete,
cheap answer to "is this patch silently overwriting itself", and the number to
expect is zero.

```
build/regenerated.en_grok.ain.txt   # after any npm run regenerate-ain
```

`docs/enemy-status-lines.md` describes the same hazard from the `s[]` side, and
`9193e02a` fixed 43 slots the file was assigning twice. The `m[]` side had never
been looked at until `9f6a60a7`.

## Reading a slot's Japanese

The repository's own dumps will not help: `game/ain/Rance10.v1.04.ain.txt` and
`.json` are **message** dumps — 269 676 `m` lines and no `s` at all. The strings
come from dumping the game's `.ain` directly, and they arrive commented out, one
line per push site, under the scene that pushes them:

```
alice ain dump -t -o original.txt game/ain/Rance10.v1.04.ain
;s[5106] = "魔人バークスハムの使徒"
```

15 770 slots. A slot pushed from several places appears several times, which is
how the shared-slot hazard in `CLAUDE.md` is checked: `s[5106]`, `s[8411]` and
`s[8697]` are pushed from up to five scenes apiece, every one a `Ｔ肩書き`, so
they are display-only and safe to translate.

## The names in it

`createNameChecker` does not run over this file at any build, so for years its
names were never held to the table. Nothing stops you pointing it at them by
hand: the file carries no Japanese, but every slot has one in a dump of the
game's own `.ain`, and pairing the two gives the checker exactly what it wants.

```
alice ain dump -t -o original.txt game/ain/Rance10.v1.04.ain
;s[8186] = "レリコフもしてみる？"
```

Done that way over all 1683 `s[]` lines it reported **88 complaints**, of which 61
were real and are written to the canon in `19d94fe9` and `aacf918f`. Two names
were most of it — ザンス was "Zans" thirteen times against the table's Zance, and
長田君 was "Nagata" nine times and "Osada-kun" twice, 長田 read as Osada. レリコフ
managed four spellings across six slots. Three were not spellings at all: 日光を抜く
is drawing the holy sword Nikkou and read as "Extract the sunlight", 黒髪のカラー？
asks whether someone is a black-haired Kalar and read as "What color is your black
hair?", and お前はドギ！ is Dogi Magi read as a common noun.

The demon words were swept the same way on 2026-08-21, slot by slot: 116 strings
said demon, Demon or Demonic, **37 of them correctly** — 32 are 魔王 and one is
神魔, five are 悪魔 — and the other 76 went to the canon over `5679fbeb`,
`d8fe50f6`, `e4fb9d62`, `323afb83` and `9cfb6db6`.

Where a name has a house form, this file's own is the one to keep rather than the
table's longest: カラー becomes "Kalar Race" because `s[7564]` already writes
"Dragon Kalar Race", and 闘神 becomes Toushin because `s[10738]` and `s[10984]` do.
The one place the short form won on purpose is `s[3211]`, which is
`FriendPanel@Name::get` — all nine of its neighbours are bare given names, so it
says "Lelikov" where the table says "Lelikov Helman", and the checker goes on
complaining about it forever.

**The 26 complaints left are what the checker cannot decide**, and a rerun will
show the same ones. Six are リア, which has two entries — "Queen Lia" and "Lia" —
so whichever a line uses, the other complains. Nine are a name whose entry is the
full form where this file writes the short one deliberately: 政宗 four times,
トルストイ twice, チョチョマン, アギレダ, 源五郎, and the second クルックー entry.
Four are 大将軍, where the file writes "Great Monster General" for 魔物大将軍 and
the entry wants "Great General". Five are role words rendered by sense — 総統,
闘将, 自由都市, 魔軍, フル — and one is かろ inside かろうじて, which `mentions()`
cannot guard against because the word is hiragana rather than katakana.

**The checker is case-insensitive.** It compares with `toLowerCase()`, so `Lemay`
reads as correct where the table says `LeMay`. Silence from it is not proof of
the right casing.

## The "r" workaround, and both halves of what it left

The file opens with a note saying that `r` is read as a line break and that the
answer was "always replacing it with R". Both halves of that are now cleaned up,
and both are worth recognising if the note ever gets acted on again.

**Four lines had lost the escape itself.** `s[15018]` through `s[15021]` ended
"but is Repelledr", "in a fierce battler", "a major offensiver", "by the Monster
Armyr" — a stray letter and no break, where every other line of that war-report
block ends `\r`. Measuring it takes one step, because `alice ain dump -t` writes
a break inside a string as a bare `r` exactly the way `alice ex dump` does: the
Japanese in the dump ends in `r` wherever the real string ends in `\r`, so count
breaks on each side rather than comparing text. That finds those four and nothing
else. Fixed in `70e36404`.

**57 strings carried the capitals.** Two of them still had the workaround whole —
`s[2838]` was "The leadeR is missing. Please oRganize youR paRty" — and the rest
of the file had been cleaned up by lowering the R back, which left exactly the R
that opens a word, because a capital there looks like it might be meant: "total
chaos Reigns", "the Monster Army is Repelled", "Rance Castle Rose into the air".
Fixed in `6c1fce82`.

93 capital Rs stay and divide cleanly. 55 are names — Rance, Reset, Rangi, Rick,
Rocky — and proper nouns: Red for the Leazas Red Army and RedEye, Kalar Race,
Helman Republic, Rock Earth, Monster Realm, Operation Ranger. The other 38 are
labels and epithets whose whole block is title-cased. The battle log settles its
own cases without needing a rule: `s[3275]` is "<Target> recovered ... HP！" and
`s[3971]` was "AP of <Any> Recovered！", so the block says which one it means.
