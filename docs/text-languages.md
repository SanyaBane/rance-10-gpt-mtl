# The text the game is built with

The repository carries the English translation of the game's dialogue as a
folder, and builds it — or the Japanese the game shipped with, which is a folder
too:

| Text language | What it is |
|---|---|
| `en_grok` | the default: the whole script put through Grok in [the fork](https://github.com/IdOnThAvEaUsE69/rance-10-gpt-mtl-fork) |
| `jp` | no translation at all: the game's own script, with the `features/` patches over it |

There were two until `en_gpt` was removed; the section at the end of this file
says what it was and how to read it back.

Each folder under `text_languages/` carries a `text_language.js` saying what it
is and whether there is English in it, and a README saying where its text came
from and what has been done to it since.

```
npm run regenerate-ain                     # the language .env names, or en_grok
node scripts/ain.js --text-lang=jp         # the features, and no English at all
```

`TEXT_LANG` in `.env` sets the one you build most; the flag overrides it. The
game directory holds a single `Rance10.ain`, so a build installs one text
language and switching means running the build again. Whichever way you choose,
the build says which one it rendered before it writes anything — worth a
glance, because there is one way to get this wrong quietly:

`npm run regenerate-ain -- --text-lang=jp` is the npm spelling and it works
in cmd.exe and in bash, but **PowerShell eats the bare `--`**, so npm never sees
the flag and you get the default with no complaint. In PowerShell, call `node
scripts/ain.js --text-lang=jp` — or quote it, `npm run regenerate-ain '--'
--text-lang=jp`.

## What a text language is

A directory under `text_languages/`, holding a `text_language.js` and, if it is
a translation, nothing but data in one of two shapes. A corpus, which is what a
translation run through the API leaves behind:

```
text_languages/en_grok/gpt_outputs/          the v1.00 translation, one JSON per chunk of lines
text_languages/en_grok/gpt_outputs_v104/     the same for lines v1.04 added
text_languages/en_grok/mistranslated_names.json  optional, see below
```

Or a finished patch, which is what a translation done by hand in a chat window
leaves behind -- there was never a corpus, only the file being pasted into:

```
text_languages/<name>/dialogue.ain.txt      m[<line>] = "<text>", the v1.04 numbering already
text_languages/<name>/mistranslated_names.json   optional, the same as above
```

Nothing here is in that shape at the moment -- `en_grok` arrived that way and was
moved into a corpus -- but the build still reads it, and it is the cheaper way
to bring a translation in.

`dialogue.ain.txt` decides which it is: if the file is there the two folders are
not read, and neither is the v1.00 to v1.04 mapping, because a patch is written
against the numbering the game already uses. Two things follow from a patch
naming only the lines it has an opinion about. A line it skips would play in
Japanese, so the default text language is rendered underneath and shows through
the gaps -- the build says how many lines that was. And its own line breaks are
dropped and re-wrapped here, since they were measured against whatever window
the other build had in mind.

The shape is not a property of the translation, only of how it arrived, and a
patch can be moved into the other one. That is what happened to `en_grok`: what
the folder holds is the `en_gpt` corpus with the grok text written over it, line
number for line number, so the Grok translation could be corrected the way this
repository had always corrected `en_gpt` -- a chunk file at a time, with the
Japanese next to the English and `scripts/find_mistranslations.js` able to read
it. Its README says what the move cost, which is nine lines out of 269617
rendering differently from the patch it was made from.

Everything else is shared and lives outside `text_languages/`, because it is not
what the translations disagree about:

- `game/ain/Rance10.v1.00.ain.json` and `game/ain/Rance10.v1.04.ain.json` map a
  line number in the older dump onto the same line in the current game;
- `patches/system_cherry_picks.v1.04.ain.txt` is menu and UI text (`s[...]` entries),
  hand-fixed and appended last so it wins over everything;
- `modules/TextNormalization.js` decides where lines wrap, and it is not a
  matter of taste: the wrap budget carries a safety margin because text that
  overshoots is clipped by the message window rather than wrapped. A line that
  opens with a full-width space keeps it through the wrap, since that is an
  indent sitting the continuation of a quote under the 「 that opened it and not
  a gap between words;
- `patches/card_names.jaf`, `archives/Rance10EX_v1_04`, `archives/Rance10Pact_v1_04` and the image folders
  are not dialogue at all.

So there is one pipeline, not one per text language. Adding another translation
is adding a folder: either a `dialogue.ain.txt`, or the two corpora in the format
`scripts/translate_chunks.js` writes, an object with
`output_parsed.translationLines` holding
`{lineNumber, originalJapaneseLine, translatedEnglishLine}`.

## The one with no text

`jp` is a text language whose folder holds no text, because the text is already
in the `.ain` this repository patches. Its `text_language.js` says
`translated: false`, and every build reads that rather than looking for English
that was never there: no dialogue is rendered, no race names are generated, and
none of `patches/card_names.jaf`, the generated `build/race_names.jaf` or
`patches/enemy_panel_cards.jam` is applied. What is left is the game's own
script with the `features/` patches over it.

Two things follow, and both are useful rather than awkward:

- with no features selected, what it builds is the game's own `Rance10.ain`,
  byte for byte — the way back out of a modified one;
- a feature has to be buildable without a translation, or this build is the one
  nobody tests. Nothing under `features/` may depend on a string the English
  build renders.

There is no Japanese `Rance10EX.ex` or `Rance10Pact.afa`. The tables under
`archives/` are the game's data with the English written into them and there is
no untranslated copy here, so a Japanese build is one file and whatever the game
folder already holds is what stays.

## Names are shared, unless a language insists

`glossaries/mistranslated_names.json` is not translation text. It is a repair
pass: where the Japanese names a character and the English does not spell them
the canonical way, the known misspelling is replaced. The same file names the
characters on the card plates through `scripts/generate_card_names.js`, so it
has to be shared — a text language that renamed people in its dialogue alone
would contradict the cards its own build installs. Two translations of the same
script got a name wrong in different ways, which is why the table lists several
misspellings against one canonical spelling; what a text language is allowed to
differ in is the wording.

If a text language does need its own answer, put a `mistranslated_names.json`
next to its text with just the entries it disagrees about. It is layered over
the shared table by Japanese name: the canonical spelling is taken from the
language, and the known misspellings of both are merged, so a language never has
to restate the whole list. Nothing uses it at the moment. `en_grok` did, for the
two names its own translation run chopped in half, until those were written out
of its records: a defect in the text belongs in the text, and the overlay was
holding the place only for as long as that text was a patch nobody could edit.

## Build products

`build/regenerated.<lang>.ain.txt` and `build/unmapped.ain.json` are generated,
and `build/` is gitignored whole. The patch file is named per text language on
purpose — switching languages should not leave you reading the other one's text,
and a generation that fails should not pass off a stale file as the build you
asked for.

## The one that was removed

`en_gpt` was the translation this repository shipped from the beginning, and the
default until `en_grok` replaced it: 4805 + 85 chunk files under
`text_languages/en_gpt/`, from a translation run dated October 2025, with every
correction made to them since. It was removed because nobody built it any more,
and because a second corpus under the same file names is a standing invitation
to read, grep and edit the copy that is not played.

Removing it costs nothing that git does not keep. The folder is reachable at the
`en_gpt-final` tag, which is the last commit carrying it, and its objects were
already in the pack — deleting it makes the working tree 77 MB lighter and the
clone not one byte smaller.

What is worth reaching back for is a line. `en_grok` was built out of that
corpus file for file, so the two share their file names but for one, their line
numbers and the Japanese beside them, and a diff shows the English and nothing
else:

```
git show en_gpt-final:text_languages/en_gpt/gpt_outputs/184850_184910.json
```

Its own README is at `en_gpt-final:text_languages/en_gpt/README.md`, and the log
of the coherence sweep over its v1.04 half — twelve sessions in July 2026, read
by hand, never finished — at
`en_gpt-final:text_languages/en_gpt/coherence-sweep-log.md`. What outlasted that
sweep is the method, and that is in [coherence-sweep.md](coherence-sweep.md)
rather than in the deleted folder.
