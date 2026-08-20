# The synopsis screen

`あらすじモード` is the recap the game offers when you pick an event you have
already seen: seven dotted rows summarising it, a **Play Event** button, and an
**OK** that skips the scene. Its text is four and a half thousand short
captions, and all of them are English now.

```
npm run regenerate-ex          # builds them into Rance10EX.ex
```

## Where the text is

`archives/Rance10EX_v1_04/37_あらすじデータ.x`, a tree of one node per event:

```
２２１／２／ラングバウ到着 = {
    ００ = "｜−−−−−−−−｜−−−−−−−−−｜",
    ０１ = "ラング・バウに到着",
    ０２ = "",
    ０３ = "まずは寝る",
    ...
```

Two things in there are not text.

**The node name is a key.** The scenario calls `Scenes::RunSummary` with it and
`SummaryInformation@Ids::get` looks the event up by it, so it stays Japanese
whatever happens to the rows. Translating it would lose the event, not rename
it.

**Field ００ is never printed.** `SummaryData@Desc::get` loops `i` from 0 to 9
and formats `あらすじデータ.<node>.%02D` with `i + 1`, so `０１` through `１０`
are read and `００` is not. Every `００` in the file holds the same thing --
`｜−−−−−−−−｜−−−−−−−−−｜`, with its marks at 1, 10 and 20. It is the width ruler
the designers worked against, and it agrees with the placeholder the layout
carries for `TextDesc` in `archives/Rance10Pact_v1_04/Game/Adv/SceneSummary.pactex.x`:
twenty full-width characters. Do not *measure* that `００` string, though --
it is drawn with `−`, U+2212, which is narrower than a full-width glyph, so it
comes out a sixth short of the twenty columns it marks. `LONGEST_LINE` is the
measure; `００` is the picture of it.

## The panel is seven rows, and it clips nothing

Measured in the game rather than derived from the layout, whose numbers do not
agree with each other -- see `docs/text-width.md`, which is also where the width
of a row is settled.

The base CG, entry 0 of `Rance10CG4.afa`, draws **seven** dotted rules, at y 380
to 740 sixty pixels apart. No event in the table is taller than seven rows, and
the ００ ruler is twenty columns wide, so seven by twenty is the panel the
designers wrote to.

Fields `０８`, `０９` and `１０` are read by the code and **do print** -- they
land on the ornamental frame below the box, beside the Play Event button, which
looks like a bug rather than a row. Treat seven as the ceiling.

Nothing is clipped in either direction. `クリップ許可 = 0` is literal: an
overlong caption runs out of the box, over the OK button and off the screen
edge. So the cost of a row that does not fit is worse than a cut-off tail, and
the width is checked and warned about rather than truncated.

Nothing wraps by itself either -- each field is its own row -- so a caption too
wide for one row has to be laid into two fields, which is why writing the
English into the table is a per-panel layout and not a per-field substitution.

## The English lives in a glossary, not in the table

`glossaries/summary_glossary.tsv`, keyed by the Japanese, two columns. The table's 6414
filled fields are 4465 distinct phrases -- `戦闘開始` alone opens 85 events --
so keying by phrase translates each one once by construction rather than by
remembering to.

That key is also why **the build never writes English into the table**.
`renderSummaryTable` in `modules/SummaryLines.js` returns the rendered text and
`scripts/ex.js` copies the whole `archives/Rance10EX_v1_04` tree to a temporary
directory, drops the rendered table in, and builds from the copy. Writing in
place would work exactly once: the second run would find no Japanese to look up
and quietly produce a table with no English in it. Seven megabytes of text is a
moment to copy, and the file under version control stays as the game shipped it.

A phrase with no English is left as it is rather than blanked, so a partly
translated glossary gives a partly English panel and shows at a glance what is
still to do.

## The build lays a caption across two rows

A row of the panel holds about 33 latin letters, and 597 of the 4458 captions
are wider than that -- every Monster Army, Free Cities and Demon King line.
Nothing is clipped, so each of those would run out over the OK button.

`renderSummaryTable` breaks them instead. It rebuilds each node rather than
substituting field by field: the captions of the event go through
`wrapToPanel`, the blanks the designers left between thoughts stay where they
are, and the result is written back into `０１` onwards -- into more fields
than the node started with, where it needs them. 2152 of the 2208 events have
at least one row to spare, so most of the room is already there.

`wrapToPanel` breaks on spaces, into as few rows as the caption needs and then
as evenly as it can. Even beats greedy here because the panel's dotted rules
space every row alike: `The satellite weapon / comes into view` reads as one
caption, where `The satellite weapon comes / into view` reads as two.

Two things pull against even. A row should not end on a word the next one is
needed to make sense of -- `and`, `the`, `of` -- and a break should not land
inside a name or a term, because `wears the Monster / Army down further` reads
as a caption that lost its subject. The second is why the terms are a table:
`glossaries/summary_terms.tsv` and `glossaries/mistranslated_names.json` are
read for their English as well, and every phrase in them of more than one word
is welded. Neither rule can change how tall a caption is -- the row count is
settled before either is looked at, so they only choose among the splits of that
height.

What is left is the translator's ear. Whether the second row stands up as a
caption of its own is not something a rule can hear, and the way to fix one that
does is to phrase the caption so it breaks elsewhere.

Where the event has no row to spare, the captions that overflow least are put
back onto one row and left to run off the panel. Those are the ones somebody has
to shorten by meaning rather than by layout, and there are **none** as the
glossary stands -- there were 54, in 44 events, and each was cut down to one
row. The flag that finds them again:

```
node scripts/summary_chunk.js --panels --cramped     # events the build cannot fit
```

In a block it marks the caption itself with a `!` in place of the bar opening
its row. Which one that is has to be marked rather than worked out, because the
rows of a panel compete for the same spare space: ４２／ヘルマン自力解放５ has two
rows free and three captions that each want a second one, and shortening any one
of the three is what frees the other two.

## Working on it

```
node scripts/extract_summary_lines.js   # refresh the glossary from the table
node scripts/summary_chunk.js --panels  # the next 20 events, whole
node scripts/summary_chunk.js --panels --node=２４１／３    # ...or one chapter
node scripts/summary_chunk.js --panels --cramped           # ...or what will not fit
node scripts/summary_chunk.js 300       # a flat batch of whatever is still Japanese
node scripts/summary_merge.js --force   # read the answer back in
node scripts/lookup_term.js 魔軍         # how the patch already translates a word
```

Every one of them merges rather than overwrites: English already in the file
survives, a phrase the game no longer has keeps its English at the end of the
file under a heading, and `summary_merge.js` leaves an already-translated row
alone unless `--force`. Nothing typed by hand is lost by running any of them
again.

`--panels` is the mode to go back over finished text with, and `--force` is how
its answer gets in, since every phrase has English now and a merge without it
applies nothing. A block is one event: all seven rows in the order they are
drawn, the blanks among them, the English each row carries today, how many rows
are free, and the names and terms that event mentions. A phrase shown in more
than one event belongs to the first of them by file order and reads as fixed
context in the rest -- which matters for `戦闘開始` and the 313 others like it,
and not at all for the 4145 that appear exactly once.

Owning a phrase is not the same as being the only panel that draws it, and the
difference is the one trap this mode has. A caption written to follow the row
above it is that panel's own sentence and a non-sequitur everywhere else:
`各国姫をケイブリスが陵辱` reads perfectly as "He violates the princess of
every land" under `Demon King Kayblis rules the world`, and in `５５５／人類滅亡`
there is nobody in the panel for that "He" to be. So the block says
`(also drawn in N other panels)` beside a caption it is asking for, and a
caption carrying that note has to stand up under rows this block is not
showing. `--node=` is how to go and look at them.

What comes back is unchanged: `<number> <TAB> <the English>`, one line per
caption, numbered by position in the glossary. The translator never breaks a
caption -- the build does that -- they are told how much room the event has and
write to it.

`summary_merge.js` reports three things worth acting on: the captions the build
cannot fit, every row it overwrote with the English it replaced, and rows where
the English does not spell a name the way `glossaries/mistranslated_names.json`
does. The last is noisy by design -- 178 of the 4458 rows trip it, nearly
all because a caption twenty characters wide cannot hold `Agireda Kosabusshi
Zonna Abona` and says `Agireda` -- so it is printed last, after everything
somebody has to act on. What it is for is the other kind of hit: a *different*
spelling of the same name. Where the canonical name does not fit, the card's
short form is the right fallback -- `scripts/generate_card_names.js` refuses
`Masamune` -> `Dokuganryuu Masamune` as a wrap rather than a respelling, so the
short form is a spelling the game itself displays.

An overwrite and a hand correction look the same in the glossary afterwards.
The file is in version control and `git diff` shows both, which is the whole of
the safety net there is.

## The words this screen settled on

`glossaries/summary_terms.tsv`, the Japanese and the English, and a third column
for the short form where twenty characters would not hold the full one: `聖櫃`
is `the Ark` in four rows out of five, `闘神大会` `Toushin tourney`.
`summary_chunk.js` quotes the ones an event mentions into its prompt, beside the
names.

A suggestion in a prompt is not a decision, though, and for a long time nothing
asked afterwards whether it had been taken. `魔王` has been `Demon King` in that
file since it was written and `０８／魔王の噂` still went out saying "The Monster
Army hunts the King", which in this world is somebody else entirely.
`createTermChecker` asks, the same way the name check asks of
`mistranslated_names.json`, and both scripts that write the glossary print what it
found -- 43 rows, ahead of the name complaints because there are a quarter as
many. Most of those 43 are the panel rather than a disagreement, "the enemy" for
a `魔軍` that would not fit on the row; what is worth the reading is a row that
had the room and used another word anyway.

`node scripts/find_dropped_terms.js` asks it of the glossaries no build writes
back -- the enemy panel, the HP bar, the cards, the achievements -- and, with
`--corpus`, of the dialogue. That is where the terms are really loose: 3912 of
the 273562 translated lines, `総統` a Supreme Leader in a thousand of them where
every screen says Supreme Commander. It is also how `聖骸闘将` was found to be a
Holy Corpse Tousho on the synopsis and a Holy Corpse Fighting General over its
own HP bar.

Names of people are not in it. They come from
`glossaries/mistranslated_names.json` and `glossaries/card_name_glossary.tsv`,
and `summary_merge.js` reports a row that spells one some other way.

`scripts/lookup_term.js` answers for a word the dialogue already used -- it
pairs the Japanese dump with the text language's rendered text by `m[]` number. A good
part of the synopsis is words it never did: the operations, the fortresses, the
map, the machines. Each of those was decided once, in a batch of three hundred,
and then had to hold for a screen nobody reads in one sitting. `滅号作戦` is
Operation Extermination, `永久牢` the Eternal Prison, `番裏の砦` Fort Banura;
none of those is what a translator would invent unprompted, and none of them
would survive being invented a second time. That file is where they live so
that no batch has to.

A caption that opens with `※` keeps it: 114 rows do, because it is the game's
own mark for a condition rather than a word. `※要◯◯　内容若干変化` becomes
`※Needs X - slight changes`, `※条件　◯◯` `※Condition: X`, `※処理　◯◯`
`※Handling: X`. Nothing else full-width survives: a leading `・` is dropped,
`・・` becomes `...` or a dash, `←Ｎｅｗ！` becomes `<-New!`. What makes the rule
enforceable at all is that `summary_merge.js` refuses a row still carrying kana
or kanji outright -- full-width punctuation is outside those blocks and gets
through, so it is on the translator.

The one that cannot get through is the leading full-width space. Ten rows open
with one, `　裸イベント` and `　少し下がる` among them, and it is an indent under
the row above rather than a word. `summary_merge.js` trims the English it reads,
and JavaScript's `trim` counts U+3000 as whitespace, so a reply that keeps the
indent merges as though it had not -- silently, since the row it leaves is the
row that was already there. All ten drop it, and the prompt says so rather than
asking for something the merge will not take.

The glossary ends in an unbroken run of 144 `◯◯裸イベント` rows, one per
character, and every one of them is `X nude event`.

The coarse register is the patch's, not softened for the panel: `※エロＣＧ`
※Erotic CG, `抱く` beds, `犯す` and `陵辱` rapes and violates, `ヤリ殺す` fucks to
death, `青姦` rutting in the open, `大乱交祭` the Great Orgy Festival. All 4458
rows are in one voice; a row translated more politely than its neighbours reads
as a different hand rather than as tact.

## What is still Japanese on that screen

The caption beside the panel, `このイベントをスキップします`, and the
`あらすじモード` title are not text at all. They are painted into
`シス／あらすじ／ベース.ajp`, entry 0 of `Rance10CG4.afa`. The string is in no
text container at all: not in the `.ain`'s 15953 strings or 269678 messages, not
in the `.ex`, not in any of the 220 pactex layouts, and not in a byte scan of
the game directory in CP932, UTF-8 or UTF-16.

Translating it means editing the image, and `Rance10CG4.afa` is in no build
command here -- it would need its own manifest and the same back-up-first care
`README.md` describes for `Rance10CG2.afa`.
