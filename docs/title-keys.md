# The title under a speaker's name, and the twelve names that took it away

The line under a character's name in the dialogue window -- `Adventurer`,
`Rance Castle Head Maid`, `Kayblis Faction Fiend` -- comes from `Ｔ肩書き`, and
it is not a field of anything. The function is 313 compares of one string
argument, each answered by returning the slot that holds that character's title:

```
; Ｔ肩書き
; ARG  0: ▲名前 : string
; RETURN: string
    .LOCALREF ▲名前 / S_PUSH s[3474] / S_EQUALE   ; ランス
    ...           / S_PUSH s[10623] / RETURN      ; 世界総統　魔人討伐隊隊長
```

So the block of ~250 titles in `patches/system_cherry_picks.v1.04.ain.txt` is
sitting next to a block of 313 **keys**, in one file, in the same
`s[N] = "..."` syntax, and nothing about a line says which it is.

## How the argument reaches it

`AdvNamePlate@InnerCreate` is the only caller, and it asks three times:

```c
jobName = Ｔ肩書き(faceCgName);                                   // 乱義／基本
if (jobName == "") jobName = Ｔ肩書き(GetCharacterNameFromCgName(faceCgName));
if (jobName == "") jobName = Ｔ肩書き(name);                      // what ●台詞 passed
```

The second arm is the one that fires for a character speaking behind a standing
portrait, which is most of them, and what it hands over is **Japanese**: the CG
name comes out of the archive, and `GetCharacterNameFromCgName` is a
`String.Split` on `／` taking element 0 -- the same `<name>／` prefix that keys
`archives/Rance10EX_v1_04/48_立ち絵名札マッピング情報.x`.

The third arm hands over whatever `●台詞` was given, which for a translated
scene is English. It matches because both sides move together: the scene pushes
the same slot the compare reads.

## What went wrong

Fifteen of the 313 keys had been translated. Nine of them are also the name
`FriendPanel@Name::get` returns and the `name` argument of a `●台詞` in a dozen
scenes; two more are also a buff's `desc` in `Ｐ支援状態追加`; four had no second
role at all. Every one of the fifteen stopped matching on the second arm the day
it was translated, and nothing said so -- the plate still drew a name, from the
table above, with the line under it simply gone.

The four with no second role went back to Japanese in the cherry-picks, with a
`; Not s[N]` note apiece: the three Kalar ghosts `s[10684]`, `s[10687]`,
`s[10690]`, and `s[10872]` レッドアイ魔法魔物兵. Nothing drew them, so the
translation had bought nothing to begin with.

The other eleven are wanted in English, so they keep it, and
`build/title_keys.jaf` hands the Japanese back to the one function that needed
it:

```c
string TitleLookupKey(string name)
{
	if (name == "乱義") return "Rangi";        // s[3192]
	...
	return name;
}

override string Ｔ肩書き(string name)
{
	return super(TitleLookupKey(name));
}
```

`super()` is the original chain, so the 302 keys nobody translated are untouched,
and a name the game has never heard of still comes back as the empty string
rather than as anything drawn. The third arm keeps working too: it is handed the
English already, which the table says nothing about and which reaches `super()`
unchanged.

This is `modules/PartyBonusIcons.js` again with a different consumer -- a slot
that is already English and one caller that wanted the Japanese -- and it is
generated for the same reason. There is no decision in the table: the English is
whatever the cherry-picks say today, paired with the Japanese of the same slot
out of the committed dump, so a name edited there cannot go stale here.

## Where the key list comes from

Which slots are keys is in the code and nowhere else, so
`scripts/extract_title_keys.js` reads it out once:

```
npm run regenerate-title-keys
```

into `game/extracted/title_keys.v1.04.tsv`, beside the three other tables a
build reads back out of the game. The scan checks the four-instruction
`.LOCALREF ▲名前` preamble rather than taking every `S_EQUALE` in the function,
so a version that starts testing a global there would not quietly file the
global's string as a character.

## What this does not fix

A title is still lost when the *game's own* Japanese is not what the compare
wants -- but that cannot happen, because both sides of every untouched compare
come out of the same `.ain`. What can happen is the reverse of the fifteen: a
key translated in some *other* file. Nothing translates these keys but the
cherry-picks, and `modules/TitleKeys.js` reports any key slot the dump has no
string for, which is what a version bump would look like.
