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

**`・` is katakana.** The middle dot that separates a given name from a surname
sits at U+30FB, inside the block `mentions()` tests, so `リセット・カラー` and
`パパデマス・シルサブン` read as one long katakana run and the name inside them is
refused. It costs nothing while the pass is only *reporting*, and it costs lines
the moment something *sweeps* on the same guard: seven of the 13 that
`0c4e4d14` nearly left behind were a middle dot, and the other six were the wrap.
A sweep wants `mentions()` **or** a plain `includes()`, over a ±2 window.

**The counts above are not invariants.** Unlike the bake check, which must report
0 and means something is wrong when it does not, these numbers move with where
each guard is drawn. A rebuilt filter on 2026-08-22 reported 9566 rather than
9435 at the raw stage and 69 rather than 53 on the first slice below. What to
trust is the shape — six classes, roughly these sizes, in this order — rather
than the digits.

## The slices worth reading

Filtering down to a residue and reading it top to bottom is still the wrong
shape of work. What pays is asking the residue two specific questions — and
then knowing which names neither question can reach.

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

The bigger of the two, and the one the checker only ever reached **sideways**: it
complained that a line did not name Neplacus, and the reason turned out to be
that the corpus spells him `Neplakus`, one letter from the `Neplakas` the table
already lists. `921dd29c` is 40 lines of that, and `55f2f8d5` is 88 more where
`Cruche` sat one letter from the listed `Cruce`.

Asked for on purpose it is: for every entry, the lines whose English carries a
word *near* one of that entry's spellings without being any of them — edit
distance 1 for a form of five letters or fewer, 2 above that. Three screens make
it readable, and each removes a class the search would otherwise be drowned by:

| Screen | Without it |
|---|---|
| plurals and possessives count as the spelling | the loudest finding is `fiend` → `fiends`, 451 lines the repair pass produces on purpose |
| a word that is any other name is not a near miss | `saizel` → `hawzel`, which is the *other* slice |
| an ordinary English word, by how much of its corpus-wide use falls on lines naming this character | `yell` → `well`, `leah` → `yeah`, `darkes` → `darkness` |

That found **1052 lines over 87 names**, and the useful cut through them is what
share of the character's own lines already spell the canonical.

| Share | What it is | Done in |
|---|---|---|
| 90% and up | a stray, nothing to decide | `0c4e4d14` — 45 names, 60 spellings, 181 records |
| 60–89% | a whole scene translated the other way | `b836a9cd` — 17 names, 28 spellings, 356 records |
| under 60% | the corpus's own majority disagrees with the table | 23 names, open |

The middle band is the one worth recognising, because it is not scattered slips.
`Melpheis` is exactly `m[164301]`-`m[164489]` and `Melphees` exactly
`m[164501]`-`m[165198]`, one scene apiece with the same character in both;
`Kachusha` is `m[60289]`-`m[60950]` and nowhere else. A chunk was translated, the
model held one spelling for the length of it, and the next chunk held another.

The bottom band is a decision about which spelling is canonical rather than a
repair, and `Xacalite`, `Thalgo`, `Silbarrel` and `Notongatsu` do not occur in
the corpus at **all**.

**Read the table as people, not as entries.** Two entries can be one person with
two misspelling lists, and `normalizeNames` asks each entry only about its own
`shortNameJpn` — so a spelling listed on one of them is unreachable from a line
whose Japanese carries the other. `Caroria` is on かろ and not on カロリア, and 86
lines kept it through every build (`8c59c4fd`). Grouping by canonical is also
what stops those lines being reported as naming somebody else.

**A piece of a listed misspelling is not listed.** `replaceWords` applies a
misspelling whole, so a table that carries `Rerikofu` and `Rerikof-chan` repairs
neither of the four lines writing bare `Rerikof` — and the search does not report
them either, because a search that splits a spelling into words to catch short
forms counts `rerikof` as something the entry already knows. Unreachable by the
pass and invisible to the check, which is the worst of both: it reads in the
table like it works. Found only by sweeping レリコフ and looking at what was left
(`b836a9cd`).

**And the sweep's guard has to be wider than `mentions()`.** Widening it caught
13 lines in `0c4e4d14` that the strict form left behind, and every one of them
was a line that should be fixed.

**Recount the band after a sweep.** `レリコフ` was reviewed into `0c4e4d14`'s list
and left out of the array it edited, so 45 of the 46 names shown were swept.
What found it was re-running the band against the corpus as it then stood: a
finished band reports only what was deliberately left in it, and anything else
in there is a miss.

### Short names are not covered by any of this

The floor that keeps ordinary English out also keeps short names in the dark, and
it hid the single largest spelling defect in the corpus. ＜エール＞ was spelled
four ways over 152 lines — `<Eel>` 86, `Yale` 45, `<Elle>` 12, `<Eal>` 9, against
1304 that say `El` — and the search reported 12 of them. Both blind spots are the
same threshold: forms under four letters are never built, so `El`, `Eel` and
`Eal` are nothing to compare against, and `Yale` against the listed `Yell` is two
edits where a four-letter form is allowed one.

Lowering either floods the report with ordinary English, so the answer is a
separate pass rather than a looser one. Eleven entries have a canonical under
four letters — `El`, `Lia`, `Sel`, `Lei`, `Ex`, `Io`, `Am`, `Kou`, `Cu`, `Pi-R` —
and only ＜エール＞ has been looked at (`dce75bb9`).

### A key that carries more than the name

The same problem from the other end, and it is not about length at all. An entry
matches on its `shortNameJpn` exactly, so whatever else that key carries — a
bracket, a title — has to be in the line too, and every line naming the character
without it is reachable by no entry. Two of them, both found by sweeping the
bracketed or titled form and looking at what was left over:

| Key | Bare form | Lines | Spelled |
|---|---|---|---|
| `＜エール＞` | `エール` | 194 | `Yell` 80, `Ale` 25, `Earl` 7, `Eal` 3, `El` never |
| `魔女リクチェル` | `リクチェル` | 22 | `Richel` 18, `Rikucher` 3, `Ricchel` 1 |

Neither is a spelling question until somebody decides what the bare form is. Both
are also invisible to every check in this repository, including the ones this
file describes, because a check that starts from the table starts from the key.

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
