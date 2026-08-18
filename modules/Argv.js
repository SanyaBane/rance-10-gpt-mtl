/**
 * Reading a named value off the command line.
 *
 * Both --out=build/release and --out build/release, because `npm run` passes a
 * flag through either way and neither spelling is the wrong guess to make.
 * modules/Variants.js had worked that out for --variant already; a second flag
 * is the point at which it stops being one private copy per flag.
 */
export const flagValue = (name, argv = process.argv.slice(2)) => {
    const flag = `--${name}`;
    const index = argv.findIndex(arg => arg === flag || arg.startsWith(`${flag}=`));
    if (index < 0) {
        return undefined;
    }
    const arg = argv[index];
    return arg.includes("=") ? arg.slice(arg.indexOf("=") + 1) : argv[index + 1];
};
