// Unit tests for login tokens (docs/api-design.md 4.2). No database needed.
import { SignJWT } from 'jose';
import { describe, expect, test } from 'vitest';
import { config } from '../src/config/index.js';
import { signToken, verifyToken } from '../src/lib/token.js';
import { UnauthorizedError } from '../src/middleware/errors.js';

const ourKey = new TextEncoder().encode(config.jwtSecret);

// Builds tokens the way an attacker or a buggy client might, to check they are refused.
function tokenWith(subject: string, options: { expiresAt?: number; key?: Uint8Array } = {}) {
  return new SignJWT()
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(subject)
    .setExpirationTime(options.expiresAt ?? '1h')
    .sign(options.key ?? ourKey);
}

describe('signToken and verifyToken', () => {
  test('a signed token gives back the user id', async () => {
    expect(await verifyToken(await signToken(7))).toBe(7);
  });

  test('the token expires one hour after it is issued', async () => {
    const [, payload] = (await signToken(7)).split('.');
    const { iat, exp } = JSON.parse(Buffer.from(payload ?? '', 'base64url').toString());
    expect(exp - iat).toBe(3600);
  });

  test('rejects an expired token with a message that says so', async () => {
    const expired = await tokenWith('7', { expiresAt: Math.floor(Date.now() / 1000) - 10 });
    await expect(verifyToken(expired)).rejects.toThrow('Token expired, log in again');
  });

  test('rejects a token signed with another secret', async () => {
    const forged = await tokenWith('7', { key: new TextEncoder().encode('x'.repeat(32)) });
    await expect(verifyToken(forged)).rejects.toThrow(UnauthorizedError);
  });

  test('rejects a token whose payload was changed after signing', async () => {
    const [header, , signature] = (await signToken(7)).split('.');
    const otherPayload = Buffer.from(JSON.stringify({ sub: '8', exp: 9999999999 })).toString(
      'base64url',
    );
    await expect(verifyToken(`${header}.${otherPayload}.${signature}`)).rejects.toThrow(
      'Invalid token',
    );
  });

  test('rejects an unsigned token ("alg": "none")', async () => {
    const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const unsigned = `${encode({ alg: 'none' })}.${encode({ sub: '7', exp: 9999999999 })}.`;
    await expect(verifyToken(unsigned)).rejects.toThrow('Invalid token');
  });

  test('rejects a validly signed token whose subject is not a user id', async () => {
    await expect(verifyToken(await tokenWith('admin'))).rejects.toThrow('Invalid token');
  });

  test('rejects text that is not a token at all', async () => {
    await expect(verifyToken('not-a-token')).rejects.toThrow('Invalid token');
  });
});
