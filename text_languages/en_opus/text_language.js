/**
 * The retranslation: the script done again, a scene at a time, with the
 * speakers and the context in front of whoever is translating it.
 *
 * en_grok, the language this one is rendered on top of, was translated a line
 * at a time -- 270000 numbered fragments with no speaker, no scene and no line
 * before or after. README.md beside this file says what that costs and what
 * this is meant to fix.
 *
 * The dialogue is kept as one file per scene under scenes/, not as the corpus
 * of chunk files en_grok has and not as a hand-edited patch. dialogue.ain.txt
 * is generated out of those by npm run assemble-scenes and is nobody's to edit;
 * modules/SceneTranslations.js says why the scenes are the source of truth and
 * why the assembled file is rewritten whole every time.
 *
 * Until every scene is done this is a partial translation, and that is a
 * working state rather than a broken one: scripts/regenerate_aai_txt.js renders
 * the default text language underneath a patch, so a line no scene file claims
 * yet plays in en_grok's English.
 */
export default {
    summary: "the script retranslated scene by scene, over en_grok",
    translated: true,
};
