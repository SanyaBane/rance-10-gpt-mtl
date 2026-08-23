/**
 * The patch's own version, which is not the game's.
 *
 * Two numbers are in play and they look alike enough to be mistaken for each
 * other: Rance10.v1.04 is the game build every file here is made from, and this
 * is how far the patch over it has come. The game's is frozen -- v1.04 is the
 * last build AliceSoft shipped -- so the only one that ever moves is this one,
 * and neither is written down anywhere without a word saying which it is.
 *
 * The number lives in package.json rather than in this file: that field is
 * already there, npm maintains it, and one number in one place is the point --
 * the generated release READMEs and the build log both read it from here, so a
 * release is editing one line and tagging it. Read with fs rather than
 * `import ... with {type: "json"}`, which works on this Node and prints an
 * experimental warning into the middle of every build log while it does.
 *
 * Semantic versioning read the way it means something for a patch rather than
 * for a library:
 *
 *   major  the player has to do something -- a save that no longer loads, a
 *          switch under custom_mods renamed, a different translation becoming
 *          the default. Rare, and rare on purpose.
 *   minor  a new folder under features/, or a sweep through the translation
 *          big enough to be worth announcing.
 *   patch  text: a name settled, a line rewritten, a term swept out.
 *
 * Tags are the same number with a `v` on the front, which is what the one tag
 * on the remote already uses. The 23 local ones that used to sit beside it are
 * gone -- 1.04.00 through 1.04.19 counted the game's version rather than this
 * one, and none of them had ever been pushed. en_gpt-final is the exception and
 * stays: README, docs/text-languages.md and docs/coherence-sweep.md all read a
 * removed translation out of it with `git show`, so it is a tag with five
 * references rather than a leftover.
 *
 * The game never shows this number, and that is deliberate. It could: the About
 * box under the menu bar is built by Rance10.exe out of the game's title, the
 * literal "\r\n\r\nVersion ", and the whole of Version.txt beside it -- four
 * bytes reading "1.04", with nothing in the .ain holding that line at all. So
 * writing "1.04 + patch v1.2.0" into that file would put the patch's name in
 * the one place the game answers the question, without an .exe being touched.
 * It is not done because the file is the game's own rather than ours: whatever
 * an official update does with it, our four extra words would be sitting in the
 * way, and the .ain, the .ex and the .afa this patch replaces are all files it
 * rewrites wholesale anyway. A release folder says which patch it is in its
 * README instead.
 */
import * as fs from "fs";
import * as path from "path";
import {ROOT} from "./Env.js";

/** "1.2.0" -- the bare number, for anything that composes a line of its own. */
export const PATCH_VERSION = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf-8")).version;

/** "v1.2.0" -- how a person reads it, and how a tag spells it. */
export const PATCH_TAG = `v${PATCH_VERSION}`;
