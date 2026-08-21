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

`createNameChecker` does not run over this file at build time, so its names have
never been held to the table. On 2026-08-21 the demon words were swept against
the game's own Japanese, slot by slot: 116 strings said demon, Demon or Demonic,
**37 of them correctly** — 32 are 魔王 and one is 神魔, five are 悪魔 — and the
other 76 were written to the canon over `5679fbeb`, `d8fe50f6`, `e4fb9d62`,
`323afb83` and `9cfb6db6`. Pointing the checker at those 45 war-report slots
afterwards reports nothing.

Two things that sweep turned up and the next one will meet again:

- **The checker is case-insensitive.** It compares with `toLowerCase()`, so
  `Lemay` reads as correct where the table says `LeMay`. Silence from it is not
  proof of the right casing.
- **Some line breaks are a bare `r`.** `s[15021]` ends `Armyr` because it ended
  `forcesr` before anything was touched — the escaping bug `#8 Fix r escaping in
  Skill Descriptions` fixed elsewhere, still present here and unmeasured.
