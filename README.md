English translation installation instruction available [here](https://github.com/klesun/rance-10-gpt-mtl/releases) (Releases page)
__________
God bless the soul of the author of this article:
https://haniwa.technology/alice-tools/README-ain.html

So, apparently, with [alice-tools](https://github.com/nunuhara/alice-tools) it's _very_ easy to edit the text in the game to translate it.

And, as we all know, nowadays ChatGPT is a thing so it should be rather easy to translate the game with rather fine quality. (What ships today is Grok's translation rather than ChatGPT's — the original one is still in git, under the `en_gpt-final` tag. See the text languages below.)

Youtube recordings of the walkthrough with this English patch:
https://www.youtube.com/playlist?list=PL_mejOc9nYCLg6V_FI9ISiafdjH2CW2Mv

You can obtain the game copy here: (please, support the developer!)
https://www.dlsite.com/pro/work/=/product_id/VJ011759.html

## Examples

Before:

<img width="1112" alt="The dialogue window as the game ships it, Sill speaking in Japanese" src="docs/images/dialogue-before.jpg" />

After:

<img width="1112" alt="The same line with the patch installed, Sill speaking in English" src="docs/images/dialogue-after.jpg" />


______________________________________

## Steps to Build

1. Install [node.js](https://nodejs.org/en)
2. Run `npm i` to install dependencies
3. Copy `.env.example` to `.env` and put your own paths in it: `GAME_DIR` is the game folder the build writes into, `ALICE_EXE` is your [alice-tools](https://github.com/nunuhara/alice-tools) binary. `.env` is gitignored, so these stay yours
4. Run `npm run regenerate-ain` to replace the `Rance10.ain` in the folder your `.env` calls `GAME_DIR` with the translated version (if the game sits under `C:\Program Files`, you will likely need to either open terminal as administrator for that or change the access of that folder to "Full Access" for "Everyone" group)
5. Run `npm run regenerate-ex` to do same for the `Rance10EX.ex` file that translates skill descriptions, character descriptions, quests, and the synopsis screen
6. Run `npm run regenerate-pack` to translate some UI elements, like settings menu (the archive it builds is already translated in the released patch, so this only matters if you edit `archives/Rance10Pact_v1_04`)

Those three commands write straight into your game folder. To build into a folder instead, run all three at once:

```
npm run release
```

That builds into `build/release`, one folder per language:

- `en_grok/` — the English patch: `Rance10.ain`, `Rance10EX.ex` and `Rance10Pact.afa`.
- `jp/` — one `Rance10.ain`, the game's own Japanese with the optional features over it and no
  English anywhere.

Each folder is a complete install on its own. Copy what is inside one of them into your game folder,
over the files already there, and that is the patch — there is nothing to assemble out of two
places.

Two more things are in each folder. `custom_mods/` holds one empty file per optional feature, and
those files are the switches, shipped already turned on — so the features work the moment you copy
the folder in, and turning one off means deleting a file instead of working out which one to create.
`README.md` says which language the folder is, which version of the patch it is, what each file
holds and which file switches what, since a folder of identically named files cannot show any of
that by itself. Both are generated: `modules/CustomMods.js` and `modules/ReleaseReadme.js`.

To build just one of the folders, use `node scripts/release.js --text-lang=en_grok`. The npm
spelling of that flag is unreliable — PowerShell quietly turns it back into the default.

The images are not in there. They have no build command at all; see the image archives below.

Where a build goes is two flags, and which text it carries is a third — all of them on `release`, and on any one of the three commands above:

```
node scripts/release.js                            # what npm run release runs: every language into build/release
node scripts/release.js --text-lang=en_grok        # just the English
node scripts/release.js --text-lang=jp             # just the Japanese: one Rance10.ain, no English in it
node scripts/release.js --game                     # into your game folder, the language .env names
node scripts/release.js --game --text-lang=jp      # into your game folder, and no translation at all
node scripts/release.js -o build/grok-test         # into a folder of your own
node scripts/release.js --out="D:/my patches/v3"   # --out is -o spelled out; any disk will do

node scripts/ain.js -o build/grok-test             # just Rance10.ain
node scripts/ain.js --text-lang=jp                 # just Rance10.ain, the Japanese, into your game folder
```

Quote a path that has a space in it, the way the last line does. Without the quotes the build is handed `D:/my`, and it writes there and says nothing. `--out="D:/my patches/v3"` and `"--out=D:/my patches/v3"` both work, in PowerShell and in bash alike.

`--game` is the folder your `.env` calls `GAME_DIR`, so the path to your game is written down once and never typed again. A path like `build/grok-test` counts from this repository's folder, not from the folder you are standing in, and it is created if it is not there yet. Setting `OUT_DIR` in your shell does the same thing for every build you run in it, and `--game` overrules it for the one run.

Use `node scripts/...` for this rather than `npm run release -- --out=...`: in PowerShell the bare `--` disappears and you quietly get `build/release` instead.

The game can be built with more than one text, and there are two to choose from.

`en_grok` is the English one, and the default: the whole script put through Grok in
[the fork](https://github.com/IdOnThAvEaUsE69/rance-10-gpt-mtl-fork). `npm run regenerate-ain`
builds it, and `TEXT_LANG` in `.env` changes which one you get without passing a flag.

`jp` is no translation at all — the game's own Japanese with the `features/` patches over it and no
English anywhere. Build it with `node scripts/ain.js --text-lang=jp`. It is for playing or testing a
change to how the game behaves without installing a translation along with it. (Use the `node`
spelling: `npm run regenerate-ain -- --text-lang=jp` works in cmd.exe and bash, but PowerShell eats
the bare `--` and quietly builds the default instead.)

There used to be a third, `en_gpt`, the translation this repository shipped with at the beginning.
It was removed once nobody was building it, and it is still in git under the `en_gpt-final` tag.
[docs/text-languages.md](docs/text-languages.md) has what a text language is made of, how to add
one, and how to read a line back out of that removed one.

## What the patch translates

Most of the patch is dialogue, and that part is easy: swap the Japanese line for an English one.

Everything below was harder. In each of these the Japanese is not only text — it is also a key
your save file stores progress under, or a word the game's own code compares against, or a picture
rather than a string. Replace it and something breaks: ranks read back as zero, cards turn into
black rectangles, an image the game asks for is not there. So each of these needed a way around,
and each section says which one.

### The images

The images are English too, in `archives/Rance10Flat_v1_04` and `archives/Rance10CG2_v1_04`, and they are the one thing here with no command. `ar pack` rebuilds an archive out of every entry it holds rather than patching the one file you changed, so packing either of those needs the game's own copy of the thousands of images nobody translated — half a gigabyte the repository cannot carry. See [docs/image-archives.md](docs/image-archives.md) for how each is packed, and what a mistake costs you.

### Character names and card labels

Character names and card labels are English too, but they cannot simply be translated in the data: a character's `識別名` and a card's `Id` double as the keys your save file stores rank and event progress under, so translating them makes every rank read back as zero. Instead `patches/card_names.jaf` patches the two display accessors to look the English text up in the `識別名情報` tree, keeping the keys Japanese. `npm run regenerate-ain` applies it, and nothing extra is needed to build.

The English text itself is generated by `npm run regenerate-card-names`, whose output is committed — you only need to re-run it after changing `glossaries/card_name_glossary.tsv`, `glossaries/mistranslated_names.json` or the `archives/Rance10EX_v1_04` tables it reads. See [docs/card-name-localization.md](docs/card-name-localization.md) for how it works and what breaks if you get it wrong.

### The synopsis screen

The synopsis screen — the recap `あらすじモード` shows for an event you have already seen — is English from
`glossaries/summary_glossary.tsv`, all 4458 captions of it. `npm run regenerate-ex` writes them in as it builds, into a copy of
the source tree rather than into `archives/Rance10EX_v1_04/37_あらすじデータ.x` itself: the glossary is keyed by the Japanese,
so a table with the English written over it would match nothing on the next build. The one thing still Japanese on
that screen is the caption beside the panel, which is painted into an image in `Rance10CG4.afa` rather than stored as
text. See [docs/synopsis-screen.md](docs/synopsis-screen.md).

### The Location plate on the quest map

The 254 place names on that plate come from `glossaries/place_name_glossary.tsv`. The frame with the
word `Location` on it had been redrawn into English years ago; the name sitting inside it never was,
because it lives in `archives/Rance10EX_v1_04/5_クエストデータ.x`, beside quest descriptions somebody
had translated. `npm run regenerate-ex` writes the English into a copy of that table, the same way
the synopsis is done.

One value is left in Japanese on purpose. `地名 = "ランス城"` is not a name at all but a marker: the
code compares against it to decide which of the four names Rance Castle goes by at that point in the
story. So the 25 rows saying it keep their Japanese, until a `.jaf` override takes the accessor over.

Nothing on this plate clips — a name too long simply runs out over the `Location` label and off the
frame — so the build measures every name against the plate's 458 pixels and reports the ones that do
not fit rather than cutting them. See [docs/place-names.md](docs/place-names.md).

### The race on the enemy status panel

The race under an enemy's name is English from `glossaries/race_name_glossary.tsv`, but as a patched function rather than patched text: six of the nineteen race names are also keys or names elsewhere — translating `モンスター` where it sits turns every monster card into a black rectangle — so the build overrides the accessor instead, the way `patches/card_names.jaf` does, and every string keeps its Japanese. `npm run regenerate-race-names` re-reads the race numbers out of the `.ain`; `npm run regenerate-ain` generates the `.jaf` and applies it. See [docs/race-names.md](docs/race-names.md).

### The four hint lines under an enemy's stats

The four hint lines under an enemy's stats in battle are English too, from `glossaries/enemy_info_glossary.tsv`. They are string literals rather than dialogue, and they sit in the dump among every enemy's internal code name, so which ones they are is found in the code rather than by reading: `npm run regenerate-enemy-info` does that and writes `game/extracted/enemy_info_lines.v1.04.tsv`, which is committed and only needs re-running after the `.ain` changes. `npm run regenerate-ain` applies them. See [docs/enemy-status-lines.md](docs/enemy-status-lines.md).

### The two card Ids on that same panel

The same panel names two cards: the one an enemy is captured as, and the one it can be stolen from.
Both are in English, and unlike the optional feature further down, this is in every build.

Those two are Ids rather than names — the keys `CardGenerator` builds a captured card out of, and
the ones a treasure chest is filled from. Translate them where they sit and the capture breaks while
the panel goes on looking perfectly right. So `EnemyInformationView@SetParam` is patched instead, to
run each Id through the same tree the card plates already read, and every string keeps its Japanese.
Nothing here needs translating or switching on: the English is the card plate's own, already there.

It used to share a file with the enemy-panel feature, and was split out when that feature became
optional — this is translation, and declining a change to how the game plays should not cost you any
of it. See [docs/card-name-localization.md](docs/card-name-localization.md).

### The name over the enemy's HP bar

The 231 enemy names come from `glossaries/enemy_party_glossary.tsv`, and like the races they are a
patched function rather than patched text. 45 of them share a string slot with something else, and
14 of those are keys — `ジャハルッカス`, for instance, is the card Id a card box is filled from. So the
build overrides `Enemy@Id::get` and every string keeps its Japanese.

The override also tidies up what the game adds after a name: a group reads `Monster Soldiers ×25`
instead of `Monster Soldiers(25匹)`. `npm run regenerate-enemy-party-names` re-reads the names out of
the `.ain`, and `npm run regenerate-ain` generates the `.jaf` and applies it. See
[docs/enemy-party-names.md](docs/enemy-party-names.md).

### The name over your own HP bar

The plate at the other end of the same screen is the one surface here that needed no new machinery.
`Party@Name::get` returns one of four strings depending on how far the story has got, and not one of
them is a key or is compared against anything — so they are simply translated where they sit, in
`patches/system_cherry_picks.v1.04.ain.txt`. `ランス部隊` is the Rance Squad, then the Fiend
Extermination Squad, the Demon King Extermination Squad and the Combined Squad, all four keeping the
`隊` the Japanese keeps.

An override could not have done this anyway: the second of those strings is also the army's name on
the war map, and that one is pushed straight out of `Ｔ武将計算` rather than through the accessor.

201 dialogue lines say the same word, spelled twenty-five different ways between them. They are
brought into line at build time by a single entry in `glossaries/mistranslated_names.json` rather
than edited one by one. See [docs/party-name.md](docs/party-name.md).

### The achievements screen

The achievement names on the 実績 screen come from `glossaries/trophy_name_glossary.tsv`, and the
bonus each one grants from `glossaries/trophy_bonus_glossary.tsv`.

A trophy's Id is two things at once: the string that screen draws, and the key your save file
records a completed trophy under. Translate it and every achievement you have earned reads back as
unearned — taking the clear points and the permanent stat bonuses with it. So `npm run regenerate-ex`
writes the English in beside the Japanese instead, and `patches/trophy_names.jaf`, applied by
`npm run regenerate-ain`, reads it back at the one label setter both the list and the panel go
through. You need both commands: either one alone leaves the screen exactly as it was.

A row is two columns — the name, and a `★` bonus flag held at a fixed column by padding. The build
measures every English name against the width the Japanese used and reports the ones that are over
rather than cutting them. See [docs/trophy-names.md](docs/trophy-names.md).

### The date

The date the game counts turns in reads `LP 7 Dec, early` where it used to say `ＬＰ７年１２月前半`.
It is assembled rather than stored: `GameYear@ToString` fills `%s%D年%D月%s` from four accessors, and
the turn-start banner, the corner frame, the ADV box and the brave-mode caption all draw whatever it
returns — so one patch covers all four places.

It had to be a patch rather than translated text. Two of those four pieces are `前半` and `後半`, and
the war-result screen pushes those same two strings into `シス／戦況／年月／%s` to name a *picture*:
`シス／戦況／年月／前半.ajp` is a real entry in `Rance10CG2.afa`, so an English string there would ask
the game for a file that does not exist. Every string therefore keeps its Japanese, and
`patches/lp_date.jam` re-emits the function, calling `patches/lp_date.jaf` for the era, the month
name and the half.

Why a `.jam`, if you come to write the next one: `GameYear` keeps its year, month and half as
properties, and alice-tools' `.jaf` compiler answers `Invalid struct member name` to every spelling
of a read — so the month could not be turned into `Dec` inside an override.
`npm run regenerate-ain` applies both, and nothing else is needed.
See [docs/lp-date.md](docs/lp-date.md).

## Optional features

These four change how the game *plays*, not what it says, so you can take them or leave them.

There are two switches, and a feature only works when both are on. The first is the build:
`npm run regenerate-ain` puts all four features into `Rance10.ain`. The second is a file next to
`Rance10.exe`, which the game looks for while the feature is firing: create the file and the feature
works, delete it and the game behaves exactly as it always has. Neither switch needs the game
restarted.

A release folder comes with those files already made, so its features work as soon as you copy the
folder in. Installing straight into your game folder makes none of them — those files are the
player's to create.

| Feature | What it changes | The file that switches it |
|---|---|---|
| [`enemy-panel`](features/enemy-panel/README.md) | the enemy status panel at the start of every round, not only after Analyze | `custom_mods\enemy_panel_on` |
| [`reliable-cooking`](features/reliable-cooking/README.md) | Meal Preparation and Sweets Making always work, instead of failing a quarter of the time | `custom_mods\reliable_cooking_on` |
| [`always-first-finisher`](features/always-first-finisher/README.md) | the +50 First Finisher treasure bonus on every battle, whoever lands the kill | `custom_mods\always_first_finisher_on` |
| [`rank-up-keep-progress`](features/rank-up-keep-progress/README.md) | a rank-up keeps the experience already accumulated toward it, instead of emptying the bar | `custom_mods\rank_up_keep_progress_on` |

Each feature is one folder under `features/`, and its README there says what it does, how it is
built and what it cost. To build without one of them:

```
node scripts/ain.js --without=enemy-panel
```

## The rest of `docs/`

Every section above links its own write-up. These are the remaining ones, about things the patch
does *not* change — questions that were looked into and left alone, and one post-mortem:

- [docs/coherence-sweep.md](docs/coherence-sweep.md) — twelve sessions of reading the translated dialogue line by line by hand. Kept for the taxonomy of errors it arrived at rather than as instructions to follow.
- [docs/party-total-hp.md](docs/party-total-hp.md) — where the party's Total HP comes from, why rearranging the party mid-battle does not move it, what else in the game reads it, and the replacement formula worked out but not built.
- [docs/battle-experience.md](docs/battle-experience.md) — the experience a battle pays out, its five bonuses, and why the characters who collect it are the ones standing in the party when the result screen appears rather than the ones who fought. Four ways of changing that are costed at the end; none is built.
- [docs/clear-point-bonuses.md](docs/clear-point-bonuses.md) — a short note off the back of that one: what the new-game-plus points buy, and why spending them on extra party slots is the worst of the available splits.
- [docs/shuriken-target-choice.md](docs/shuriken-target-choice.md) — whether the player could pick which of the enemy's queued actions a shuriken tries to cancel, instead of the game picking at random. The icons in that row are already clickable objects that know their own index, so the cheap version is three files and no new UI; the version the question literally asks for needs a scene class the game has nothing to lend. An investigation and a low-priority todo, not a plan.
- [docs/number-format.md](docs/number-format.md) — why the war panels count in myriads, `総兵力 26万0000人` for 260,000 troops, and what it would take to make them count in thousands. The code half is a `.jam` of substituted constants; what stops it is that there is no comma anywhere in `Rance10CG2.afa` and the digit sheets are ten cells wide, so a Western separator is a picture somebody has to draw. It also records what the two alice-tools builds will and will not compile against a class like this, which is the part worth having whether or not the format ever changes.
- [docs/corpus-alignment.md](docs/corpus-alignment.md) — the one of these that is about the translation rather than the game: whether a corpus record's Japanese is really the game's line for the number it carries. Thousands of them are not, and almost all of that is a dropped closing bracket that nobody ever sees — but 158 lines across six scenes were showing the *next* line's English, and 386 records carried the *next* line's Japanese, which is the field the name repairs read. Both are what comes of measuring a duplicated line number against its other copy instead of against the game's own dump.
