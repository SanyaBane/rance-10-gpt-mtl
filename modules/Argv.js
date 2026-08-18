/**
 * Reading flags off the command line.
 *
 * Every spelling of a flag that carries a value, because `npm run` passes them
 * through either way and none of them is the wrong guess to make:
 * --out=build/release and --out build/release, plus the same two for the short
 * -o. The first name given that appears in the arguments is the one read, so a
 * long flag and its alias never both count.
 *
 * modules/Variants.js had worked the two long spellings out for --variant
 * already; a second flag is the point at which it stops being one private copy
 * per flag.
 */
/** One dash for a one-letter name, two for a word. */
const spelling = (name) => (name.length === 1 ? `-${name}` : `--${name}`);

export const flagValue = (names, argv = process.argv.slice(2)) => {
    for (const name of [names].flat()) {
        const bare = spelling(name);
        const assigned = `${bare}=`;
        const index = argv.findIndex(arg => arg === bare || arg.startsWith(assigned));
        if (index < 0) {
            continue;
        }
        const arg = argv[index];
        return arg.startsWith(assigned) ? arg.slice(assigned.length) : argv[index + 1];
    }
    return undefined;
};

/** A flag whose presence is the whole message, --game being the one so far. */
export const hasFlag = (name, argv = process.argv.slice(2)) => argv.includes(spelling(name));

/**
 * The arguments with these flags taken out, a value-carrying one together with
 * its value however it was spelled. For scripts/release.js, which hands its own
 * arguments to each build it runs and has to remove the ones it answers itself
 * before adding its own.
 */
export const withoutFlags = (argv, valueNames, bareNames = []) => {
    const kept = [];
    for (let index = 0; index < argv.length; index++) {
        const arg = argv[index];
        const valued = valueNames.map(spelling).find(flag => arg === flag || arg.startsWith(`${flag}=`));
        if (valued !== undefined) {
            if (arg === valued) {
                index++;
            }
            continue;
        }
        if (!bareNames.map(spelling).includes(arg)) {
            kept.push(arg);
        }
    }
    return kept;
};
