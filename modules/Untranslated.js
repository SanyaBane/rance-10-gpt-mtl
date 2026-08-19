/**
 * What a built .ain still says in Japanese.
 *
 * This reads `alice ain dump -t` back out of a build, the way
 * CLAUDE.md says to verify one, and reports every s[] slot whose text still
 * carries kana or kanji together with the functions that push it. The dump
 * groups its lines under a `; ClassName@Method` heading for whichever function
 * references each slot, which is the whole reason a scan is worth anything:
 * "回復" says nothing about whether it is a word or a key, and
 * `EnemyActionIcon@GetIconBaseName` says it is a key.
 *
 * Candidates, not findings. Half the Japanese left in an .ain is data wearing
 * the clothes of text -- a card Id, a CG name, a token the enemy AI compares --
 * and the rules for telling them apart are the ones in CLAUDE.md, which no
 * regular expression here replaces. What this does is cut 12000 slots down to
 * the couple of hundred worth a person's eyes.
 *
 * m[] messages are left alone. Those are the dialogue, which comes from
 * text_languages/ as a whole script; a Japanese one there means a line the
 * translation is missing rather than a string somebody forgot to pick.
 *
 * One false positive worth knowing about, because it looks alarming and is not:
 * a function a .jam reassembles leaves its old slots behind, still filed under
 * its name. s[3251] = "種族：%s" is reported against EnemyInformationView@SetParam
 * although that function pushes "Race：%s" now -- patches/enemy_panel_cards.jam
 * gave it a new string and the old one stayed in the table with nothing reading
 * it. Whether a slot is live is a question for `alice ain dump -c`, which shows
 * the body that runs.
 */

/**
 * Kana and kanji only.
 *
 * Not the fullwidth punctuation that comes with them: ！ ： ％ and the fullwidth
 * digits are all over the English in patches/system_cherry_picks.v1.04.ain.txt on
 * purpose, because the game's font sets them beside Japanese-width glyphs and
 * the half-width forms look wrong there. A scan that called those Japanese
 * would report every line it had already been told about.
 */
const JAPANESE = /[぀-ヿ㐀-䶿一-鿿豈-﫿]/;

/** `;s[3949] = "コンボ追加効果！"`, and the `; SkillEffectProcessAddCombo@Evaluate` above it. */
const STRING_LINE = /^;s\[(\d+)] = (".*")$/;
const HEADING = /^; (\S.*)$/;

/**
 * A path rather than a sentence: an activity, a CG, a sound. The dump is full
 * of them -- "戦闘画面/シス／戦闘／瀕死" is a file in the .pactex, not a line
 * anybody reads -- and they are the largest single thing between a scan and a
 * list worth looking at.
 *
 * Both slashes, because the game writes the folder with the ASCII one and the
 * name with the fullwidth one, and either is enough to tell.
 */
const ASSET = /[/／]|\.(png|qnt|jpg|bmp|ogg|wav)$/i;

/**
 * The engine's own namespaced widgets rather than the game's screens.
 * config::, activityeditor::, elkeditor::, gamesave::, backscene::, enquate::,
 * modelviewer:: -- System 4 code that ships inside every .ain built with it.
 *
 * Their Japanese is part names: config::detail::CConfigView@ClickEvent pushes
 * "メッセージ速度ボタン" to find a part in the layout, and the label the player
 * reads is drawn by the layout rather than by that string. Translating one
 * makes the lookup miss and the button stop working.
 */
const ENGINE = /::detail::/;

/** A developer's screen. 表示規模's caller is one; so is BattleSceneSetNormal@SetBonusOnDebug. */
const DEBUG = /debug/i;

/**
 * A function that draws text, by the name of it. Deliberately generous: this
 * decides what gets read first, not what gets translated, and a name is a hint
 * either way -- EnemyActionIcon@GetIconBaseName matches @Get...Name and builds
 * a CG name out of what it returns.
 */
const DISPLAY = /View@|Scene\w+@|Dialog|@GetLog\b|@Evaluate\b|@Caption|@Get\w*(Text|String|Name|Desc)/;

/** In the order they are tried; the first that fits is the one reported. */
export const CATEGORIES = ["asset", "engine", "debug", "display", "other"];

const categorise = (text, functions) => {
    if (ASSET.test(text)) {
        return "asset";
    }
    if (functions.some(name => ENGINE.test(name))) {
        return "engine";
    }
    if (functions.some(name => DEBUG.test(name))) {
        return "debug";
    }
    return functions.some(name => DISPLAY.test(name)) ? "display" : "other";
};

/**
 * The quoted text as the game holds it. Same trick as modules/AinTxtParser.js:
 * a dumped string is close enough to JSON to be read as one once the literal
 * tabs in it are escaped.
 *
 * A line that will not parse is kept as it was written rather than dropped. A
 * report is not worth crashing over, and the slot number is what the reader
 * needs to go and look anyway.
 */
const unquote = (quoted) => {
    try {
        return JSON.parse(quoted.replaceAll("\t", "\\t"));
    } catch {
        return quoted.slice(1, -1);
    }
};

/**
 * Every s[] slot in the dump that still reads Japanese, commonest question
 * first: which function puts it on the screen.
 *
 * A slot is listed once however many functions push it, with all of them
 * against it, because that is exactly the thing worth knowing before touching
 * one -- s[3897] is a state name in two getters and the right-hand side of a
 * String.Contains in a third.
 *
 * @param {string} dump the text of `alice ain dump -t`
 * @return {{slot: number, text: string, functions: string[], category: string}[]}
 */
export const findUntranslated = (dump) => {
    const found = new Map();
    let heading = "";
    for (const line of dump.split(/\r?\n/)) {
        const string = line.match(STRING_LINE);
        if (string) {
            const [, slot, quoted] = string;
            const text = unquote(quoted);
            if (!JAPANESE.test(text)) {
                continue;
            }
            const entry = found.get(slot) ?? {slot: Number(slot), text, functions: []};
            if (heading && !entry.functions.includes(heading)) {
                entry.functions.push(heading);
            }
            found.set(slot, entry);
            continue;
        }
        const next = line.match(HEADING);
        if (next) {
            heading = next[1];
        }
    }
    return [...found.values()]
        .map(entry => ({...entry, category: categorise(entry.text, entry.functions)}))
        .sort((a, b) => a.functions[0]?.localeCompare(b.functions[0] ?? "") || a.slot - b.slot);
};

/** How many of each, for a line of output that says what was set aside and why. */
export const countByCategory = (entries) => {
    const counts = new Map(CATEGORIES.map(name => [name, 0]));
    for (const entry of entries) {
        counts.set(entry.category, counts.get(entry.category) + 1);
    }
    return counts;
};
