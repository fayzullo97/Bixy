import 'dotenv/config';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

/**
 * Central, validated configuration. Read once at boot so a missing var fails
 * fast and loudly rather than surfacing as a confusing error deep in a request.
 */
export const env = {
  PORT: Number(process.env.PORT ?? 3000),
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? '*',

  SESSION_SECRET: required('SESSION_SECRET'),
  SESSION_TTL_DAYS: Number(process.env.SESSION_TTL_DAYS ?? 30),

  // Telegram Mini App auth: `initData` is signed with the bot token, so that's the
  // one secret we need to verify identity (Telegram's Mini App auth spec). No Bot
  // ID / issuer / JWKS anymore — those belonged to the retired Login Widget (OIDC).
  TELEGRAM_BOT_TOKEN: required('TELEGRAM_BOT_TOKEN'),
  // Reject initData older than this (seconds) as a replay guard. 24h default.
  TELEGRAM_INITDATA_MAX_AGE_SEC: Number(process.env.TELEGRAM_INITDATA_MAX_AGE_SEC ?? 86400),

  SUPABASE_URL: required('SUPABASE_URL'),
  SUPABASE_SERVICE_ROLE_KEY: required('SUPABASE_SERVICE_ROLE_KEY'),

  // --- Claude API (content generation, §9.1) ---
  ANTHROPIC_API_KEY: required('ANTHROPIC_API_KEY'),
  // Tiered per PRD §9.1: Haiku for routine lesson generation, Sonnet for
  // photo topic-identification. Env-overridable to bump quality vs cost.
  GEN_MODEL: process.env.GEN_MODEL ?? 'claude-haiku-4-5',
  TOPIC_ID_MODEL: process.env.TOPIC_ID_MODEL ?? 'claude-sonnet-4-6',
  // Fill-in-the-blank grading fallback (§8.11): a quick yes/no grammatical
  // judgment, not a generation task — Haiku tier is enough.
  GRADE_MODEL: process.env.GRADE_MODEL ?? 'claude-haiku-4-5',

  // --- AishaAI TTS (§9.1). Optional: if the key is absent, audio is skipped. ---
  AISHA_API_KEY: process.env.AISHA_API_KEY ?? '',
  AISHA_BASE_URL: process.env.AISHA_BASE_URL ?? 'https://back.aisha.group',
  // Mood for the built-in uz (Gulnoza) flow only: Neutral | Cheerful | Happy | Sad.
  // Not sent for en/ru, which run a different path with no model/mood/speed.
  AISHA_MOOD: process.env.AISHA_MOOD ?? 'Neutral',
  NARRATION_BUCKET: process.env.NARRATION_BUCKET ?? 'narration',

  // DEV-ONLY sign-in that bypasses Telegram validation, so the app can be run
  // end-to-end locally before the production URL is registered with BotFather.
  // Force-disabled in production regardless of the flag — a belt-and-braces guard
  // so it can never become an auth bypass in a deployed environment.
  ALLOW_DEV_LOGIN: process.env.ALLOW_DEV_LOGIN === '1' && process.env.NODE_ENV !== 'production',
} as const;
