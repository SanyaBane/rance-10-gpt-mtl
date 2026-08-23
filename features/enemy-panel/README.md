# enemy-panel

The panel showing an enemy's race, the four hint lines and the capture and steal rates normally
appears in one situation only: when somebody casts `アナライズ`, the Analyze skill. Turn this feature
on and it comes up at the start of every round instead, whether or not anyone in the party can
Analyze at all.

## Turning it on and off

The game looks for `custom_mods\enemy_panel_on`, beside `Rance10.exe`, at the start of every round.
Create that empty file and the panel comes up; delete it and the panel goes back to being what
Analyze shows. Neither direction needs the game restarted.

A release folder ships that file already made. An install straight into a game folder does not —
those files are the player's.

## Leaving it out of a build

It is built into `Rance10.ain` by default, and does nothing until the file above exists:

```
node scripts/ain.js --without=enemy-panel
```

## How it works

The panel is drawn by `EnemyInformationView`, which the game calls from exactly one place — the
Analyze effect. `enemy_info_panel.jam` adds the same call to `SceneBattle@ShowRound`.

It has to be a `.jam`, one hand-assembled function, rather than a `.jaf`, because the call is made
on a member of `SceneBattle`, and alice-tools' `.jaf` compiler resolves neither `this` nor a
struct's own members inside an override. `enemy_info_panel.jaf` is the other half: it defines
`EnemyInfoPanelEnabled`, which reads the switch file, and it has to be compiled before the `.jam` is
assembled — `feature.js` lists them in that order for that reason.

The same panel's two card Ids in English are `patches/enemy_panel_cards.jam`, which is not part of
this feature: it is translation, applied to every build, so leaving the feature out costs nobody the
English. The root [README.md](../../README.md) has that one.
