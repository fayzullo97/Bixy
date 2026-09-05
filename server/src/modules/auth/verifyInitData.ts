import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Telegram Mini App identity comes in as `initData` — a URL-encoded query string
 * Telegram injects into the WebApp context, signed with the bot token. We verify
 * that signature ourselves before trusting any field in it (Telegram's official
 * "Validating data received via the Mini App" spec).
 *
 * This REPLACES the old Telegram Login Widget / OIDC id_token path. The two
 * payloads are shaped completely differently: the Login Widget gave us a signed
 * JWT (id_token) with OIDC claims (sub/name/preferred_username/picture) validated
 * against Telegram's JWKS; initData is a query string whose `user` field is a JSON
 * blob ({id, first_name, last_name, username, photo_url, language_code}) and whose
 * integrity is an HMAC keyed off the bot token — no network call, no JWKS.
 */

export interface TelegramProfile {
  telegramId: string;
  name: string | null;
  username: string | null;
  photoUrl: string | null;
  /** Telegram's IETF language tag for the user (e.g. 'en', 'ru', 'uz'); may be null. */
  languageCode: string | null;
}

export type InitDataVerifier = (initData: string) => Promise<TelegramProfile>;

/** Default freshness window for initData: reject anything older than 24h (replay guard). */
const DEFAULT_MAX_AGE_SECONDS = 86_400;

/**
 * Builds a verifier that validates a raw `initData` string against the bot token
 * before mapping it to a profile. Throws on any tampering, a missing/!bad hash,
 * a missing `user`, or a stale `auth_date` — callers collapse the throw to a
 * single opaque 401 and never trust the data.
 *
 * The signature check follows Telegram's algorithm exactly:
 *   secret_key   = HMAC_SHA256(key="WebAppData", message=bot_token)
 *   data_check   = every field except `hash` and `signature`, sorted by key,
 *                  joined as "key=value" with "\n"
 *   expectedHash = hex( HMAC_SHA256(key=secret_key, message=data_check) )
 * and compares expectedHash to the received `hash` in constant time.
 */
export function makeInitDataVerifier(opts: {
  botToken: string;
  maxAgeSeconds?: number;
}): InitDataVerifier {
  const maxAgeSeconds = opts.maxAgeSeconds ?? DEFAULT_MAX_AGE_SECONDS;
  // secret_key is derived once from the bot token; it's the HMAC key for the check.
  const secretKey = createHmac('sha256', 'WebAppData').update(opts.botToken).digest();

  return async (initData: string): Promise<TelegramProfile> => {
    const params = new URLSearchParams(initData);

    const hash = params.get('hash');
    if (!hash) throw new Error('initData is missing its hash');

    // The data-check-string excludes ONLY `hash` (the value we're checking).
    // Every other received field is included — crucially `signature` too: newer
    // Telegram clients add an Ed25519 `signature` field for the bot-token-less
    // validation path, and Telegram computes `hash` over it as well. Stripping it
    // (as some third-party libraries do) makes the HMAC never match on real
    // payloads — verified against a live initData string from @bixyaibot.
    const pairs: string[] = [];
    for (const [key, value] of params) {
      if (key === 'hash') continue;
      pairs.push(`${key}=${value}`);
    }
    pairs.sort();
    const dataCheckString = pairs.join('\n');

    const expectedHash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
    if (!timingSafeEqualHex(expectedHash, hash)) {
      throw new Error('initData signature does not match');
    }

    // Only after the signature is proven do we read the freshness stamp.
    const authDate = Number(params.get('auth_date'));
    if (!Number.isFinite(authDate) || authDate <= 0) {
      throw new Error('initData is missing a valid auth_date');
    }
    const ageSeconds = Math.floor(Date.now() / 1000) - authDate;
    if (ageSeconds > maxAgeSeconds) {
      throw new Error('initData is expired');
    }

    const userRaw = params.get('user');
    if (!userRaw) throw new Error('initData is missing the user field');
    return mapProfile(userRaw);
  };
}

/**
 * Maps the initData `user` JSON to our profile shape. Telegram sends the id as a
 * number; we stringify it to keep the same `telegram_id` (string) key the rest of
 * the app already uses. `name` mirrors the old id_token `name` claim by joining
 * first + last name.
 */
export function mapProfile(userJson: string): TelegramProfile {
  let user: Record<string, unknown>;
  try {
    user = JSON.parse(userJson) as Record<string, unknown>;
  } catch {
    throw new Error('initData user field is not valid JSON');
  }

  const id = user.id;
  const telegramId = typeof id === 'number' ? String(id) : String(id ?? '');
  if (!telegramId) throw new Error('initData user is missing an id');

  const name =
    [asString(user.first_name), asString(user.last_name)].filter(Boolean).join(' ') || null;

  return {
    telegramId,
    name,
    username: asString(user.username),
    photoUrl: asString(user.photo_url),
    languageCode: asString(user.language_code),
  };
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/** Constant-time compare of two hex strings; length mismatch is a fast, safe reject. */
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}
