English translation installation instruction available [here](https://github.com/klesun/rance-10-gpt-mtl/releases) (Releases page)
__________
God bless the soul of the author of this article:
https://haniwa.technology/alice-tools/README-ain.html

So, apparently, with [alice-tools](https://github.com/nunuhara/alice-tools) it's _very_ easy to edit the text in the game to translate it.

And, as we all know, nowadays ChatGPT is a thing so it should be rather easy to translate the game with rather fine quality.

Youtube recordings of the walkthrough with this English patch:
https://www.youtube.com/playlist?list=PL_mejOc9nYCLg6V_FI9ISiafdjH2CW2Mv

You can obtain the game copy here: (please, support the developer!)
https://www.dlsite.com/pro/work/=/product_id/VJ011759.html

## Examples

Before:

<img width="1186" height="834" alt="image" src="https://github.com/user-attachments/assets/53ffc48b-1b7c-469f-a79a-b31c248846a2" />

After:

<img width="1109" height="844" alt="image" src="https://github.com/user-attachments/assets/5233c5d3-83e8-4e20-807d-a0cbef5e5c81" />


______________________________________

## Steps to Build

1. Install [node.js](https://nodejs.org/en)
2. Run `npm i` to install dependencies
3. Copy `.env.example` to `.env` and put your own paths in it: `GAME_DIR` is the game folder the build writes into, `ALICE_EXE` is your [alice-tools](https://github.com/nunuhara/alice-tools) binary. `.env` is gitignored, so these stay yours
4. Run `npm run regenerate-ain` to replace your `%GAME_DIR%\Rance10.ain` with translated version (if the game sits under `C:\Program Files`, you will likely need to either open terminal as administrator for that or change the access of that folder to "Full Access" for "Everyone" group)
5. Run `npm run regenerate-ex` to do same for the `Rance10EX.ex` file that translates skill descriptions, character descriptions, quests, and the synopsis screen
6. Run `npm run regenerate-pack` to translate some UI elements, like settings menu (the archive it builds is already translated in the released patch, so this only matters if you edit `archives/Rance10Pact_v1_04`)

Those three commands write straight into your game folder. To build into a folder instead, run all three at once:

```
npm run release
```

That puts one folder per text language into `build/release`: `en_gpt/` and `en_grok/`, each holding `Rance10.ain`, `Rance10EX.ex` and `Rance10Pact.afa`, and `jp/`, which holds one `Rance10.ain` — the game's own Japanese with the optional features over it and no translation anywhere. Each folder is a whole install: copy the contents of one of them into your game folder, over the files already there, and that is the patch. Each also carries a generated `README.md` saying which text it is, what the files are and what the optional features in it need — written by `modules/ReleaseReadme.js`, since a folder full of identically named files cannot show any of that by itself. `npm run release -- --text-lang=en_grok` builds just that one folder. The images are not in there — see two paragraphs down, they have no build command at all.

Where a build goes is two flags, and which text it carries is a third — all of them on `release`, and on any one of the three commands above:

```
node scripts/release.js                            # what npm run release runs: every language into build/release
node scripts/release.js --text-lang=en_gpt         # just that folder
node scripts/release.js --text-lang=en_grok        # just that one
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

There is more than one translation of the dialogue in here. `npm run regenerate-ain` builds the `en_gpt` one, the translation this repository has always shipped; `node scripts/ain.js --text-lang=en_grok` builds a second translation of the whole script, made in [the fork](https://github.com/IdOnThAvEaUsE69/rance-10-gpt-mtl-fork) by putting the Japanese through Grok, and `TEXT_LANG` in `.env` changes which one you get by default. (The npm spelling of the flag, `npm run regenerate-ain -- --text-lang=en_grok`, works in cmd.exe and bash but not in PowerShell, which eats the bare `--` and quietly builds the default instead.) Only the dialogue differs — the UI text, the card names and the images are the same either way. There is a third folder, `jp`, which is no translation at all: `node scripts/ain.js --text-lang=jp` builds the game's own Japanese with the `features/` patches over it and no English anywhere, for playing or testing a change to how the game behaves without installing a translation with it. See [docs/text-languages.md](docs/text-languages.md) for what a text language is made of and how to add one.

The images are English too, in `archives/Rance10Flat_v1_04` and `archives/Rance10CG2_v1_04`, and they are the one thing here with no command. `ar pack` rebuilds an archive out of every entry it holds rather than patching the one file you changed, so packing either of those needs the game's own copy of the thousands of images nobody translated — half a gigabyte the repository cannot carry. See [docs/image-archives.md](docs/image-archives.md) for how each is packed, and what a mistake costs you.

Character names and card labels are English too, but they cannot simply be translated in the data: a character's `識別名` and a card's `Id` double as the keys your save file stores rank and event progress under, so translating them makes every rank read back as zero. Instead `patches/card_names.jaf` patches the two display accessors to look the English text up in the `識別名情報` tree, keeping the keys Japanese. `npm run regenerate-ain` applies it, and nothing extra is needed to build.

The English text itself is generated by `npm run regenerate-card-names`, whose output is committed — you only need to re-run it after changing `glossaries/card_name_glossary.tsv`, `glossaries/mistranslated_names.json` or the `archives/Rance10EX_v1_04` tables it reads. See [docs/card-name-localization.md](docs/card-name-localization.md) for how it works and what breaks if you get it wrong.

The race on that same panel is English from `glossaries/race_name_glossary.tsv`, but as a patched function rather than patched text: six of the nineteen race names are also keys or names elsewhere — translating `モンスター` where it sits turns every monster card into a black rectangle — so the build overrides the accessor instead, the way `patches/card_names.jaf` does, and every string keeps its Japanese. `npm run regenerate-race-names` re-reads the race numbers out of the `.ain`; `npm run regenerate-ain` generates the `.jaf` and applies it. See [docs/race-names.md](docs/race-names.md).

The synopsis screen — the recap `あらすじモード` shows for an event you have already seen — is English from
`glossaries/summary_glossary.tsv`, all 4458 captions of it. `npm run regenerate-ex` writes them in as it builds, into a copy of
the source tree rather than into `archives/Rance10EX_v1_04/37_あらすじデータ.x` itself: the glossary is keyed by the Japanese,
so a table with the English written over it would match nothing on the next build. The one thing still Japanese on
that screen is the caption beside the panel, which is painted into an image in `Rance10CG4.afa` rather than stored as
text. See [docs/synopsis-screen.md](docs/synopsis-screen.md).

The four hint lines under an enemy's stats in battle are English too, from `glossaries/enemy_info_glossary.tsv`. They are string literals rather than dialogue, and they sit in the dump among every enemy's internal code name, so which ones they are is found in the code rather than by reading: `npm run regenerate-enemy-info` does that and writes `game/extracted/enemy_info_lines.v1.04.tsv`, which is committed and only needs re-running after the `.ain` changes. `npm run regenerate-ain` applies them. See [docs/enemy-status-lines.md](docs/enemy-status-lines.md).

That panel is also up more often than the game puts it there, if you ask for it. Everything on it — the race, the four hint lines, the capture and steal rates — is drawn by `EnemyInformationView`, and the game shows that view from exactly one place: the effect behind `アナライズ`, the Analyze skill, and nothing else. `features/enemy-panel/enemy_info_panel.jam` adds the same call to `SceneBattle@ShowRound`, so the panel comes up at the start of every round and stays up whether or not anybody in the party can Analyze. It is a `.jam` — one hand-assembled function — rather than a `.jaf` because the call is on a member of `SceneBattle`, and alice-tools' `.jaf` compiler resolves neither `this` nor a struct's own members inside an override. Switching it on is a file rather than a build: create `custom_mods\enemy_panel_on` in the game folder, beside `Rance10.exe`, and delete it to go back to the panel being what Analyze shows. `features/enemy-panel/enemy_info_panel.jaf` is the half that reads it, at the start of every round, so it takes effect without restarting the game. Whether it is built in at all is the other question, and a separate one: `npm run regenerate-ain` puts it in and `node scripts/ain.js --without=enemy-panel` leaves it out, which goes for a release folder too — every `Rance10.ain` a release builds carries the features, because the switch above is what decides whether this one does anything. `features/` is where those names come from — one folder per feature, this one's being `features/enemy-panel/`, which holds both files above and the `feature.js` that names them.

`patches/enemy_panel_cards.jam` draws one more thing on that panel, and this one is in every build: the two card Ids the panel draws — the card an enemy is captured as, and the one it can be stolen from — in English. They are Ids rather than names, the keys `CardGenerator` builds the captured card out of and the treasure chest is filled from, so translating them where they sit would break the capture and leave the panel looking right. `EnemyInformationView@SetParam` is patched instead, to run each Id through the same tree the card plates read, and every string keeps its Japanese. There is nothing to translate and nothing to switch on: the English is the plate's own, already there. It shared a file with the panel patch above until that became optional, and was split out then — this is translation, and leaving out a change to how the game plays should not cost you any of it. See [docs/card-name-localization.md](docs/card-name-localization.md).

The achievement names on the 実績 screen are English from `glossaries/trophy_name_glossary.tsv`, and the bonus each one grants from `glossaries/trophy_bonus_glossary.tsv`. A trophy's Id is both the string that screen draws and the key your save file records a completed one under, so translating it would read every achievement you have earned back as unearned and take the clear points and the permanent stat bonuses with it. `npm run regenerate-ex` writes the English in beside the Japanese instead, and `patches/trophy_names.jaf` — applied by `npm run regenerate-ain` — reads it back at the one label setter both the list and the panel go through; you need both commands, since either alone leaves the screen exactly as it was. A row is two columns, the name and a `★` bonus flag pinned to a fixed column by padding, and the build measures every name against what the Japanese uses and says which are over rather than cutting them. See [docs/trophy-names.md](docs/trophy-names.md).

The rest of `docs/` is the write-ups those paragraphs link to, plus the ones that nothing here builds. [docs/coherence-sweep.md](docs/coherence-sweep.md) is twelve sessions of reading the translated dialogue line by line by hand, kept for the taxonomy of errors it arrived at rather than as instructions to follow. [docs/treasure-chest-chance.md](docs/treasure-chest-chance.md) is a read of how the game decides whether a battle ends in a treasure chest — the bonuses that make up the chance, including the +50 a character's first kill of the quest is worth — written down because working it out of the code dump took longer than reading it back will. [docs/party-total-hp.md](docs/party-total-hp.md) is the same for the party's Total HP: where the number comes from, why rearranging the party mid-battle does not move it, what else in the game reads it, and the replacement formula worked out but not yet built. [docs/battle-experience.md](docs/battle-experience.md) is the same for the experience a battle pays out: the formula and its five bonuses, and why the characters who collect it are the ones standing in the party when the result screen appears rather than the ones who fought — so swapping the party in before the last hit hands the whole amount to characters who were not there. Four ways of changing that are costed at the end of it; none is built. [docs/clear-point-bonuses.md](docs/clear-point-bonuses.md) is a short note off the back of that one: what the new-game-plus points buy, and why spending them on extra party slots is the worst of the available splits. [docs/shuriken-target-choice.md](docs/shuriken-target-choice.md) is the furthest from built of them: whether the player could pick which of the enemy's queued actions a shuriken tries to cancel, instead of the game picking at random. The answer is that the icons in that row are already clickable objects that know their own index, so the cheap version is three files and no new UI — and that the version the question literally asks for, a chooser when the skill fires, needs a scene class the game has nothing to lend. It is an investigation and a low-priority todo, not a plan.
