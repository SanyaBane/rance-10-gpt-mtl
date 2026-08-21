# Pointing the name checker at the corpus

`createNameChecker` in `modules/NameNormalizer.js` reads
`glossaries/mistranslated_names.json` the other way round from the repair pass:
instead of swapping a known misspelling for the right name, it reports every line
whose Japanese names a character and whose English does not spell them the
canonical way. It was written for the hand-written glossaries — a few thousand
rows between `enemy_info_glossary.tsv`, `race_name_glossary.tsv` and
`summary_glossary.tsv` — and it runs over those at every build, because at that
size a person can read what it says and decide.

The corpus is 275 373 lines, and nobody had ever pointed the checker at it. Doing
so reports **9435 complaints**, which is not a list anybody reads. Almost all of
it is not a mistake, and the whole value of the exercise was working out *which*
kinds are not, because the residue after that is small, specific, and has already
produced 187 lines of real repairs.

This is that calibration. It is written down because it exists nowhere else: the
script is not committed, for the same reason the bake check and the alignment
check are not, and without this file the next pass derives all of it again.

## The six things that are not mistakes

Taken off in this order, because each one is cheaper than the one after it and
each makes the next one readable.

| What comes off | Roughly | Why it is not a mistake |
|---|---|---|
| a name with more than one entry | 1600 | the entries are two steps of one repair, or two registers of one name |
| the sentence wrapped | 2000 | the name is in one record's Japanese, the English of the sentence is in the next |
| a short form of a full name | 916 | the table holds the whole name, the prose uses part of it |
| a plural or a possessive | 130 | `Hannies` does not contain `Hanny` |
| a pronoun instead of the name | most of the rest | good English, and not decidable by machine |
| a name that is also an ordinary word | 88 | `Magic`, `Root`, `Arms`, `Reset`, `Fiend` |

### A name is satisfied by any of its spellings

Three Japanese names carry more than one entry, and seven canonical spellings are
reached from more than one Japanese name. Either way the checker, which asks each
entry separately, complains about a line the other entry is happy with.

＜エール＞ is the clearest of them. Its first entry folds a dozen renderings —
`<Yell>`, `<Ale>`, `<Aire>`, `Eiru` — into the full-width `＜エール＞`, and its
second turns that into `El`. The first entry's canonical is therefore Japanese,
and no English line will ever contain it: it is the one entry in the table whose
`shortNameEng` is not Latin, and every line it touches is a complaint by
construction. リア splits the other way, into `Lia` and `Queen Lia`, and whichever
one a line uses the other entry objects. カロリア and かろ are two Japanese
spellings of Caloria with two entries and two misspelling lists.

So the test is **whether the English carries any spelling the name knows** —
every canonical of every entry under it, plus every listed misspelling — and an
entry whose canonical is not Latin is skipped as a folding step rather than a
name.

### The sentence wrapped

`normalizeNames` reads the `originalJapaneseLine` of the record it is repairing
and nothing else, so a sentence split across two records leaves its name on one
of them and its English on the other. `docs/baked-name-repairs.md` describes the
sweep that found 474 such lines; the checker trips over the same thing from the
other side, and at far greater volume, because it complains where the sweep only
repairs.

The guard is the same one: look for the name in the neighbouring records too.
A window of ±2 is what the sweep settled on — ±1 found 477 of the wrapped lines
and ±2 another 56 — and the same window is right here.

### A short form of a full name

The table often holds a whole name where the prose has every reason to use part
of it: `Dokuganryuu Masamune` against a line that says Masamune, `Agireda
Kosabusshi Zonna Abona` against one that says Agireda. 916 complaints are that,
and they are not errors — the cherry-picks make the same choice on purpose,
which is why `s[3211]` says "Lelikov" where the table says "Lelikov Helman" and
the build's own checker complains about it forever.

Count them as their own class rather than as errors. They are worth having a
number for, because a *wrong* short form hides among them, but they are not a
list to work through.

**Split on the hyphen as well as on the space.** A filter that splits only on
spaces treats `Nagata-kun` as one word, so a line writing "Nagata" reads as a
fresh misspelling rather than as a short form — which is how 長田君 got onto a
findings list it did not belong on.

### Plurals and possessives

`Hannies` does not contain `Hanny`, and `Hanny's` does. The repair pass already
knows this from the writing side — `pluralisesWithS` in `NameNormalizer.js` is
there so that it produces "Hannies" rather than "Hannys" — and the checker needs
the reading half of it: test each spelling with `y/ie/ies/s/es/'s` on the end
before deciding the name is absent.

### A pronoun instead of the name

Most of what is left. `　ランスの愚痴ばっかり` at `m[566]` is
"you only complained about him", which is better English than repeating the name
would be, and there is no rule that separates it from a line that dropped the
name by accident. It is the floor the filtering reaches, and it is why the useful
output is a slice rather than a list.

### A name that is also an ordinary English word

`ルート` is Root and also a route. `魔人` is Fiend and `fiend` is a word.
`アームズ`, `マジック`, `リセット` are Arms, Magic and Reset. The checker compares
with `toLowerCase()`, so an ordinary lower-case `magic` satisfies it and no
complaint fires — which is silence bought at the price of missing `Lemay` where
the table says `LeMay`.

Tightening it to a case-sensitive comparison is the right move and it costs 88
complaints, all of them the ordinary word: `カロリアは赤ん坊を両腕で` came out as
"held one baby in both arms", and `アームズ` wants Arms. **The case is what
settles it** — a character's name is capitalised in English prose and a common
noun is not.

## Three traps in the filtering

**A capital at the start of a phrase proves nothing.** After `「`, after `（`,
after a full stop, or at the start of a record, every word is capitalised.
A case rule that does not exclude those positions lets half the noise straight
back in, and worse, it lets it back in looking like signal.

**`mentions()` does not guard hiragana or a short katakana word.** It refuses a
katakana word glued into a longer katakana run, which is what makes リア usable
at all, and there is nothing it can do about a hiragana name: かろ is Caloria and
`よかろう` is 40 lines of "Very well". ルート is guarded as katakana and still
collides with the ordinary loanword — `　本来はポピンズ用のルート故、天井がな」` at
`m[31002]` is "originally built for Poppins, so the ceiling is low", and no
guard exists that would tell that ルート from Root's. These have to be recognised,
not filtered.

**The counts above are not invariants.** Unlike the bake check, which must report
0 and means something is wrong when it does not, these numbers move with where
each guard is drawn. A rebuilt filter on 2026-08-22 reported 9566 rather than
9435 at the raw stage and 69 rather than 53 on the first slice below. What to
trust is the shape — six classes, roughly these sizes, in this order — rather
than the digits.

## The two slices worth reading

Filtering down to a residue and reading it top to bottom is still the wrong
shape of work. What pays is asking two specific questions of the residue.

### The English names a different character

The Japanese names one character of the table; the English names a different one,
and does not name the first. **53 lines**, and the table has to be read as
*people* rather than as entries for the question to make sense — カロリア and かろ
are one person, so a line saying "Caroria" is not naming somebody else.

This is the slice that produced `15e667ed`: 51 lines where シーラ was translated
Sill 38 times, ウルザ was Uspira 7 times and 乱義 was Rance 6 times. `b8cf8540`
is three more of the same — Menad for Tilde, Kayblis for Kaybnyan, and six
records where `56` was Isoroku.

Every one of these is a line a player reads as being about the wrong person, and
none of them is findable by the repair pass, which only ever looks at whether a
name is spelled right.

### The character's own name is spelled off the table

Not built yet, and it is the next thing to build. The two most productive finds
of the whole pass came out of it **sideways**: the checker complained that a line
did not name Neplacus, and the reason turned out to be that the corpus spells him
`Neplakus`, one letter from the `Neplakas` the table already lists.

`921dd29c` is 40 lines of that, and `55f2f8d5` is 88 more where `Cruche` sat one
letter from the listed `Cruce`. Both misses were a single edit away from an entry
that would have caught them, which means the class is worth searching for on
purpose: for each of the table's 274 entries, find the lines whose English
carries a word *near* a canonical or a known misspelling without equalling
either — edit distance 1 to 2, with ordinary English words screened out.

## What the checker cannot see

It knows the names in `mistranslated_names.json` and nothing else. Terminology —
titles, place names, the words a role is called — is invisible to it, and
terminology drifts exactly the way names do.

総統 is the example, and it is only visible at all because a role word ended up
in a table of names by accident. The table says `Supreme Leader`,
`glossaries/summary_glossary.tsv` says `Supreme Leader`, and 1055 of the 1167
corpus lines whose Japanese carries 総統 say `Supreme Leader` — while `s[10623]`
of `patches/system_cherry_picks.v1.04.ain.txt` says `World Leader`, which is
the only place in the repository that does. 大将軍 divides the same way:
the table's `Great General`
against the file's `Great Monster General` in four slots. Both show up in the
26 complaints the cherry-picks check reports and cannot decide.

Every term *not* in that table gets no report at all, from any checker in this
repository. Those are found by reading.
