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

`game/ain/Rance10.v1.04.ain.txt` already has them, which this file said for a
while that it did not. Only the `.json` is messages-only; the `.txt` carries all
15 770 slots commented out alongside its 269 677 `m` lines, one line per push
site, under the scene that pushes them — byte for byte what a fresh
`alice ain dump -t` writes, so nothing needs alice-tools or `GAME_DIR` to read a
slot's Japanese.

```
;s[5106] = "魔人バークスハムの使徒"
```

`readSlotJapanese` in `modules/CherryPicks.js` reads it that way. A slot pushed
from several places appears several times, which is
how the shared-slot hazard in `CLAUDE.md` is checked: `s[5106]`, `s[8411]` and
`s[8697]` are pushed from up to five scenes apiece, every one a `Ｔ肩書き`, so
they are display-only and safe to translate.

## The names in it

`createNameChecker` did not run over this file at any build, so for years its
names were never held to the table. Nothing stopped anybody pointing it at them
by hand: the file carries no Japanese, but every slot has one in the dump above,
and pairing the two gives the checker exactly what it wants.

```
;s[8186] = "レリコフもしてみる？"
```

`checkCherryPickNames` in `modules/CherryPicks.js` is that pairing, and it runs
at every build of a translated text language — `scripts/regenerate_aai_txt.js`
is what reads this file, so it is what asks. The next name to drift in here is a
build warning rather than a session of reading.

Done by hand the first time it reported **88 complaints**, of which 61
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
says "Lelikov" where the table says "Lelikov Helman", and the checker would go on
complaining about it forever, which is what the settled list below is for.

The file has 1684 `s[]` lines, not the 1683 a regex reports: `s[174]` is written
with two spaces before its `=`, and it says "Unknown".

**The 17 complaints left are what the checker cannot decide**, and they are the
`SETTLED` table in `modules/CherryPicks.js`, one line of reasoning apiece, so
that the eighteenth prints on its own. They are four shapes:

| How many | What it is |
|---|---|
| 5 | a Japanese name with two entries, where whichever a line uses the other objects — リア four times, and the second クルックー entry |
| 10 | the entry holds the full name where this file writes the short one along with every neighbour — 政宗 ×4, トルストイ ×2, チョチョマン, アギレダ, フル, and レリコフ at `s[3211]` |
| 1 | かろ inside かろうじて, which `mentions()` cannot guard because the word is hiragana rather than katakana |
| 1 | `s[9187]`, where the English names nobody: スシヌはそのままでいい is "You're fine just the way you are" |

One of the five is not a name choice at all. `s[14799]` does say "Queen Lia" —
what stands between the two words is the ideographic space this block puts
between a title and a name, and no plain `includes()` gets past it.

The table also reports an entry that stops firing, the way `renderEnemyInfo`
reports a glossary row the game no longer has: a list of accepted complaints
nobody ever takes anything out of stops describing the file.

Nine of the original 26 were decidable after all. Five went in `bcbb913`: four were
大将軍, where this file wrote "Great Monster General" for 魔物大将軍 while eight
other slots of the same block — `s[14974]` through `s[14982]` — wrote "Great
General" for the same word; the fifth was 総統 at `s[10623]`, "World Leader"
against 1044 corpus lines. `docs/terminology-drift.md` is what found them: a
check that starts from the text rather than from the table can see that the file
disagrees with itself.

**The 大将軍 half of that was decided the wrong way, and is reverted.** Seeing
that a file disagrees with itself says nothing about which side is right, and
the four slots were the ones that were: the AliceSoft wiki's page for the rank
carries `Japanese=魔物大将軍` and writes **Great Monster General** 92 times
without varying it. The eight that outvoted them had dropped the 魔物
altogether. Counting heads inside one file is not a source for a name — the
rule at the top of `CLAUDE.md` is that names come from the tables, and where no
table has one, the wiki is the table. All twelve slots say Great Monster
General now, and `glossaries/mistranslated_names.json` carries 魔物大将軍 so
that the next disagreement has something to lose to.

The other four went the day the check was written into the build, and three of
them the same way — by reading this file a line further up. `s[14877]` wrote
"Gengoro Shinoda" where the name table spells 源五郎 "Gengorou" and lists
"Gengoro" as a misspelling; `s[10914]` wrote "Free City Front" beside
`s[10912]`'s "Helman Front" and `s[10916]`'s "Leazas Front"; `s[15016]` wrote
"Excavation General" for 闘将, which four tables spell Tousho; and `s[14915]`
wrote "600,000 monsters invaded" two lines under "A Monster Army numbering
900,000 attacked". **Read the tables before adding anything to `SETTLED`** —
those four had been called undecidable here for as long as the list existed.

One new one has arrived since, and it is deliberate. The `.ain` build's own
enemy-party check now reports `魔女リクチェル ... which the game calls "Richelle
von do Kosusu" -- "Witch Richelle"`, because the plate over the HP bar was
shortened in `b0daa07a` while the entry's canonical stays the full name for the
standing portrait. Same trade as `s[3211]`, in a different file.

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
