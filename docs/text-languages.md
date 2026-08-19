# The text the game is built with

The repository carries two English translations of the game's dialogue, a
folder each, and builds whichever one you ask for:

| Text language | What it is |
|---|---|
| `en_gpt` | the default, the translation this repository has always shipped |
| `en_grok` | a second translation of the whole script, made in [the fork](https://github.com/IdOnThAvEaUsE69/rance-10-gpt-mtl-fork) by putting the Japanese through Grok |

Each folder under `text_languages/` carries a README saying where its text came
from and what has been done to it since.

```
npm run regenerate-ain                     # the language .env names, or en_gpt
node scripts/ain.js --text-lang=en_grok    # this one, just this once
```

`TEXT_LANG` in `.env` sets the one you build most; the flag overrides it. The
game directory holds a single `Rance10.ain`, so a build installs one text
language and switching means running the build again. Whichever way you choose,
the build says which one it rendered before it writes anything — worth a
glance, because there is one way to get this wrong quietly:

`npm run regenerate-ain -- --text-lang=en_grok` is the npm spelling and it works
in cmd.exe and in bash, but **PowerShell eats the bare `--`**, so npm never sees
the flag and you get the default with no complaint. In PowerShell, call `node
scripts/ain.js --text-lang=en_grok` — or quote it, `npm run regenerate-ain '--'
--text-lang=en_grok`.

## What a text language is

A directory under `text_languages/`, holding nothing but data, in one of two
shapes. A corpus, which is what a translation run through the API leaves behind:

```
text_languages/en_gpt/gpt_outputs/           the v1.00 translation, one JSON per chunk of lines
text_languages/en_gpt/gpt_outputs_v104/      the same for lines v1.04 added
text_languages/en_gpt/mistranslated_names.json   optional, see below
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
number for line number, so the Grok translation can be corrected the way this
repository has always corrected `en_gpt` -- a chunk file at a time, with the
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

So there is one pipeline, not one per text language. Adding a third translation
is adding a folder: either a `dialogue.ain.txt`, or the two corpora in the format
`scripts/translate_chunks.js` writes, an object with
`output_parsed.translationLines` holding
`{lineNumber, originalJapaneseLine, translatedEnglishLine}`.

## Names are shared, unless a language insists

`glossaries/mistranslated_names.json` is not translation text. It is a repair
pass: where the Japanese names a character and the English does not spell them
the canonical way, the known misspelling is replaced. The same file names the
characters on the card plates through `scripts/generate_card_names.js`, so it
has to be shared — a text language that renamed people in its dialogue alone
would contradict the cards its own build installs. Two translations of the same
script get a name wrong in different ways, and the table has to know both
spellings; what the two are allowed to differ in is the wording.

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
