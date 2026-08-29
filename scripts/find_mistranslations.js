import * as fs from "fs/promises";
import * as path from "path";
import {readSceneRows} from "../modules/Corpus.js";
import {BUILD, ensureBuild} from "../modules/Env.js";
import {readNameTable} from "../modules/NameNormalizer.js";
import {textLangDir, textLangName} from "../modules/TextLanguages.js";

// Reported against the same table and the same dialogue a build of this text
// language would use, so what it finds is what the build would leave misspelled.
const mistranslated_names = await readNameTable(textLangDir(textLangName()));

// Every row of the scenes, which is where the dialogue lives. It was 4891 chunk
// files until those went, and the rows carry the game's own Japanese rather than
// a copy somebody retyped -- so a name this reports as missing is missing from
// the line the game actually plays.
const rows = await readSceneRows(textLangName());

const getSentenceNames = (sentence) => {
    const matches = sentence.matchAll(/[^^.!?] ?([A-Z][\w-]+(?:\s+[A-Z][\w-]+)*)/g);
    return [...matches].map(m => m[1])
};

const charToSentencedToCount = {};

for (const row of rows) {
    for (const nameRecord of mistranslated_names) {
        if (!row.japanese.includes(nameRecord.shortNameJpn)) {
            continue;
        }
        const sentence = row.english;
        const shortNameEng = nameRecord.shortNameEng;
        if (sentence.includes(shortNameEng) || shortNameEng === "Hanny" && sentence.toLowerCase().includes("hannies")) {
            continue;
        }
        const alreadyRecorded = nameRecord.knownMistranslations.some(mistranslation => {
            return sentence.includes(mistranslation);
        }) || shortNameEng === "Lia" && sentence.includes("ria");
        const sentenceNames = getSentenceNames(row.english);
        if (!alreadyRecorded) {
            charToSentencedToCount[shortNameEng] = charToSentencedToCount[shortNameEng] ?? {};
            for (const sentenceName of sentenceNames) {
                charToSentencedToCount[shortNameEng][sentenceName] = charToSentencedToCount[shortNameEng][sentenceName] ?? 0;
                ++charToSentencedToCount[shortNameEng][sentenceName];
            }
            if (shortNameEng !== 'Kou' &&
                shortNameEng !== 'Lia' &&
                shortNameEng !== 'Lei' &&
                shortNameEng !== 'Am' &&
                shortNameEng !== 'Root' &&
                shortNameEng !== 'Rance' &&
                sentenceNames.length > 0 &&
                shortNameEng !== "Sioux"
            ) {
                console.log("Missing name in translation: " + row.scene + " m[" + row.lineNumber + "]" + " - " + shortNameEng + " | " + sentenceNames.join(",") + " | " + row.english);
            }
        }
    }
}

const getCharOccurrences = (sentencedToCount) => {
    return Object
        .values(sentencedToCount)
        .reduce((a,b) => a + b, 0);
};

const getSortedMistranslations = (sentencedToCount) => {
    return Object
        .entries(sentencedToCount)
        .sort((a,b) => b[1] - a[1])
        .map(a => a[0]);
};

const charEntries = Object.entries(charToSentencedToCount)
    .sort((a,b) => getCharOccurrences(b[1]) - getCharOccurrences(a[1]));

charEntries.forEach(entry => entry[1] = getSortedMistranslations(entry[1]))

// Every spelling this found, per character, commonest first -- the console
// output above is the same thing filtered down to what is worth reading. Not
// read by anything; it is here to be looked at when deciding what belongs in
// glossaries/mistranslated_names.json.
ensureBuild();
await fs.writeFile(path.join(BUILD, "mistranslation_candidates.json"), JSON.stringify(charEntries), "utf-8");
