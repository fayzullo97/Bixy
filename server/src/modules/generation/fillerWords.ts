import type { Language } from './systemPrompt.js';

/**
 * Filler interjections, baked into the generated script rather than left to the
 * TTS layer (Part 02 §3) — so behaviour is identical on Aisha and OpenAI instead
 * of depending on how each engine reads punctuation.
 *
 * Plain spellings only. Stretched spellings ("Riiiightttt") are excluded
 * deliberately: testing confirmed plain spelling reads naturally on Aisha, and
 * stretched forms do not.
 *
 * ROLLOUT: Uzbek only. The bank below is tested and approved; Russian and
 * English equivalents still need drafting under the same categories, and Part 01
 * means English narration is a real case too (a C1 lesson narrates in English,
 * not just an `en`-selected one). Until those exist, generation for ru/en simply
 * carries no filler guidance rather than improvising unreviewed interjections.
 */
const UZBEK_FILLERS = {
  thinking: [
    'Hmm...',
    'Eh!',
    'Ha-a...',
    'Ie!',
    'O-ho!',
    'Hmm, qiziq...',
    'Hmm... tushunarli.',
    'Hmm... bir daqiqa.',
    'Eh... balki shundaydir.',
    "Hmm... bu haqda yaxshilab o'ylash kerak.",
  ],
  transition: ["Xo'p, mayli.", 'Ha, albatta!', 'Ha-a, endi tushundim.', 'Ana endi gap!'],
  surprise: ['Voy!', 'Vau!', 'Obbo!', 'Nima?!', 'Voy, shunaqami?!'],
} as const;

/**
 * Held out of rotation pending native-speaker review (Part 02 §3): both read
 * wrong in a wrong-answer reaction — one as scolding, one as pitying. Listed
 * here so they are visibly withheld rather than quietly forgotten.
 *
 *   "Obbo, nima qilib qo'ydingiz?"  → reads as scolding
 *   "Voy, bechora..."               → reads as pitying
 *
 * The `praise` category from the source bank (Ajoyib!, Zo'r!, Qoyil!, "Qoyil,
 * juda yaxshi!") is also unused: it belongs on a correct check-in answer, and
 * the script has no generated field for that — the board hardcodes an English
 * "Exactly right." Wiring it needs a schema addition that this part doesn't own.
 */
export const WITHHELD_FILLERS = ["Obbo, nima qilib qo'ydingiz?", 'Voy, bechora...'] as const;

/**
 * Filler guidance for the per-request user message, or '' for a language with no
 * approved bank yet.
 *
 * Deliberately NOT in the system prompt: that block is sent as a cached prefix
 * and must stay byte-identical across requests, and this varies by language.
 */
export function fillerGuidance(language: Language): string {
  if (language !== 'uz') return '';
  const list = (items: readonly string[]) => items.map((p) => `"${p}"`).join(', ');
  return `

Speech naturalness: sprinkle a FEW filler interjections into story_beat "narration" so Bixy sounds like someone thinking aloud rather than reading. Use ONLY these approved phrases, exactly as spelled:
- Thinking / hesitating, mid-explanation: ${list(UZBEK_FILLERS.thinking)}
- Moving on, or confirming a rule: ${list(UZBEK_FILLERS.transition)}
- Genuine surprise — rare, only for a real twist in the story, never routine narration: ${list(UZBEK_FILLERS.surprise)}

Write them as their own short sentence, so each lands as a pause. Never stretch a spelling ("Riiiightttt") — plain spelling only. Do not use a filler in every beat; over-used they read as a tic rather than as thinking.`;
}
