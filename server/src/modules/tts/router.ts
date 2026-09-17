import type { TtsClient } from './client.js';
import type { Language } from '../generation/systemPrompt.js';
import { applyTtsPronunciation } from './pronunciation.js';

/**
 * Language-routed TTS (Part 01 §2). v1 ran every language through one provider;
 * narration now splits — Uzbek on AishaAI, Russian and English on OpenAI.
 *
 * This is itself a `TtsClient`, so the split is invisible above it: the
 * generation pipeline already passes `language` into `synthesize` and needs no
 * change. Swapping a provider stays a change behind this interface (§9.1).
 */
export function createTtsRouter(byLanguage: Record<Language, TtsClient>): TtsClient {
  return {
    // Enabled when ANY provider has a key, not all — a partial configuration
    // should still narrate the languages it can. A language whose provider is
    // missing throws below rather than returning nothing, so the pipeline's
    // `narrationComplete` gate fails that lesson loudly instead of serving it
    // half-silent (§8.10 — no silent degradation).
    enabled: Object.values(byLanguage).some((client) => client.enabled),

    async synthesize(text, language) {
      const client = byLanguage[language as Language];
      if (!client) throw new Error(`TTS: no provider configured for language "${language}"`);
      if (!client.enabled) {
        throw new Error(`TTS: the provider for "${language}" is missing its API key`);
      }
      // Per-language pronunciation fixes are applied HERE, at the one point every
      // provider call funnels through, so no display surface can pick them up and
      // no provider client has to know about them (see pronunciation.ts).
      return client.synthesize(applyTtsPronunciation(text, language), language);
    },
  };
}
