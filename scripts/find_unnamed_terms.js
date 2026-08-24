/**
 * The Japanese words a scene prompt hands over with no English attached.
 *
 *   node scripts/find_unnamed_terms.js                 # the report
 *   node scripts/find_unnamed_terms.js --bucket=unsliced   # only the ones a glossary already answers
 *   node scripts/find_unnamed_terms.js --term=ホルス    # everything known about one word
 *   node scripts/find_unnamed_terms.js --lines=6       # more of the scenes it stands in
 *   node scripts/find_unnamed_terms.js --plain         # the half with no rendering to rank by
 *
 * scripts/find_term_drift.js asks whether the patch already calls one Japanese
 * word two English things, which needs the translation to exist. This asks the
 * question a retranslation has to ask first: which words are about to be
 * translated by somebody who was shown nothing about them. Both start from the
 * text rather than from a table; neither replaces the other.
 *
 * modules/UnnamedTerms.js has the method, and docs/unnamed-terms.md what the
 * report costs to read and what it cannot see.
 */
import {flagValue, hasFlag} from "../modules/Argv.js";
import {run} from "../modules/AliceTools.js";
import {bucketOf, findUnnamedTerms, foldTerms, readCoverKeys, readSceneCorpus} from "../modules/UnnamedTerms.js";
import {textLangName} from "../modules/TextLanguages.js";

const BUCKETS = ["unknown", "unsliced"];

await run(async () => {
    const onlyBucket = flagValue("bucket");
    const onlyTerm = flagValue("term");
    const wantsPlain = hasFlag("plain");
    if (onlyBucket && !BUCKETS.includes(onlyBucket)) {
        console.error(`--bucket takes one of ${BUCKETS.join(", ")}.`);
        return 1;
    }
    const number = (name, fallback) => (flagValue(name) === undefined ? fallback : Number(flagValue(name)));
    const lines = number("lines", 2);
    const coverage = number("coverage", 0.35);

    const textLang = textLangName();
    const scenes = readSceneCorpus(textLang);
    const keys = await readCoverKeys();
    const found = findUnnamedTerms(scenes, keys, {
        least: number("least", 7),
        support: number("support", 4),
        precision: number("precision", 0.85),
    });

    /*
     * The half with a rendering and the half without are two different reports.
     * A term the draft renders as a proper noun is a name somebody is about to
     * guess at; a term it renders as an ordinary English word is usually an
     * ordinary Japanese word, and that half is 4492 entries deep in 出来, 本当,
     * 人間 and 自分. --plain prints it anyway, because 大陸 is in there.
     */
    const named = (finding) => finding.renderings.length && finding.covers >= coverage;
    const wanted = (finding) => (!onlyTerm || finding.term === onlyTerm || finding.compound === onlyTerm)
        && (!onlyBucket || bucketOf(finding) === onlyBucket)
        && (onlyTerm || (wantsPlain ? !named(finding) : named(finding)));

    const findings = foldTerms(found.filter(wanted));
    if (onlyTerm) {
        console.log(`${findings.length} findings for ${onlyTerm}`);
    } else if (wantsPlain) {
        console.log(`${findings.length} terms with no rendering to rank them by --`
            + " ordinary Japanese, with whatever else is in no table buried in it");
    } else {
        console.log(`${findings.length} terms the scene prompts name nothing for`);
    }

    for (const bucket of onlyBucket ? [onlyBucket] : BUCKETS) {
        const group = findings.filter(finding => bucketOf(finding) === bucket);
        if (!onlyTerm) {
            console.log(`\n--- ${group.length} ${bucket} ---`);
        }
        for (const finding of group) {
            console.log(`${finding.compound === finding.term ? finding.term
                : `${finding.term} (always inside ${finding.compound})`}`
                + `  blind in ${finding.blind} of ${finding.scenes} scenes`
                + (finding.elsewhere.length
                    ? `, ${finding.blind - finding.unknown} of them answered by ${finding.elsewhere.join(", ")}`
                    : ""));
            if (finding.renderings.length) {
                console.log(`    ${finding.renderings.slice(0, 4)
                    .map(([phrase, n]) => `${phrase} x${n}`).join(", ")}`);
            }
            for (const at of finding.where.slice(0, lines)) {
                console.log(`    ${at.scene}  ${at.japanese}`);
                console.log(`            ${at.english}`);
            }
        }
    }

    if (!findings.length && (onlyTerm || onlyBucket)) {
        console.log(`Nothing for ${onlyTerm ?? onlyBucket} in the "${textLang}" text language.`);
    }
    console.log(`\nRead over ${scenes.length} scenes of the "${textLang}" text language and the`
        + " cast lines, glossary rows and name-table entries their prompts would carry."
        + " modules/UnnamedTerms.js says what the filtering takes off and why.");
    return 0;
});
