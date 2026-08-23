/**
 * The scene file format: four columns, one row per m[] line.
 *
 *     # 30324	サーナキア／キャライベントＡ	cg
 *     * Sanakia Drelshkaf	サーナキア	Female
 *
 *     10	Sanakia Drelshkaf	「ううむ……	「Hmm...
 *     11	+	　読んでおかないと……」	　I need to read it...」
 *
 * The m[] number, the speaker, the Japanese, the English. "+" in the speaker
 * column is the row above; "-" is narration; "?" is a message with no speaker
 * that is not narration either; a trailing "~" is a thought. A blank line
 * starts a new speech bubble.
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
 *         japanese: string,
 *         english: string,
 *         startsUtterance: boolean,
 *     }[],
 * }}
 */
export const parseSceneFile = (text) => {
    let functionId = 0;
    let name = "";
    let flags = [];
    const cast = [];
    const rows = [];
    let blankBefore = false;
    for (const line of text.split(/\r?\n/)) {
        if (!line) {
            blankBefore = true;
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
        if (cells.length !== 4) {
            throw new Error(`scene ${functionId}: ${cells.length} columns, not 4, in ${JSON.stringify(line)}`);
        }
        rows.push({
            lineNumber: Number(cells[0]),
            speaker: cells[1],
            japanese: unescapeCell(cells[2]),
            english: unescapeCell(cells[3]),
            startsUtterance: blankBefore,
        });
        blankBefore = false;
    }
    return {functionId, name, flags, cast, rows};
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
    for (const row of scene.rows) {
        if (row.startsUtterance) {
            lines.push("");
        }
        const text = english?.get(row.lineNumber) ?? row.english;
        lines.push([row.lineNumber, row.speaker, escapeCell(row.japanese), escapeCell(text)].join("\t"));
    }
    return lines.join("\n") + "\n";
};

/** <function id>.tsv, zero-padded so a directory listing is in scene order. */
export const sceneFileName = (functionId) => String(functionId).padStart(6, "0") + ".tsv";
