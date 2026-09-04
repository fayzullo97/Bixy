import { SignJWT, jwtVerify } from 'jose';

const SESSION_ISSUER = 'whiteboard-ai-tutor';

/**
 * Our own first-party session, minted once we've validated Telegram's id_token.
 * We do NOT reuse Telegram's short-lived id_token as the session — we exchange it
 * for a longer-lived token of our own so a signed-in student stays signed in
 * across reloads (§8.8) without re-hitting Telegram every visit.
 *
 * The session is a stateless HS256 JWT keyed off the Telegram user id. Trade-off
 * for v1: sign-out is a client-side token discard; there is no server-side
 * revocation list, so a leaked token stays valid until it expires. Acceptable at
 * this phase (a stolen bearer token is the same risk everywhere); a jti denylist
 * or per-user session epoch can be added later without changing this interface.
 */
export function makeSession(opts: { secret: string; ttlDays: number }) {
  const key = new TextEncoder().encode(opts.secret);
  return {
    async issue(telegramId: string): Promise<string> {
      return new SignJWT({})
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(telegramId)
        .setIssuer(SESSION_ISSUER)
        .setIssuedAt()
        .setExpirationTime(`${opts.ttlDays}d`)
        .sign(key);
    },
    async verify(token: string): Promise<string> {
      const { payload } = await jwtVerify(token, key, {
        issuer: SESSION_ISSUER,
        algorithms: ['HS256'],
      });
      if (!payload.sub) throw new Error('session token is missing a subject');
      return payload.sub;
    },
  };
}

export type Session = ReturnType<typeof makeSession>;
