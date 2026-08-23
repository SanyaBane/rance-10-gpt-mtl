# The `en_opus` dialogue retranslation

The script translated again, a scene at a time. `en_grok` -- the language this
one is rendered on top of -- was translated a line at a time, which is all the
repository had: `alice ain dump -t` gives `m[]` numbers and nothing around
them, so 270000 numbered fragments went out with no speaker, no scene, and
neither the line before nor the line after.

What that cost is visible without playing the game. Pronouns are assigned by
guess, because nothing on the line says who is speaking or who is spoken about.
Names drift, because a name recalled is not a name read. Every line was written
to a wrap budget of about 31 full-width characters when the message window
draws 24, so 18% of the rendered rows are wider than the box they are in. And
where the game plays one line to a player who made El a man and another to one
who made El a woman, the two halves were a fortnight apart and got their
English independently.

## What is different about how this one is made

`npm run extract-scenes` lays the work out: `build/scenes/en_grok/<function
id>.tsv`, one file per scene, with the cast and their genders at the top and
the speaker on every line. `docs/scene-driver.md` is the loop that gets those
translated and back.

What comes back lands in `scenes/` here, one file per scene, and
`dialogue.ain.txt` is generated from those by `npm run assemble-scenes`. Do not
edit the assembled file: it is rewritten whole from `scenes/` every run, so an
edit there is lost at the next assembly and, until then, is a second opinion
about a line with nothing saying where it came from.

## Coverage is a directory listing

A scene has been translated exactly when `scenes/<function id>.tsv` exists.
There is no ledger and no progress file to keep in step -- an interrupted run
leaves nothing half-written, and re-translating a scene overwrites one file.

Until the last scene lands this is a partial translation, and a build of it is
a normal thing to play: `scripts/regenerate_aai_txt.js` renders `en_grok`
underneath, so a line no scene file claims yet still comes out in English.

```
npm run assemble-scenes -- --text-lang=en_opus
node scripts/ain.js --text-lang=en_opus --out=build/scratch
```
