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
export const flagValue = (names, argv = process.argv.slice(2)) => {
    for (const name of [names].flat()) {
        const bare = name.length === 1 ? `-${name}` : `--${name}`;
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
export const hasFlag = (name, argv = process.argv.slice(2)) => argv.includes(`--${name}`);
