/**
 * Report the skill descriptions that do not fit the panel that draws them.
 *
 *   node scripts/check_skill_widths.js
 *
 * Reads archives/Rance10EX_v1_04/11_スキルデータ.x and writes nothing: the
 * English there is hand-written, and which of the too-wide lines to shorten and
 * how is a judgement about meaning rather than a substitution. Run it after
 * editing the table.
 *
 * Not in package.json, the way scripts/extract_summary_lines.js is not -- it
 * answers a question rather than building anything, and no build depends on it.
 *
 * Measures with the game's own font, never with getTextWidth from
 * modules/TextNormalization.js, which measures Meiryo and understates
 * capital-heavy English by about a sixth. modules/SkillDescriptions.js has the
 * panel and docs/text-width.md has the font.
 */
import {readSkillDescriptions, reportSkillWidths} from "../modules/SkillDescriptions.js";

console.log(reportSkillWidths(await readSkillDescriptions()).join("\n"));
