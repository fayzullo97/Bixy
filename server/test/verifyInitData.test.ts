import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { makeInitDataVerifier, type InitDataVerifier } from '../src/modules/auth/verifyInitData';

const BOT_TOKEN = '123456:test-bot-token-abcXYZ';

const SAMPLE_USER = {
  id: 111222333,
  first_name: 'Aziz',
  last_name: 'Karimov',
  username: 'aziz',
  photo_url: 'https://cdn.telegram.org/photo.jpg',
  language_code: 'uz',
};

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Signs a set of initData fields exactly the way Telegram does, so the verifier
 * is exercised against genuinely-valid input. Only `hash` is excluded from the
 * data-check-string; every other field — including `signature` when present — is
 * part of the HMAC input (matching a real Telegram payload, see the
 * `signature`-inclusion test below).
 */
function signInitData(
  fields: Record<string, string>,
  botToken = BOT_TOKEN,
  withSignature = false,
): string {
  const signed = withSignature
    ? { ...fields, signature: 'ed25519-signature-is-part-of-the-hmac' }
    : fields;
  const dataCheckString = Object.keys(signed)
    .sort()
    .map((k) => `${k}=${signed[k]}`)
    .join('\n');
  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  const params = new URLSearchParams(signed);
  params.set('hash', hash);
  return params.toString();
}

function validFields(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    auth_date: String(nowSeconds()),
    query_id: 'AAEabc123',
    user: JSON.stringify(SAMPLE_USER),
    ...overrides,
  };
}

const verify: InitDataVerifier = makeInitDataVerifier({ botToken: BOT_TOKEN });

describe('makeInitDataVerifier — accepts genuine initData', () => {
  it('verifies the HMAC and maps the user to a profile', async () => {
    const profile = await verify(signInitData(validFields()));
    expect(profile).toEqual({
      telegramId: '111222333',
      name: 'Aziz Karimov',
      username: 'aziz',
      photoUrl: 'https://cdn.telegram.org/photo.jpg',
      languageCode: 'uz',
    });
  });

  it('includes the Ed25519 `signature` field in the HMAC data-check-string', async () => {
    // Real Telegram payloads carry a `signature` field and hash OVER it; only
    // `hash` is excluded. A verifier that strips `signature` would fail here.
    const profile = await verify(signInitData(validFields(), BOT_TOKEN, true));
    expect(profile.telegramId).toBe('111222333');
  });

  it('maps a user with only an id to null optional fields', async () => {
    const fields = validFields({ user: JSON.stringify({ id: 5 }) });
    const profile = await verify(signInitData(fields));
    expect(profile).toEqual({
      telegramId: '5',
      name: null,
      username: null,
      photoUrl: null,
      languageCode: null,
    });
  });
});

describe('makeInitDataVerifier — rejects anything untrustworthy', () => {
  it('rejects a tampered field (hash no longer matches)', async () => {
    const initData = signInitData(validFields());
    const params = new URLSearchParams(initData);
    params.set('user', JSON.stringify({ ...SAMPLE_USER, id: 999 })); // swap the identity
    await expect(verify(params.toString())).rejects.toThrow();
  });

  it('rejects initData signed with a different bot token', async () => {
    const forged = signInitData(validFields(), '999999:someone-elses-token');
    await expect(verify(forged)).rejects.toThrow();
  });

  it('rejects a missing hash', async () => {
    const params = new URLSearchParams(validFields());
    await expect(verify(params.toString())).rejects.toThrow();
  });

  it('rejects an expired auth_date', async () => {
    const stale = signInitData(validFields({ auth_date: String(nowSeconds() - 90_000) }));
    await expect(verify(stale)).rejects.toThrow();
  });

  it('respects a custom maxAgeSeconds window', async () => {
    const shortLived = makeInitDataVerifier({ botToken: BOT_TOKEN, maxAgeSeconds: 60 });
    const old = signInitData(validFields({ auth_date: String(nowSeconds() - 120) }));
    await expect(shortLived(old)).rejects.toThrow();
  });

  it('rejects a missing user field', async () => {
    const fields = validFields();
    delete fields.user;
    await expect(verify(signInitData(fields))).rejects.toThrow();
  });
});
