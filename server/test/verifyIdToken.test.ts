import { beforeAll, describe, expect, it } from 'vitest';
import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  SignJWT,
  UnsecuredJWT,
  type JWK,
  type KeyLike,
} from 'jose';
import { makeIdTokenVerifier, type IdTokenVerifier } from '../src/modules/auth/verifyIdToken';

const ISSUER = 'https://oauth.telegram.org';
const AUDIENCE = '8675332994';
const KID = 'test-key-1';

let signingKey: KeyLike;
let attackerKey: KeyLike;
let verify: IdTokenVerifier;

function baseClaims(): Record<string, unknown> {
  return {
    sub: '111222333',
    name: 'Aziz Karimov',
    preferred_username: 'aziz',
    picture: 'https://cdn.telegram.org/photo.jpg',
  };
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function tokenBuilder(claims: Record<string, unknown> = baseClaims()) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'RS256', kid: KID })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt();
}

beforeAll(async () => {
  const pair = await generateKeyPair('RS256');
  signingKey = pair.privateKey;
  const publicJwk = (await exportJWK(pair.publicKey)) as JWK;
  publicJwk.kid = KID;
  publicJwk.alg = 'RS256';

  attackerKey = (await generateKeyPair('RS256')).privateKey;

  const jwks = createLocalJWKSet({ keys: [publicJwk] });
  verify = makeIdTokenVerifier({ jwks, issuer: ISSUER, audience: AUDIENCE });
});

describe('makeIdTokenVerifier — accepts a genuine token', () => {
  it('resolves and maps OIDC claims to a profile', async () => {
    const token = await tokenBuilder().setExpirationTime('5m').sign(signingKey);
    const profile = await verify(token);
    expect(profile).toEqual({
      telegramId: '111222333',
      name: 'Aziz Karimov',
      username: 'aziz',
      photoUrl: 'https://cdn.telegram.org/photo.jpg',
    });
  });

  it('maps missing optional profile fields to null', async () => {
    const token = await tokenBuilder({ sub: '5' }).setExpirationTime('5m').sign(signingKey);
    const profile = await verify(token);
    expect(profile).toEqual({ telegramId: '5', name: null, username: null, photoUrl: null });
  });
});

describe('makeIdTokenVerifier — rejects anything untrustworthy', () => {
  it('rejects a bad signature (right kid, wrong key)', async () => {
    const token = await tokenBuilder().setExpirationTime('5m').sign(attackerKey);
    await expect(verify(token)).rejects.toThrow();
  });

  it('rejects a wrong issuer', async () => {
    const token = await new SignJWT(baseClaims())
      .setProtectedHeader({ alg: 'RS256', kid: KID })
      .setIssuer('https://evil.example.com')
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(signingKey);
    await expect(verify(token)).rejects.toThrow();
  });

  it('rejects a wrong audience (a different bot)', async () => {
    const token = await new SignJWT(baseClaims())
      .setProtectedHeader({ alg: 'RS256', kid: KID })
      .setIssuer(ISSUER)
      .setAudience('999999999')
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(signingKey);
    await expect(verify(token)).rejects.toThrow();
  });

  it('rejects an expired token', async () => {
    const token = await new SignJWT(baseClaims())
      .setProtectedHeader({ alg: 'RS256', kid: KID })
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt(nowSeconds() - 120)
      .setExpirationTime(nowSeconds() - 60)
      .sign(signingKey);
    await expect(verify(token)).rejects.toThrow();
  });

  it('rejects an alg:none (unsecured) token', async () => {
    const token = new UnsecuredJWT(baseClaims())
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime('5m')
      .encode();
    await expect(verify(token)).rejects.toThrow();
  });

  it('rejects an HS256 alg-confusion token', async () => {
    const token = await new SignJWT(baseClaims())
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(new TextEncoder().encode('a-shared-secret-an-attacker-might-guess'));
    await expect(verify(token)).rejects.toThrow();
  });

  it('rejects a token with no subject claim', async () => {
    const token = await new SignJWT({ name: 'No Sub' })
      .setProtectedHeader({ alg: 'RS256', kid: KID })
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(signingKey);
    await expect(verify(token)).rejects.toThrow();
  });
});
