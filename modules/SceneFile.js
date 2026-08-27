/**
 * The scene file format: five columns, one row per m[] line.
 *
 *     # 30324	サーナキア／キャライベントＡ	cg
 *     * Sanakia Drelshkaf	サーナキア	Female
 *
 *     10	Sanakia Drelshkaf	基本	「ううむ……	「Hmm...
 *     11	+		　読んでおかないと……」	　I need to read it...」
 *
 * The m[] number, the speaker, the portrait's state, the Japanese, the
 * English. "+" in the speaker column is the row above; "-" is narration; "?"
 * is a message with no speaker that is not narration either; a trailing "~" is
 * a thought. A blank line starts a new speech bubble.
 *
 * The state is what the portrait is doing while the line is said -- 怒り,
 * 泣き, ため息, 全裸／笑顔 -- taken from the 立ち絵 the bytecode names and left
 * in Japanese, because the column beside it is Japanese and whoever reads one
 * reads the other. It is the one thing the player can see that a line of text
 * cannot say, and 怒り over a flat sentence is the difference between a
 * translation that keeps the speaker and one that files a report.
 *
 * **It is written only where it changes**, the way "+" is: an empty cell is
 * the state of the row above, and 基本 is a value like any other, so a
 * character going back to their default face says so rather than falling
 * silent. Two thirds of the game's speech rows are 基本 and repeating that on
 * each of them would bury the 37% that are not. Rows with no portrait at all
 * -- narration, and a message with no speaker -- carry an empty cell and do
 * not interrupt the run: the portrait stays on screen while the narrator
 * talks.
 *
 * A line beginning "> " is not a row. It opens a run of lines the game plays on
 * only one of El's two routes, and closes with "> end":
 *
 *     > male
 *     191964	Tokugawa Tone	「＜エール＞兄様、か……	「So, big brother <El>...
 *     > female
 *     191966	Tokugawa Tone	「＜エール＞姉様、か……	「So, big sister <El>...
 *     > end
 *
 * "male" and "female" are El's gender, which the player chooses, and never the
 * speaker's -- Tone is a woman on both routes. 1228 lines in 82 scenes are
 * inside one of these, and both halves have to be translated: the player sees
 * one of them and never both, so an English sentence written once and used
 * twice throws the branch away. modules/SceneScript.js finds them and
 * modules/SceneAcceptance.js refuses a translation that flattens one.
 *
 * Both the input written by scripts/extract_scenes.js and the translation
 * written back beside it are this format, which is the point: a diff between
 * the two is exactly the change in the English, and the Japanese column travels
 * with the translation as a checksum. If a game version moves the line numbers,
 * assembling the patch says so instead of the game saying it.
 *
 * One reader and one writer, here, because there are now three callers and the
 * format has one property that punishes a second implementation: a tab inside a
 * cell moves every column after it. 2929 of the game's messages hold one, 17 of
 * them mid-line.
 */

/**
 * A tab would move the columns; a backslash is doubled so the escape stays
 * unambiguous.
 *
 * No message and no translation holds a backslash today, so today the doubling
 * is dead weight. It is here because a new translation is exactly the thing
 * that could bring the first one, and the cost of finding that out later is a
 * corpus that unescapes to something nobody wrote.
 */
export const escapeCell = (text) => text.replaceAll("\\", "\\\\").replaceAll("\t", "\\t");

export const unescapeCell = (text) => text.replaceAll(/\\(.)/g, (_, char) => char === "t" ? "\t" : char);

/**
 * A scene file, parsed.
 *
 * Split on either ending. These are written with LF, and a checkout with
 * core.autocrlf=true -- the Windows default, and what a fresh clone of a scenes
 * repository does -- hands every line back with a trailing \r. Splitting on
 * "\n" alone does not fail loudly: it appends the \r to the last column, which
 * is the English, and leaves a check that reads the Japanese column perfectly
 * happy while every translation on the page has grown a character.
 *
 * @return {{
 *     functionId: number,
 *     name: string,
 *     flags: string[],
 *     cast: {speaker: string, stand: string, gender: string}[],
 *     rows: {
 *         lineNumber: number,
 *         speaker: string,
 *         state: string,
 *         japanese: string,
 *         english: string,
 *         startsUtterance: boolean,
 *         route: "male" | "female" | null,
 *     }[],
 * }}
 *
 * The state comes back as it is written -- empty on every row that does not
 * change it -- rather than carried forward, which is what the speaker column
 * does with "+" and for the same reason: a reader that wants the running value
 * can keep it, and one that only wants to know where something changed, which
 * is both of the readers there are, would have to undo the carrying.
 */
export const parseSceneFile = (text) => {
    let functionId = 0;
    let name = "";
    let flags = [];
    const cast = [];
    const rows = [];
    let blankBefore = false;
    let route = null;
    for (const line of text.split(/\r?\n/)) {
        if (!line) {
            blankBefore = true;
            continue;
        }
        if (line.startsWith("> ")) {
            const opened = line.slice(2).trim();
            route = opened === "end" ? null : opened;
            // Deliberately not touching blankBefore: a marker sits between the
            // blank line and the row it introduces, and swallowing the blank
            // would move a speech bubble's boundary.
            continue;
        }
        if (line.startsWith("# ")) {
            const [id, sceneName, sceneFlags] = line.slice(2).split("\t");
            functionId = Number(id);
            name = unescapeCell(sceneName ?? "");
            flags = (sceneFlags ?? "").split(",").filter(Boolean);
            blankBefore = false;
            continue;
        }
        if (line.startsWith("* ")) {
            const [speaker, stand, gender] = line.slice(2).split("\t");
            cast.push({speaker, stand: unescapeCell(stand ?? ""), gender: gender ?? "?"});
            blankBefore = false;
            continue;
        }
        const cells = line.split("\t");
        if (cells.length !== 5) {
            throw new Error(`scene ${functionId}: ${cells.length} columns, not 5, in ${JSON.stringify(line)}`);
        }
        rows.push({
            lineNumber: Number(cells[0]),
            speaker: cells[1],
            state: unescapeCell(cells[2]),
            japanese: unescapeCell(cells[3]),
            english: unescapeCell(cells[4]),
            startsUtterance: blankBefore,
            route,
        });
        blankBefore = false;
    }
    return {functionId, name, flags, cast, rows};
};

/**
 * The rows of a scene gathered back into the speeches they were split out of.
 *
 * A speech is a run of `m[]` joined by `message::detail::R` and ended by
 * `message::detail::A`, which is where the click is, so its rows are all on
 * screen together and where the breaks fell is where Japanese typesetting fell
 * at twenty-four full-width characters. That is a fact about the source and not
 * about the utterance, which is why a translation is asked for and stored per
 * speech and put back into the rows afterwards by modules/SpeechRows.js.
 *
 * **A route boundary splits a speech**, even though the bytecode does not. Four
 * of the 209 route blocks open in the middle of one, and the two halves are
 * played to different players -- handing them over joined would ask for one
 * English sentence to cover both, which is the branch thrown away. Each half
 * keeps its own rows and is laid out into them separately.
 *
 * The continuation indent comes off: it sits the text under the 「 that opened
 * the quote and belongs to the row, not to the sentence. SpeechRows puts it
 * back on whichever rows end up being continuations.
 *
 * @param {ReturnType<parseSceneFile>} scene
 * A speech's state is the first its rows name, and almost always the only one:
 * the portrait changes inside an utterance in 372 of the game's 166172
 * speeches. So the state belongs to the speech, which is what the translation
 * is asked for, and handing it over costs nothing beyond the word itself.
 *
 * @return {{
 *     lineNumber: number,
 *     speaker: string,
 *     state: string,
 *     route: "male" | "female" | null,
 *     rows: number[],
 *     japanese: string,
 *     english: string,
 * }[]}
 */
export const speechesOf = (scene) => {
    const speeches = [];
    for (const row of scene.rows) {
        const open = speeches[speeches.length - 1];
        if (!open || row.startsUtterance || (row.route ?? null) !== open.route) {
            speeches.push({
                lineNumber: row.lineNumber,
                speaker: row.speaker,
                state: "",
                route: row.route ?? null,
                rows: [],
                japanese: "",
                english: "",
            });
        }
        const speech = speeches[speeches.length - 1];
        speech.state ||= row.state ?? "";
        speech.rows.push(row.lineNumber);
        speech.japanese += row.japanese.replace(/^　/, "");
        speech.english += (speech.english && row.english ? " " : "")
            + row.english.replace(/^　/, "");
    }
    return speeches;
};

/**
 * The same scene back as text, byte for byte.
 *
 * Exact enough to be worth asserting: scripts/extract_scenes.js checks that
 * rendering what it parsed reproduces what it wrote, over all 5433 files. That
 * one comparison covers the escaping, the column count, the blank lines and the
 * line endings at once, and it is the only check that fails when the reader and
 * the writer drift apart rather than when the data does.
 *
 * @param {ReturnType<parseSceneFile>} scene
 * @param {Map<number, string>} [english] replaces the English column when given
 */
export const renderSceneFile = (scene, english) => {
    const lines = [`# ${scene.functionId}\t${escapeCell(scene.name)}\t${scene.flags.join(",")}`];
    for (const member of scene.cast) {
        lines.push(`* ${member.speaker}\t${escapeCell(member.stand)}\t${member.gender}`);
    }
    let route = null;
    for (const row of scene.rows) {
        if (row.startsUtterance) {
            lines.push("");
        }
        // After the blank line and before the row, so the marker reads as a
        // heading over the block. Four of the 209 blocks open in the middle of
        // a speech and get no blank line, which is the game's doing rather than
        // this format's.
        if ((row.route ?? null) !== route) {
            route = row.route ?? null;
            lines.push(`> ${route ?? "end"}`);
        }
        const text = english?.get(row.lineNumber) ?? row.english;
        lines.push([row.lineNumber, row.speaker, escapeCell(row.state ?? ""),
            escapeCell(row.japanese), escapeCell(text)].join("\t"));
    }
    return lines.join("\n") + "\n";
};

/** <function id>.tsv, zero-padded so a directory listing is in scene order. */
export const sceneFileName = (functionId) => String(functionId).padStart(6, "0") + ".tsv";
