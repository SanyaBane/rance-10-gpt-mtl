# reliable-cooking

Two skills fail part of the time for no reason you can play around. `調理準備`, Meal Preparation —
Martina's Lv7 skill and Varen's second — and `菓子作り`, Sweets Making, both hand out the meal-ticket
buff, and both roll for it first: 75% and 80%, from the `確率` column of `11_スキルデータ.x`. A lost
roll is the `ＭＩＳＳ（skill activation failed）` you see in the battle log. Turn this feature on and
both always work.

## Turning it on and off

The game looks for `custom_mods\reliable_cooking_on`, beside `Rance10.exe`, as the skill fires.
Create that empty file and both skills always succeed; delete it and they roll the way they always
did. Neither direction needs the game restarted.

A release folder ships that file already made. An install straight into a game folder does not —
those files are the player's.

## Leaving it out of a build

It is built into `Rance10.ain` by default, and does nothing until the file above exists:

```
node scripts/ain.js --without=reliable-cooking
```

## How it works

It is not an accuracy roll, so `必中` would not help — both skills are `処理` 7, Preprocess, with
nothing to hit. So this replaces the number instead of the outcome, in `PlayerSkill@PerSkill::get`,
where `RAND(100) <= 100` cannot lose.

A `.jam` again, for the same reason as the enemy panel, plus one worth knowing if you write the next
one: the obvious hook, `SceneBattle@CheckSkillPer`, takes the action as an argument and needs no
`this` at all — and it *still* will not compile as a `.jaf`, because `action.Skill` is a property
rather than a field, and alice-tools reaches neither. `cooking_skill_chance.jaf` defines
`CookingSkillPercent` and has to be compiled before the `.jam` is assembled.

## Why the descriptions still say 75% and 80%

They are rows of `archives/Rance10EX_v1_04/11_スキルデータ.x`, and a `.x` edit cannot be left out of a
build the way a `.jaf` or a `.jam` can. Correcting them would describe a change that some builds do
not have, so both descriptions are left alone: with the switch on, ignore them.

[docs/cooking-skill-chance.md](../../docs/cooking-skill-chance.md) has the four functions the roll
passes through, and why 75 is the game's own number rather than a forward-port that lost a digit.
