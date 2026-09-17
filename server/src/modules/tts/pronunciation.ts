/**
 * Per-language spelling fixes applied to TTS INPUT ONLY.
 *
 * These change what the synthesizer is asked to say, never what any surface
 * displays. The brand is spelled "Bixy" everywhere a human reads it — on the
 * board, in subtitles, in the i18n bundles — and the substitution here exists
 * purely because one engine mispronounces that spelling.
 *
 * Applied at the TTS router (the single choke point every provider call passes
 * through), which is deliberately DOWNSTREAM of `narrate()`'s sentence split.
 * That ordering matters: `narrate` returns each sentence's text alongside its
 * timings, and those strings feed subtitle rendering — so they keep the display
 * spelling while only the bytes sent to the provider carry the phonetic one.
 */

/**
 * Aisha's Uzbek (Gulnoza) voice reads "Bixy" as "Bihhy" — the `x` takes its
 * Uzbek value (a velar fricative, like `kh`) rather than the English `ks`.
 * Spelling it "Biksy" for the synthesizer restores the intended sound.
 *
 * **No trailing word boundary, deliberately.** Uzbek is agglutinative and case
 * suffixes attach directly to the noun with no space: Bixyman ("I am Bixy"),
 * Bixyni, Bixyga, Bixyning, Bixyda, Bixydan. An earlier `/\bbixy\b/` anchored
 * both ends and so matched only the bare name — every inflected form in Uzbek
 * narration went to the synthesizer unconverted and was read with the wrong
 * stem. Dropping the trailing anchor catches the whole paradigm without having
 * to enumerate suffixes, which is what makes it robust: a list would silently
 * miss whatever form nobody thought of, which is exactly how the original bug
 * survived its own tests.
 *
 * The leading `\b` is kept and still does real work — it stops a match inside a
 * longer word ("mybixy" is untouched). What it cannot do is separate a suffix
 * from a compound: "Bixyland" also starts at a word boundary, so it converts to
 * "Biksyland" too. Accepted, because no such compound exists in this product's
 * vocabulary, and because mispronouncing the name in every Uzbek lesson is a far
 * larger harm than mispronouncing a word that never appears.
 *
 * Case-insensitive on the match, but the replacement is a fixed capitalized
 * form: the word is a proper noun and is never legitimately lowercase in
 * narration.
 */
const UZ_SUBSTITUTIONS: Array<[RegExp, string]> = [[/\bbixy/gi, 'Biksy']];

const BY_LANGUAGE: Record<string, Array<[RegExp, string]>> = {
  uz: UZ_SUBSTITUTIONS,
};

/**
 * Rewrite text for a specific engine's pronunciation. Languages with no entry
 * are returned untouched, so adding a fix for one language cannot affect
 * another.
 */
export function applyTtsPronunciation(text: string, language: string): string {
  const rules = BY_LANGUAGE[language];
  if (!rules) return text;
  return rules.reduce((out, [pattern, replacement]) => out.replace(pattern, replacement), text);
}
