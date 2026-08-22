/**
 * The game's own files and the dumps taken from them.
 *
 * game/ain/ holds what nobody edits by hand: Rance10.v1.04.ain exactly as it
 * ships, and what alice-tools makes of it. game/ex/ holds the same for
 * Rance10EX.ex, which is a dump and no original, because no build reads one.
 * game/extracted/ beside them holds the tables a build reads back out of that
 * .ain and commits, which are equally nobody's to edit -- modules/EnemyInfo.js
 * and modules/RaceNames.js name those, since each is read by one thing.
 * Everything written rather than generated -- the cherry-picked system strings,
 * the glossaries, the text languages -- is under patches/, glossaries/ and
 * text_languages/, however similar the name looks.
 *
 * Not to be confused with GAME_DIR, which modules/AliceTools.js expands {game}
 * to: that is the installed game a build writes into, this is the copy under
 * version control that every build reads and none of them modifies.
 *
 * The paths live here rather than in each script because there were nine of
 * them spelled out across five files, and the next game version should be one
 * edit. They are absolute, off ROOT, so a script works whatever directory it
 * was started from -- three of the five used to read "./Rance10.v1.04.ain.txt"
 * and quietly depended on being started from the root.
 */
import * as path from "path";
import {ROOT} from "./Env.js";

const AIN_DIR = path.join(ROOT, "game", "ain");

/** The file every build patches: the input to alice ain edit, never its output. */
export const AIN = path.join(AIN_DIR, "Rance10.v1.04.ain");

/** alice ain dump -t: every s[] string and m[] message, one per line. */
export const AIN_TXT = path.join(AIN_DIR, "Rance10.v1.04.ain.txt");

/** The m[] lines of AIN_TXT as JSON, written by scripts/parse_ain_txt.js. */
export const AIN_JSON = path.join(AIN_DIR, "Rance10.v1.04.ain.json");

/**
 * The same two for v1.00, which scripts/regenerate_aai_txt.js maps line numbers from --
 * the translation was made against that version and the numbering moved.
 *
 * There is no Rance10.v1.00.ain here: only its dumps were ever committed, so
 * these two cannot be regenerated the way the v1.04 pair can.
 */
export const AIN_V100_TXT = path.join(AIN_DIR, "Rance10.v1.00.ain.txt");
export const AIN_V100_JSON = path.join(AIN_DIR, "Rance10.v1.00.ain.json");

/**
 * alice ex dump of the game's own Rance10EX.ex: the Japanese every table under
 * archives/Rance10EX_v1_04/ was translated from.
 *
 * The archives hold the game's data with our English written over it, so the
 * Japanese a row used to say is nowhere in this repository -- which is why two
 * sweeps ran to zero over the corpus and the cherry-picks while the built .ex
 * still carried the old spelling in a card's フルネーム and a skill's name.
 * modules/TermDrift.js reads the two side by side.
 *
 * A dump and no original, unlike game/ain/. Nothing builds an .ex out of the
 * game's own one -- scripts/ex.js builds it out of archives/ -- so committing
 * the .ex itself would put a file here that nothing reads.
 */
export const EX_TXT = path.join(ROOT, "game", "ex", "Rance10EX.v1.04.ex.txt");
