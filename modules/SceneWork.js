/**
 * build/scene-work: the scenes that are out with a translator, and what came
 * back.
 *
 *     030324.prompt.md       what to hand over -- written by scripts/request_scenes.js
 *     030324.answer.tsv      what came back    -- written by whoever translated it
 *     030324.state.json      why it is still here, if it has been round once
 *
 * Three files rather than a queue, for the reason
 * modules/SceneTranslations.js gives about the translations themselves: state
 * that is a directory listing cannot go out of step with what is actually
 * there. A run killed halfway leaves prompts nobody answered, which is exactly
 * what the next run should see; a scene that lands is three files deleted.
 *
 * Under build/, which is gitignored whole and documented as safe to delete: the
 * work in flight is worth nothing once the scene is written, and the scene
 * itself goes to text_languages/ where the expensive things live.
 *
 * The state file is only ever written for a scene that came back and was not
 * accepted. It carries the attempt count and the complaints, so the next prompt
 * can open with them rather than asking again with the same words and getting
 * the same answer.
 */
import * as fs from "fs/promises";
import * as path from "path";
import {BUILD} from "./Env.js";

export const WORK = path.join(BUILD, "scene-work");

/** Where the whole run's outcome is written, for a person to read afterwards. */
export const REPORT = path.join(BUILD, "scene-translation.tsv");

/** Appended to as scenes land, so a killed run still leaves its trail. */
export const LOG = path.join(BUILD, "scene-translation.log");

const stem = (fileName) => fileName.replace(/\.tsv$/, "");

export const promptFile = (fileName) => path.join(WORK, `${stem(fileName)}.prompt.md`);
export const answerFile = (fileName) => path.join(WORK, `${stem(fileName)}.answer.tsv`);
export const stateFile = (fileName) => path.join(WORK, `${stem(fileName)}.state.json`);

/**
 * Where an answer goes once it has been judged and found wanting.
 *
 * It has to leave .answer.tsv, or the next run judges the same answer again and
 * spends an attempt on it without the translator having touched anything -- the
 * scene runs out of attempts in three runs of accept and nobody ever saw the
 * complaints. Kept rather than deleted, and overwritten each round, because
 * when several scenes fail the same way the answers are what says why.
 * clearWork takes it with the rest when the scene finally lands.
 */
export const refusedFile = (fileName) => path.join(WORK, `${stem(fileName)}.refused.tsv`);

/**
 * Why a scene is still in the work folder.
 *
 * @typedef {{
 *     fileName: string,
 *     attempts: number,
 *     status: "refused" | "declined",
 *     problems: string[],
 *     warnings: string[],
 * }} SceneState
 */

/** @return {Promise<SceneState | null>} */
export const readState = async (fileName) => {
    try {
        return JSON.parse(await fs.readFile(stateFile(fileName), "utf-8"));
    } catch (error) {
        if (error.code === "ENOENT") {
            return null;
        }
        throw error;
    }
};

export const writeState = async (state) => {
    await fs.mkdir(WORK, {recursive: true});
    await fs.writeFile(stateFile(state.fileName), JSON.stringify(state, null, 4) + "\n", "utf-8");
};

/** Every scene the work folder is holding, whether answered or not. */
export const workInProgress = async () => {
    let names;
    try {
        names = await fs.readdir(WORK);
    } catch (error) {
        if (error.code === "ENOENT") {
            return new Map();
        }
        throw error;
    }
    const scenes = new Map();
    for (const name of names) {
        const match = /^(\d+)\.(prompt\.md|answer\.tsv|state\.json)$/.exec(name);
        if (!match) {
            continue;
        }
        const fileName = `${match[1]}.tsv`;
        const held = scenes.get(fileName) ?? {fileName, prompt: false, answer: false, state: false};
        held[match[2].split(".")[0]] = true;
        scenes.set(fileName, held);
    }
    return scenes;
};

/** A scene that landed: nothing left to hold. */
export const clearWork = async (fileName) => {
    await Promise.all([promptFile, answerFile, stateFile, refusedFile]
        .map(at => fs.rm(at(fileName), {force: true})));
};

/** Take the answer out of the way, so only a fresh one is ever judged. */
export const setAside = async (fileName) => {
    await fs.rename(answerFile(fileName), refusedFile(fileName));
};

export const appendLog = async (line) => {
    await fs.mkdir(BUILD, {recursive: true});
    await fs.appendFile(LOG, line + "\n", "utf-8");
};
