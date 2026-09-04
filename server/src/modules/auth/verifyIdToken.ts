import { createRemoteJWKSet, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from 'jose';

/**
 * Algorithms Telegram advertises for id_token signing
 * (id_token_signing_alg_values_supported in its OIDC discovery doc).
 *
 * Pinning this allow-list is the crucial defense against algorithm-confusion
 * attacks — most importantly it forbids `alg: none` and rejects a token that
 * tries to smuggle a symmetric alg (HS256) past an asymmetric verifier. This is
 * exactly the subtle bug the PRD (§12) flags as easy to miss in review.
 */
const TELEGRAM_ID_TOKEN_ALGS = ['RS256', 'ES256', 'EdDSA', 'ES256K'];

export interface TelegramProfile {
  telegramId: string;
  name: string | null;
  username: string | null;
  photoUrl: string | null;
}

export type IdTokenVerifier = (idToken: string) => Promise<TelegramProfile>;

/**
 * Builds a verifier that independently validates a Telegram id_token before
 * anything in it is trusted (§8.8): checks the signature against Telegram's
 * public keys, that the issuer is Telegram, that the audience is *this* bot,
 * that it hasn't expired, and that the signing algorithm is one Telegram uses.
 *
 * The JWKS resolver is injected so the security-critical path can be unit
 * tested against a local key set without reaching out to Telegram.
 */
export function makeIdTokenVerifier(opts: {
  jwks: JWTVerifyGetKey;
  issuer: string;
  audience: string;
}): IdTokenVerifier {
  return async (idToken: string): Promise<TelegramProfile> => {
    const { payload } = await jwtVerify(idToken, opts.jwks, {
      issuer: opts.issuer,
      audience: opts.audience,
      algorithms: TELEGRAM_ID_TOKEN_ALGS,
    });
    return mapProfile(payload);
  };
}

/** The remote JWKS for real Telegram tokens. Caches keys internally. */
export function telegramRemoteJwks(jwksUrl: string): JWTVerifyGetKey {
  return createRemoteJWKSet(new URL(jwksUrl));
}

/**
 * Maps OIDC standard claims to our profile shape. Telegram returns the user id
 * as `sub`; name/username/photo come back under the `profile` scope as
 * name / preferred_username / picture.
 */
export function mapProfile(payload: JWTPayload): TelegramProfile {
  const telegramId = String(payload.sub ?? '');
  if (!telegramId) throw new Error('id_token is missing a subject (sub) claim');
  return {
    telegramId,
    name: asString(payload.name),
    username: asString((payload as Record<string, unknown>).preferred_username),
    photoUrl: asString((payload as Record<string, unknown>).picture),
  };
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}
