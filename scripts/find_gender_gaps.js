/**
 * Which speakers the dialogue names that glossaries/character_genders.md does not.
 *
 *   node scripts/find_gender_gaps.js               # the whole list, worst first
 *   node scripts/find_gender_gaps.js --generic     # only the 汎用… crowd portraits
 *   node scripts/find_gender_gaps.js --named       # only the ones that look like people
 *   node scripts/find_gender_gaps.js --speaker=Bezeleye   # one of them, with lines to read
 *
 * scripts/extract_scenes.js writes the gender of every speaker onto the cast
 * line of every scene file, which is the whole reason the table is read at all:
 * a translator working a scene needs to know whether the character talking is a
 * he or a she before writing the first pronoun. A speaker the table does not
 * list gets "?" -- honest, and useless.
 *
 * That script says how many such speakers there are and stops, because it has a
 * scene corpus to write. This says which, how much they talk, what portrait
 * they wear, and whether the table already holds somebody with nearly that
 * name, so the gap can be closed row by row instead of guessed at. It reads the
 * same two sources extract_scenes does -- the code dump for the speakers, the
 * glossary for the answers -- so the two can never disagree about what is
 * missing.
 *
 * The list splits in two and the halves want different work. A speaker with a
 * name is a character, and the game's own 性別 column answers most of them --
 * 8_カードデータ.x keys a card by the portrait it wears, so a plate name joins
 * straight onto it. A crowd portrait has no person behind it to look up, and
 * the answer is a policy about what a nameless soldier's pronoun should be;
 * those go in glossaries/portrait_genders.tsv, keyed by the portrait rather
 * than by the plate name, because 汎用ゼス男魔法兵 and 汎用ゼス女魔法兵 wear one
 * plate name between them and are not the same answer.
 *
 * --speaker is for the case where neither says anything: 船長 is a ship's
 * captain rather than Captain Vanilla, and the only way to find that out is to
 * read what the portrait says. It prints the lines rather than the counts.
 */
import {flagValue, hasFlag} from "../modules/Argv.js";
import {run} from "../modules/AliceTools.js";
import {checkCardGenders, oneGender, readCardGenders} from "../modules/CardGenders.js";
import {readCharacterGenders} from "../modules/CharacterGenders.js";
import {readSceneRows} from "../modules/Corpus.js";
import {width} from "../modules/EastAsianWidth.js";
import {loadGameJapanese} from "../modules/LineNumbers.js";
import {createNameplateResolver} from "../modules/Nameplates.js";
import {readPortraitGenders} from "../modules/PortraitGenders.js";
import {readScenes} from "../modules/SceneScript.js";
import {textLangName} from "../modules/TextLanguages.js";

/**
 * A portrait the game itself marks as drawn for anybody rather than for
 * somebody.
 *
 * The prefix never lies -- no named character carries it -- but it does not
 * catch every crowd portrait either: 学者, 山賊, 奴隷商人 and 老兵 are a role
 * without the prefix, and 汎用少女 and 少女 are the same crowd girl written
 * both ways. So this splits the list for reading, and what actually decides
 * where a row goes is whether the key names a person.
 */
const GENERIC = /^汎用/;

/** Lines to print for --speaker before it stops being reading and starts being a dump. */
const SAMPLE = 40;

/** How the key spells the character's own gender, where it does at all. */
const genderInKey = (stand) => {
    const male = stand.includes("男");
    const female = stand.includes("女");
    if (male === female) {
        return "";
    }
    return male ? "男 in the key" : "女 in the key";
};

/**
 * Rows of the table that might be the same person, for a human to judge.
 *
 * Word overlap rather than a substring test, because the interesting near-miss
 * is a name the table holds in a different length -- "Mix" against "Mix Tou",
 * "Uzume" against "Kentou Uzume" -- and a substring test also matches "Man"
 * against every "Manri" in the cast. Never a verdict: half of these are two
 * different characters who share a given name, which is exactly what wants
 * looking at.
 */
const candidates = (name, genders) => {
    const words = new Set(name.split(/[^\p{L}\p{N}]+/u).filter(Boolean).map(word => word.toLowerCase()));
    const found = [];
    for (const [listed, gender] of genders) {
        if (listed === name) {
            continue;
        }
        const theirs = listed.split(/[^\p{L}\p{N}]+/u).filter(Boolean).map(word => word.toLowerCase());
        if (theirs.some(word => words.has(word))) {
            found.push(`${listed} ${gender}`);
        }
    }
    return found;
};

/**
 * Pad a column to the widest cell in it, counting a portrait key's kana as the
 * two columns a terminal draws them in. String.padEnd counts code points, which
 * puts the notes column of every row with a Japanese key in a different place.
 */
const columns = (rows) => {
    const widths = rows[0].map((_, index) => Math.max(...rows.map(row => width(String(row[index])))));
    return rows.map(row => row
        .map((cell, index) => (index === row.length - 1
            ? String(cell)
            : String(cell) + " ".repeat(widths[index] - width(String(cell)))))
        .join("  ")
        .trimEnd());
};

await run(async () => {
    const lang = textLangName();
    const {genders, malformed} = await readCharacterGenders();
    const {scenes, dumped} = await readScenes();
    if (dumped) {
        console.log("Dumped the game's code to build/ -- delete build/ to take it again.");
    }

    /** English name -> what is known about the speaker behind it. */
    const speakers = new Map();
    for (const scene of scenes) {
        const here = new Set();
        for (const line of scene.lines) {
            if (!line.speaker) {
                continue;
            }
            const speaker = speakers.get(line.speaker)
                ?? {name: line.speaker, lines: 0, scenes: 0, stands: new Set(), lineNumbers: []};
            ++speaker.lines;
            speaker.stands.add(line.stand.split("／")[0]);
            speaker.lineNumbers.push(line.lineNumber);
            if (!here.has(line.speaker)) {
                here.add(line.speaker);
                ++speaker.scenes;
            }
            speakers.set(line.speaker, speaker);
        }
    }

    const {genders: portraitGenders} = await readPortraitGenders();
    // The same two lookups scripts/extract_scenes.js does, in the same order,
    // so this lists exactly the portraits that end up with "?" on a cast line
    // -- and by portrait rather than by name, since a name can cover two
    // portraits and have an answer for only one of them.
    const unanswered = (speaker) => [...speaker.stands]
        .filter(stand => !genders.has(speaker.name) && !portraitGenders.has(stand));

    const gaps = [...speakers.values()]
        .filter(speaker => unanswered(speaker).length)
        .sort((a, b) => b.lines - a.lines);

    const one = flagValue("speaker");
    if (one !== undefined) {
        const speaker = speakers.get(one) ?? [...speakers.values()]
            .find(candidate => candidate.stands.has(one));
        if (!speaker) {
            console.error(`No speaker called ${JSON.stringify(one)}. The name is the English one the`
                + " plate table gives, or the Japanese portrait key it is resolved from.");
            return 1;
        }
        const japaneseByLineNumber = await loadGameJapanese();
        const english = new Map((await readSceneRows(lang)).map(row => [row.lineNumber, row.english]));
        console.log(`${speaker.name}: ${speaker.lines} lines in ${speaker.scenes} scenes,`
            + ` behind ${[...speaker.stands].join(", ")}`);
        console.log(`  the table says ${genders.get(speaker.name) ?? "nothing about them"}`);
        for (const lineNumber of speaker.lineNumbers.slice(0, SAMPLE)) {
            console.log(`  ${lineNumber}\t${japaneseByLineNumber.get(lineNumber) ?? ""}`
                + `\t${english.get(lineNumber) ?? ""}`);
        }
        if (speaker.lineNumbers.length > SAMPLE) {
            console.log(`  ... and ${speaker.lineNumbers.length - SAMPLE} more`);
        }
        return 0;
    }

    const isGeneric = (speaker) => unanswered(speaker).every(stand => GENERIC.test(stand));
    const wanted = hasFlag("generic") ? gaps.filter(isGeneric)
        : hasFlag("named") ? gaps.filter(speaker => !isGeneric(speaker))
            : gaps;

    const total = (list) => list.reduce((sum, speaker) => sum + speaker.lines, 0);
    console.log(`${gaps.length} of ${speakers.size} speakers get "?" on a cast line, ${total(gaps)} lines`);
    console.log(`  ${gaps.filter(isGeneric).length} generic portraits, ${total(gaps.filter(isGeneric))} lines`);
    console.log(`  ${gaps.filter(s => !isGeneric(s)).length} named characters,`
        + ` ${total(gaps.filter(s => !isGeneric(s)))} lines`);
    console.log("");

    const {byPortrait, byIdentity} = await readCardGenders();
    /** What the game's own 性別 column claims for this speaker's portraits. */
    const cardsSay = (stands) => [...new Set(stands.flatMap(stand =>
        [...byPortrait.get(stand) ?? byIdentity.get(stand) ?? []]))];

    const rows = [["lines", "scenes", "speaker", "portrait", "cards", "note"]];
    for (const speaker of wanted) {
        // Only the portraits still without an answer: a speaker whose other
        // costume is settled is not a reason to reprint the settled one.
        const stands = unanswered(speaker);
        const notes = [
            ...isGeneric(speaker) ? ["generic"] : [],
            ...stands.map(genderInKey).filter(Boolean),
            ...candidates(speaker.name, genders),
        ];
        rows.push([speaker.lines, speaker.scenes, speaker.name, stands.join(" "),
            cardsSay(stands).join("+") || "-", [...new Set(notes)].join("; ")]);
    }
    for (const line of columns(rows)) {
        console.log(line);
    }

    const answered = wanted.filter(speaker => oneGender(new Set(cardsSay([...speaker.stands]))));
    console.log(`\n${answered.length} of these ${wanted.length} the game's own 性別 column answers`
        + ` on its own -- but see modules/CardGenders.js on what it answers about.`);

    // The other direction, which is the check on the table rather than on the
    // gap: the game and the glossary both name these people, so a row that has
    // drifted shows up here and nowhere else.
    const resolve = await createNameplateResolver();
    const {compared, disagree} = await checkCardGenders(genders, resolve);
    console.log(`${compared - disagree.length} of ${compared} speakers both tables name agree outright`);
    for (const complaint of disagree) {
        console.log(`  ${complaint}`);
    }

    for (const complaint of malformed) {
        console.warn(`character_genders.md row cannot be read: ${complaint}`);
    }
    return 0;
});
