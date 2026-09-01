# Where the English started an utterance the game did not

```
node scripts/find_speech_splits.js                  # the report
node scripts/find_speech_splits.js --class=crammed  # one class, all of it
node scripts/find_speech_splits.js --scene=033028   # one scene
```

A speech is a run of `m[]` rows, and the game decides more than how many there
are. A row whose Japanese opens `「` rather than carrying the continuation
indent starts a **fresh utterance** -- a new bubble-line, which the player reads
as a beat. `033028` gives 「したらさぁ、いつでもどこでも一心同体！…」 two rows and
`「は？　魔王退治？」` the third to itself.

The English there did not. It spilled the first utterance onto the third row and
put the second beside it:

```
「したらさぁ、いつでもどこでも一心同体！   「If that's the case, we're one and the same
　一緒にいるのが筋ってもんじゃない？」    　anytime, anywhere! Isn't it natural for us to be
「は？　魔王退治？」                     　together?」 「Huh? Defeating the Demon King?」
```

What the player gets is `together?」 「Huh? …」` -- a closing bracket and an
opening one in the middle of a line, which reads as a typo -- and the pause the
game drew with a row is gone.

## Three of the twelve put words in the wrong mouth

`033076`, `033310` and `033381` are the same shape with a speaker change under
it. In each, El Mofus's silent `「…………。」` is one row and the reply is the
next, by somebody else, and the English started the reply on El's row:

```
m[225336] El Mofus      「…………。」                 「............」 「You're the one who
m[225337] Zance Leazas  「お前が集めた癖に何言ってやがる」  　gathered us, so what are you saying?」
```

That is worth separating from the cosmetic half. A `」 「` mid-row is ugly; a
character delivering four words of somebody else's line is wrong.

## The three classes

| class | what it is | found |
|---|---|---|
| `invented` | the English closes one utterance and opens another where the game's Japanese has no second utterance anywhere in the speech | 1 |
| `crammed` | the boundary is real and on the wrong row | 6 |
| `indented` | the row's Japanese opens `「` and its English begins with the continuation indent, saying it carries on above | 5 |

`invented` is worst because it is the only one that changes what the game says
rather than where it says it. `035886`'s
「その上、悪い奴らの / 秘密の取引現場を見てしまったので / 命を狙われる我々だ」 is one
sentence over three rows and came back as `bad men」 「making a secret deal,` --
a speaker boundary the game never wrote. It was also the cheapest to mend: four
characters deleted, one row touched.

## Why the neighbouring reports read 0 on all twelve

Worth knowing in both directions, because it is the third time this repository
has found a class hiding between two reports.

[speech-gaps.md](speech-gaps.md)'s `shifted` wants one of two signals -- a
thought answered with speech, or a row of nothing but dots. Neither fires here.
Its width classes are content: every row involved sits between 15 and 30 against
a backlog edge of 35.39, so nothing folds and nothing clips.

[speech-brackets.md](speech-brackets.md) asks the **speech** whether its brackets
balance, deliberately -- that file says why the question is never asked of a row
-- and in all twelve they do. The same marks are present; they are on the wrong
rows. The one exception is `035886`, which that report did see as `extra`, and
mending it took the report from 532 to 531.

So the question this asks is a third one, and what makes it answerable is what
made the other two answerable: a scene file carries the game's own Japanese row
by row, so a row's English can be held against the row it sits on rather than
against the record it came from.

## What it deliberately does not ask

**Whether the English should have a boundary the Japanese lacks.** A translator
may split one Japanese sentence into two English ones inside a speech and be
right to. `invented` reports those too, and reading them is the price of
catching the ones that put words in the wrong mouth.

**How the rows are divided.** Moving words between the rows of one speech is
allowed and normal -- [message-window.md](message-window.md) is why -- so a row
merely divided differently from the Japanese is not a finding. Only the utterance
boundary is.

## The drafts are most of it, again

The first run read 192 rows and **185 were in `t…` scenes**, the scenario
documents the writer handed the scripter, where the notes quote dialogue inline
and nobody reads the result off a screen. The same leading-`t` test
`modules/SpeechGaps.js` uses holds them out, and the report says the number
rather than dropping it: "12" and "12, plus 64 speeches nobody will read" are
different facts about the same patch.

That is now three reports in a row where the draft scenes were the majority of
the raw signal. It is worth applying the test before counting rather than after
being surprised by the total.

## Mending them

All twelve were laid out again by hand, 31 rows across 11 scenes. Eight were
pure redistribution -- the same words, different rows. Three lost a word each,
because the utterance the Japanese puts on a single row has a single row to fit
in and the English did not: `do you want` from `033131`, `even` from `033190`,
`so` from `033310`, each worth between 0.4 and 1.8 full-width characters against
the edge. Two capitals were restored mid-repair (`If` → `if` inside a sentence,
`what` → `What` at the start of one), and `035886` lost its invented brackets.

`scripts/effective_map.js` read 31 changed, 0 gone, 0 added against 31 edited
rows, which is the check that the rows landed where they were meant to.
