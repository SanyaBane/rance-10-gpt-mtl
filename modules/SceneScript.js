/**
 * Which scene a line of dialogue is in, and who says it.
 *
 * None of this is in the text dump every other build step reads. `alice ain
 * dump -t` gives m[] numbers and nothing around them, which is why the corpus
 * is 270000 numbered fragments with no speaker and no scene -- the translation
 * was made a line at a time because a line at a time was all there was.
 *
 * The code dump has the rest of it. The game's scenes are functions with
 * Japanese names, and the ADV engine is driven by CALLFUNC:
 *
 *     ; サーナキア／キャライベントＡ
 *     FUNC 30324
 *         S_PUSH "サーナキア／基本／真剣"  (and three empty strings)
 *         CALLFUNC ●右台詞Ｂ
 *         MSG 0xa ; the line
 *         CALLFUNC R                     -- another row of the same speech
 *         MSG 0xb
 *         CALLFUNC A                     -- speech over, wait for the click
 *
 * So the portrait pushed before a ●…台詞… or ●…思考… names the speaker, R and A
 * say where one speech bubble ends and the next begins, and the function the
 * whole run sits in is the scene. 269676 of the 269677 messages are inside a
 * named scene function -- the one that is not is the engine's own empty m[1] --
 * and 5433 functions hold them.
 *
 * The dump has to be the macro form, `alice ain dump -c`. The -C --no-macros
 * form other scripts use writes operands as slot numbers, which is what
 * scripts/extract_enemy_info.js wants and exactly wrong here: it turns the
 * portrait into an integer that would need joining back through the text dump
 * to say a name. It is also 78 MB against 60. Either way the dump is a
 * by-product, written into build/ and regenerated in about three seconds, so
 * nothing here reads a file anybody has to keep.
 *
 * Two things this deliberately does not carry. The background and the music --
 * ■背景, ■音楽 -- are pushed the same way and could be had for free, but they
 * are set once at the top of a scene and say less about a line than its speaker
 * does. And the R/A grouping is reported as a flag per line rather than as
 * nested utterances, because everything downstream is still keyed by the m[]
 * number: the game wants its lines back one per number, however they were
 * translated.
 */
import * as fs from "fs/promises";
import * as path from "path";
import {AIN} from "./AinFiles.js";
import {alice} from "./AliceTools.js";
import {BUILD} from "./Env.js";
import {createNameplateResolver} from "./Nameplates.js";

/** The code dump, written here rather than kept: see the header. */
export const CODE_JAM = path.join(BUILD, "Rance10.v1.04.code.jam");

/**
 * A speech bubble with a portrait behind it. ●中台詞Ｂ, ●台詞Ａ, ●右思考Ｂ and
 * the rest differ by where the portrait sits and whether the line is thought
 * rather than said; both of those are answered separately below.
 */
const SPEECH = /^●.*(台詞|思考)/;

/** A thought, which the game draws in （） instead of 「」. */
const THOUGHT = /思考/;

/** Narration: the message window with nobody behind it. */
const NARRATION = /ト書き/;

/**
 * The branch that plays a line only to a player who made El a man, or only to
 * one who made her a woman.
 *
 *     S_PUSH "主人公は男"
 *     CALLFUNC 確認
 *     PUSH 1
 *     EQUALE
 *     IFNZ 0xa968ae     -- the branch
 *     JUMP 0xa968e4     -- past it
 *
 * 確認 itself is the one place these strings appear outside a scene: it reads
 * the global the ２部旅立ち choice writes -- tt[3], 1 for 男 and 11 for 女 -- and
 * compares it with 10. Everywhere else they are this shape, guarding 1228
 * messages in 82 scenes.
 *
 * Worth carrying because those messages are the one part of the script a
 * translation can silently flatten. 深根 says ＜エール＞兄様 on one route and
 * ＜エール＞姉様 on the other, and the two are adjacent lines with almost the
 * same text: a translator reading a whole scene sees them together and is
 * likelier to write one sentence twice than a translator who saw them a
 * fortnight apart. modules/SceneAcceptance.js is what refuses that.
 */
const ROUTE_FLAG = /^S_PUSH "主人公は(男|女)"$/;

/** "0xa968ae:" -- where a branch begins and where the jump past it lands. */
const LABEL = /^(0x[0-9a-f]+):$/;

/**
 * Produce the code dump if build/ does not already have one.
 *
 * Kept rather than re-dumped every run because three seconds is three seconds,
 * and thrown away by deleting build/. A game version bump cannot be served a
 * stale one silently: it moves every line number, and modules/LineNumbers.js is
 * what would notice.
 */
const ensureCodeDump = async () => {
    try {
        await fs.access(CODE_JAM);
        return false;
    } catch (error) {
        if (error.code !== "ENOENT") {
            throw error;
        }
    }
    const status = alice(["ain", "dump", "-c", "-o", CODE_JAM, AIN]);
    if (status !== 0) {
        throw new Error(`alice ain dump -c failed with status ${status}`);
    }
    return true;
};

/**
 * Every scene that holds a line of dialogue, in the order the .ain defines them.
 *
 * @return {Promise<{
 *     dumped: boolean,
 *     scenes: {
 *         functionId: number,
 *         name: string,
 *         lines: {
 *             lineNumber: number,
 *             stand: string | null,
 *             speaker: string | null,
 *             kind: "speech" | "thought" | "narration" | "other",
 *             continues: boolean,
 *             route: "male" | "female" | null,
 *         }[],
 *     }[],
 * }>}
 */
export const readScenes = async () => {
    const dumped = await ensureCodeDump();
    const resolveNameplate = await createNameplateResolver();
    const jam = await fs.readFile(CODE_JAM, "utf-8");

    const scenes = [];
    let scene = null;
    /** The last "; ..." seen, which is the name of the FUNC about to open. */
    let pendingName = null;
    /** Strings pushed since the last instruction that was not an S_PUSH. */
    let pushed = [];
    /** The ADV command a MSG will be displayed by, R and A excepted. */
    let command = null;
    /** Whether a MSG now would be another row of the speech already open. */
    let open = false;
    /** The gender branches a MSG here would be inside, innermost last. */
    const branches = [];
    /** A branch whose guard has been read and whose opening label has not. */
    let pending = null;

    const rows = jam.split(/\r?\n/);
    for (let index = 0; index < rows.length; ++index) {
        const line = rows[index].trim();
        if (!line) {
            continue;
        }

        const comment = /^; (.*)$/.exec(line);
        if (comment) {
            // "; RETURN: void" sits between the name and the FUNC, and a name
            // is only a name until the FUNC it belongs to has taken it.
            if (!comment[1].startsWith("RETURN:")) {
                pendingName = comment[1];
            }
            continue;
        }

        const func = /^FUNC (\d+)$/.exec(line);
        if (func) {
            scene = {functionId: +func[1], name: pendingName ?? "", lines: []};
            scenes.push(scene);
            pendingName = null;
            pushed = [];
            command = null;
            open = false;
            branches.length = 0;
            pending = null;
            continue;
        }

        const label = LABEL.exec(line);
        if (label) {
            if (pending?.opens === label[1]) {
                branches.push(pending);
                pending = null;
            }
            // The jump target closes the branch it jumped past. A while rather
            // than an if because two branches can share one exit.
            while (branches.length && branches[branches.length - 1].closes === label[1]) {
                branches.pop();
            }
            continue;
        }

        const push = /^S_PUSH "(.*)"$/.exec(line);
        if (push) {
            const flag = ROUTE_FLAG.exec(line);
            const opens = /^IFNZ (0x[0-9a-f]+)$/.exec(rows[index + 4]?.trim() ?? "");
            const closes = /^JUMP (0x[0-9a-f]+)$/.exec(rows[index + 5]?.trim() ?? "");
            // The guard is five instructions long and 確認 itself pushes the
            // same two strings without one, which is what the shape check keeps
            // out. Anything else wearing this shape would be a branch on El's
            // gender too, which is exactly what wants recording.
            if (flag && rows[index + 1]?.trim() === "CALLFUNC 確認" && opens && closes) {
                pending = {
                    route: flag[1] === "男" ? "male" : "female",
                    opens: opens[1],
                    closes: closes[1],
                };
            }
            pushed.push(push[1]);
            continue;
        }

        const call = /^CALLFUNC (.*)$/.exec(line);
        if (call) {
            // R opens another row of the speech already showing; A closes it
            // and waits for the click. Neither replaces the command in effect,
            // which is what still names the speaker on the row after an R.
            if (call[1] === "A") {
                open = false;
            } else if (call[1] !== "R") {
                command = {name: call[1], args: pushed};
            }
            pushed = [];
            continue;
        }

        // "MSG 0xa ; "the line"" -- the dump annotates the operand with the
        // text it stands for, so this cannot be anchored at the end.
        const message = /^MSG (0x[0-9a-fA-F]+|\d+)(?:\s|$)/.exec(line);
        if (message && scene) {
            const name = command?.name ?? "";
            const speech = SPEECH.test(name);
            const stand = speech ? command.args[0] || null : null;
            scene.lines.push({
                lineNumber: Number(message[1]),
                stand,
                speaker: stand ? resolveNameplate(stand) : null,
                kind: speech
                    ? (THOUGHT.test(name) ? "thought" : "speech")
                    : NARRATION.test(name) ? "narration" : "other",
                continues: open,
                route: branches[branches.length - 1]?.route ?? null,
            });
            open = true;
            pushed = [];
            continue;
        }

        // Anything else ends whatever argument list was being built. Some
        // commands take integers too -- ■音楽 pushes a name then two -1s -- so
        // a run of S_PUSH is an argument list only while nothing interrupts it.
        pushed = [];
    }

    // The .ain has tens of thousands of functions and 5433 of them say anything.
    return {dumped, scenes: scenes.filter(candidate => candidate.lines.length)};
};
