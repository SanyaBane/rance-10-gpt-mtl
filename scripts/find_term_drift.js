/**
 * Where the patch calls one Japanese word two English things.
 *
 *   node scripts/find_term_drift.js                 # both reports
 *   node scripts/find_term_drift.js --split         # only terms rendered two ways
 *   node scripts/find_term_drift.js --odd           # only the lines disagreeing with a settled term
 *   node scripts/find_term_drift.js --bucket=tabled # only terms glossaries/summary_terms.tsv has settled
 *   node scripts/find_term_drift.js --term=総統      # everything known about one term
 *
 * scripts/find_dropped_terms.js asks whether a settled English word went
 * missing, for the 182 words in glossaries/summary_terms.tsv. This asks a
 * different question of every word at all: is there a *second* English for it.
 * The two are complementary. ラグナロックアーク is 44 dropped lines there and four
 * spellings here -- Ragnarock Ark 27, Ragnarok Arc 16, Ragnarok Ark 12,
 * Ragnaro Arc 7 -- and only the second form says which of the 44 is a mistake.
 *
 * modules/TermDrift.js has the method and the reasoning. Nothing here is a
 * verdict: a term is often two things (帝国 is the Copa Empire and the Squidman
 * Empire), a trophy glossary's neighbouring rows co-occur with everything, and
 * an honorific is not a rendering. What the report is for is the second name
 * for one thing, which no amount of reading the files one at a time turns up.
 */
import {flagValue, hasFlag} from "../modules/Argv.js";
import {run} from "../modules/AliceTools.js";
import {createBucketer, dedupe, findTermDrift, readDriftLines} from "../modules/TermDrift.js";
import {textLangName} from "../modules/TextLanguages.js";

const BUCKETS = ["untabled", "tabled", "named"];

await run(async () => {
    const wantsSplit = !hasFlag("odd");
    const wantsOdd = !hasFlag("split");
    const onlyBucket = flagValue("bucket");
    const onlyTerm = flagValue("term");
    if (onlyBucket && !BUCKETS.includes(onlyBucket)) {
        console.error(`--bucket takes one of ${BUCKETS.join(", ")}.`);
        return 1;
    }
    const number = (name, fallback) => (flagValue(name) === undefined ? fallback : Number(flagValue(name)));

    const textLang = textLangName();
    const lines = await readDriftLines(textLang);
    const {split, odd} = findTermDrift(lines, {
        least: number("least", 25),
        precision: number("precision", 0.85),
        support: number("support", 4),
        coverage: number("coverage", 0.35),
        settled: number("settled", 0.6),
    });
    const bucketOf = createBucketer();

    /** Which files a rendering comes from, which is the whole point when one disagrees. */
    const sourcesOf = (where) => {
        const counts = new Map();
        for (const at of where) {
            counts.set(lines[at].source, (counts.get(lines[at].source) ?? 0) + 1);
        }
        return [...counts].sort((a, b) => b[1] - a[1]).map(([source, n]) => `${source} ${n}`).join(", ");
    };

    const wanted = (finding) => (!onlyTerm || finding.term === onlyTerm)
        && (!onlyBucket || bucketOf(finding.term) === onlyBucket);

    const shown = [];
    if (wantsSplit) {
        const findings = dedupe(split, finding => finding.renderings.map(one => one.phrase).sort().join(" / "))
            .filter(wanted)
            .sort((a, b) => (b.renderings[1].support / b.covered) - (a.renderings[1].support / a.covered));
        console.log(`${findings.length} terms rendered more than one way`);
        for (const bucket of onlyBucket ? [onlyBucket] : BUCKETS) {
            const group = findings.filter(finding => bucketOf(finding.term) === bucket);
            console.log(`\n--- ${group.length} ${bucket} ---`);
            for (const finding of group) {
                console.log(`${finding.term}  (${finding.total} lines, ${finding.covered} covered)`);
                for (const one of finding.renderings) {
                    console.log(`    ${one.phrase}  x${one.support}  [${sourcesOf(one.where)}]`);
                }
            }
        }
        shown.push(...findings);
    }

    if (wantsOdd) {
        const findings = dedupe(odd, finding =>
            `${finding.top.phrase}|${finding.disagreeing.map(one => one.at).sort().join(",")}`)
            .filter(wanted)
            .sort((a, b) => a.disagreeing.length - b.disagreeing.length);
        console.log(`\n${findings.length} settled terms with lines that disagree`);
        for (const bucket of onlyBucket ? [onlyBucket] : BUCKETS) {
            const group = findings.filter(finding => bucketOf(finding.term) === bucket);
            console.log(`\n--- ${group.length} ${bucket} ---`);
            for (const finding of group) {
                console.log(`${finding.term}  (${finding.total} lines)  settled on "${finding.top.phrase}"`
                    + ` x${finding.settled}  --  ${finding.disagreeing.length} disagree`);
                for (const one of finding.disagreeing) {
                    const line = lines[one.at];
                    console.log(`    ${line.source} ${line.where}  "${one.phrase}"`);
                    console.log(`      ${line.japanese}`);
                    console.log(`      ${line.english}`);
                }
            }
        }
        shown.push(...findings);
    }

    if (!shown.length && (onlyTerm || onlyBucket)) {
        console.log(`Nothing for ${onlyTerm ?? onlyBucket} in the "${textLang}" text language.`);
    }
    console.log(`\nRead over ${lines.length} lines of the "${textLang}" text language,`
        + " the cherry-picks, the glossaries and the .ex tables. modules/TermDrift.js says"
        + " what the filtering takes off and why.");
    return 0;
});
