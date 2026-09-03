/**
 * The "new" badge on a text button, which translating the button takes away.
 *
 * `TextButton@Init` (FUNC 22890) sets the label the layout gave it and then
 * compares that same string against two literals:
 *
 *     SetText(text);
 *     if (text == "ＭＥＮＵ")  { m_newMarkView = new NewMarkView("Menu"); ... }
 *     else if (text == "部隊編成") { m_newMarkView = new NewMarkView("NewMarkFlagTypeLocal::PartyBonus"); ... }
 *
 * `NewMarkView@Init` reads that argument as a flag name -- `NewMarkFlagTypeLocal::`
 * prefixed ones are the local enum, everything else goes through
 * `NewMarkFlagTypeGlobal::Parse`, where `Menu` is 1 -- and the badge then follows
 * the flag: something unseen in the menu, a party bonus nobody has looked at.
 *
 * So the label on those two buttons is a display string *and* a lookup key, the
 * class of trap CLAUDE.md keeps a section for. Both were translated in the
 * archive years apart -- 部隊編成 to "Form Squad" in seven layouts, ＭＥＮＵ to
 * "Menu" in one -- and each translation silently switched its badge off. Nothing
 * looked broken: the button draws, the click works, and the badge is absent
 * exactly when there is nothing new, so its absence reads as "nothing new".
 *
 * The repository's usual answer is to keep the Japanese in the data and patch
 * the function that displays it. That does not work here, because the string
 * being compared *is* what the button displays: keeping the key means keeping
 * the Japanese label. So the comparison is patched instead --
 * patches/new_mark_buttons.jam re-emits `TextButton@Init` with the two literals
 * reached through the function this file generates, which maps an English label
 * back to the Japanese key. The label the player sees is untouched, because
 * `SetText` has already run by the time the comparison happens.
 *
 * Matched by prefix rather than by the whole string, and this is the part worth
 * keeping: the party button's label is " Form\nSquad" -- a leading space and a
 * line break, both of them layout rather than words, and both already edited
 * once (0b842a319 "Give better format to Form Squad btn text"). A table of exact
 * strings would go stale the next time somebody nudges that spacing, and it
 * would go stale silently, which is the failure this file exists to stop. A
 * prefix survives it.
 *
 * docs/new-mark-buttons.md is the whole write-up.
 */
import * as fs from "fs";
import * as path from "path";
import {BUILD, ROOT} from "./Env.js";

/** Generated, so it goes to build/ beside the four other generated .jaf. */
export const NEW_MARK_JAF = path.join(BUILD, "new_mark_buttons.jaf");

/** The name the .jam resolves by CALLFUNC; the two have to agree. */
export const NEW_MARK_FUNCTION = "TextButtonNewMarkKey";

/** The UI archive, where every one of these labels is written. */
const PACT_DIR = path.join(ROOT, "archives", "Rance10Pact_v1_04");

/**
 * The two keys `TextButton@Init` compares against, and how to recognise a
 * translation of each.
 *
 * `labels` is compared whole and `prefixes` from the left. Which of the two a
 * key gets is a judgement about its label rather than a preference: "Menu" is a
 * word and nothing else in the archive starts with it, so it is matched whole;
 * the party button carries its own spacing inside the string and is matched by
 * prefix. Both lists are English -- the Japanese key needs no row, since the
 * unpatched comparison already matches it and this function hands anything it
 * does not know straight back.
 */
export const NEW_MARK_BUTTONS = [
    {
        key: "ＭＥＮＵ",
        flag: "NewMarkFlagTypeGlobal::Menu",
        badge: "anything new behind the menu",
        labels: ["Menu", "MENU"],
        prefixes: [],
    },
    {
        key: "部隊編成",
        flag: "NewMarkFlagTypeLocal::PartyBonus",
        badge: "a party bonus nobody has looked at",
        labels: [],
        prefixes: ["Form", " Form"],
    },
];

/** Every `.x` under the UI archive, in a stable order. */
const pactFiles = (dir = PACT_DIR) => fs.readdirSync(dir, {withFileTypes: true})
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((entry) => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            return pactFiles(full);
        }
        return entry.name.endsWith(".x") ? [full] : [];
    });

/**
 * What every TextButton in the archive is labelled with.
 *
 * A user component carries one string, `"<template>,<label>"`, and the engine
 * splits it on the comma before `Init` sees it -- so the label is everything
 * after the first comma, and a template name never has one.
 */
export const readTextButtonLabels = () => {
    const pattern = /"オブジェクト名",\s*"TextButton",\s*"パラメータ",\s*"([^"]*)"/g;
    const labels = [];
    for (const file of pactFiles()) {
        const text = fs.readFileSync(file, "utf-8");
        for (const [, parameter] of text.matchAll(pattern)) {
            const comma = parameter.indexOf(",");
            if (comma < 0) {
                continue;
            }
            labels.push({label: parameter.slice(comma + 1), file: path.relative(ROOT, file)});
        }
    }
    return labels;
};

/** Whether one label is the button this entry describes. */
const claims = (entry, label) => label === entry.key
    || entry.labels.includes(label)
    || entry.prefixes.some((prefix) => label.startsWith(prefix));

/**
 * The mapping function, as text.
 *
 * Anything unrecognised comes back unchanged, so every other button in the game
 * -- and both keys still in Japanese -- reaches the comparison exactly as it did
 * unpatched. The worst case of a wrong row here is a missing badge, never a
 * changed label: nothing this returns is ever drawn.
 */
export const renderNewMarkButtonsJaf = async () => {
    const labels = readTextButtonLabels();

    const body = [];
    const stale = [];
    let translated = 0;
    let japanese = 0;
    for (const entry of NEW_MARK_BUTTONS) {
        const mine = labels.filter(({label}) => claims(entry, label));
        const inJapanese = mine.filter(({label}) => label === entry.key).length;
        japanese += inJapanese;
        translated += mine.length - inJapanese;
        /*
         * No button in the archive answers to this key at all. Either the layout
         * lost the button, or its label was translated to something neither the
         * game nor the rows above recognise -- and the second is the one this
         * check is here for, because it costs a badge and shows no other sign.
         */
        if (mine.length === 0) {
            stale.push(entry);
        }
        for (const label of entry.labels) {
            body.push(`\tif (text == ${JSON.stringify(label)}) {`,
                `\t\treturn ${JSON.stringify(entry.key)};`, "\t}");
        }
        if (entry.prefixes.length > 0) {
            const test = entry.prefixes
                .map((prefix) => `text.StartsWith(${JSON.stringify(prefix)})`)
                .join(" || ");
            body.push(`\tif (${test}) {`, `\t\treturn ${JSON.stringify(entry.key)};`, "\t}");
        }
    }

    const text = [
        "/*",
        " * The Japanese key behind an English button label, for the \"new\" badge.",
        " *",
        " * GENERATED by the build from the table in modules/NewMarkButtons.js against",
        " * the labels in archives/Rance10Pact_v1_04/ -- edit that module, not this file.",
        " * patches/new_mark_buttons.jam is what calls it, and",
        " * docs/new-mark-buttons.md says why the comparison had to be patched at all.",
        " */",
        "",
        "/*",
        " * One button label, back the way TextButton@Init compares against it. Every",
        " * label this does not know -- which is every other button in the game, and",
        " * both keys still in Japanese -- comes back unchanged, so the comparison is",
        " * the one the game shipped with.",
        " *",
        " * Nothing drawn goes through here: SetText has already run by the time the",
        " * .jam reaches this call.",
        " */",
        `string ${NEW_MARK_FUNCTION}(string text)`,
        "{",
        ...body,
        "\treturn text;",
        "}",
        "",
    ].join("\n");

    return {
        text,
        report: `${translated} English new-mark button labels`
            + (japanese ? `, beside ${japanese} still Japanese and matching unpatched` : ""),
        overlong: [],
        misnamed: [],
        stale,
    };
};
