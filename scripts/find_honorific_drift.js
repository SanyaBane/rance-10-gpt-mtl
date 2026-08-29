/**
 * Which "Lord"/"Lady" in the English is a 様 the Japanese wrote.
 *
 *   node scripts/find_honorific_drift.js                    # the counts
 *   node scripts/find_honorific_drift.js --bucket=unpaired  # and the lines
 *   node scripts/find_honorific_drift.js --bucket=sama --limit=40
 *
 * modules/HonorificDrift.js is the question. This prints it and writes nothing;
 * scripts/fix_honorifics.js writes what this shows, one bucket at a time.
 *
 * The buckets are the point. Only `sama` is decided by the Japanese -- the
 * name is in a table and its own speech calls it 様 -- and the other six are
 * each a different reason a person has to look: 殿 is -dono and not -sama, a
 * name no table holds is a name nobody has settled, and "my Lord" over 四天王 is
 * a rank rather than an honorific and wants leaving alone.
 */
import {flagValue} from "../modules/Argv.js";
import {run} from "../modules/AliceTools.js";
import {BUCKETS, findHonorificDrift} from "../modules/HonorificDrift.js";
import {textLangName} from "../modules/TextLanguages.js";

await run(async () => {
    const wanted = flagValue("bucket");
    if (wanted !== undefined && !BUCKETS.includes(wanted)) {
        console.error(`--bucket takes one of ${BUCKETS.join(", ")}.`);
        return 1;
    }
    const limit = Number(flagValue("limit") ?? 30);
    const lang = textLangName();
    const {findings, files} = await findHonorificDrift(lang);

    console.log(`${lang}: ${findings.length} findings over ${files} scenes\n`);
    for (const bucket of BUCKETS) {
        const count = findings.filter(finding => finding.bucket === bucket).length;
        if (count) {
            console.log(`  ${String(count).padStart(5)}  ${bucket}${bucket === "sama" ? "   <- fixable" : ""}`);
        }
    }

    if (wanted === undefined) {
        console.log(`\nA bucket at a time: --bucket=${BUCKETS.join(" | ")}`);
        return 0;
    }

    const group = findings.filter(finding => finding.bucket === wanted);
    console.log(`\n=== ${wanted}: ${group.length} ===`);
    for (const finding of group.slice(0, limit)) {
        console.log(`\n[${finding.file} m[${finding.lineNumber}] ${finding.speaker}]`);
        console.log(`  JP: ${finding.japanese}`);
        console.log(`  EN: ${finding.english}`);
        if (finding.before) {
            const named = finding.japaneseName ? ` (${finding.japaneseName})` : "";
            console.log(`  ->  ${finding.before} => ${finding.after}${named}`);
        }
    }
    if (group.length > limit) {
        console.log(`\n... ${group.length - limit} more; --limit=${group.length} for all of them.`);
    }
    return 0;
});
