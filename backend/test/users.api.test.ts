// Registration, login and the authentication middlewares over HTTP (2-E.3).
// These requests write through the app's own connections, so they cannot share a
// rolled-back transaction with the test. Every user created here has a name starting with
// this run's prefix and is deleted in afterAll; ON DELETE CASCADE removes their data too.
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { app } from '../src/app.js';
import { pool } from '../src/db/pool.js';
import { signToken } from '../src/lib/token.js';

const PREFIX = `t${Date.now().toString(36)}`;
const PASSWORD = 'correct horse battery';

afterAll(async () => {
  await pool.query("DELETE FROM app_user WHERE username LIKE $1 || '%'", [PREFIX]);
  await pool.end();
});

function register(name: string, overrides: Record<string, unknown> = {}) {
  return request(app)
    .post('/api/users')
    .send({
      username: `${PREFIX}-${name}`,
      email: `${PREFIX}-${name}@example.com`,
      password: PASSWORD,
      ...overrides,
    });
}

function loginAs(username: string, password = PASSWORD) {
  return request(app).post('/api/auth/login').send({ username, password });
}

describe('POST /api/users', () => {
  test('creates a user: 201, Location header, and no password in the answer', async () => {
    const res = await register('alice', {
      email: `${PREFIX}-Alice@Example.COM`,
      phoneNumber: '+45 1234',
    });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      url: expect.stringMatching(/^\/api\/users\/\d+$/),
      id: expect.any(Number),
      username: `${PREFIX}-alice`,
      email: `${PREFIX}-alice@example.com`,
      phoneNumber: '+45 1234',
    });
    expect(res.headers.location).toBe(res.body.url);
    expect(JSON.stringify(res.body)).not.toContain(PASSWORD);
  });

  test('stores the password as an Argon2id hash, never as plain text', async () => {
    await register('hashcheck');
    const { rows } = await pool.query<{ password: string }>(
      'SELECT password FROM app_user WHERE username = $1',
      [`${PREFIX}-hashcheck`],
    );
    expect(rows[0]?.password).toMatch(/^\$argon2id\$/);
  });

  test('answers 409 for a username that is taken', async () => {
    await register('bob');
    const res = await register('bob', { email: `${PREFIX}-bob2@example.com` });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: { message: `Username "${PREFIX}-bob" is already taken` } });
  });

  test('answers 409 for an email that is taken, whatever its case', async () => {
    await register('carol');
    const res = await register('carol2', { email: `${PREFIX}-CAROL@example.com` });
    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/^Email ".*" is already registered$/);
  });

  test.each([
    ['no body', undefined, 'Expected a JSON object'],
    ['a missing username', { username: undefined }, '"username" is required'],
    ['a short username', { username: 'ab' }, '"username" must be 3 to 30'],
    ['a username with spaces', { username: 'a b c' }, '"username" must be 3 to 30'],
    ['an invalid email', { email: 'not-an-email' }, '"email" must be'],
    ['a short password', { password: '1234567' }, '"password" must be 8 to 128'],
    ['a long password', { password: 'x'.repeat(129) }, '"password" must be 8 to 128'],
    ['a password that is not a string', { password: 12345678 }, '"password" is required'],
    ['an invalid phone number', { phoneNumber: 'call me' }, '"phoneNumber" must be'],
  ])('answers 400 for %s', async (_case, overrides, message) => {
    const res =
      overrides === undefined
        ? await request(app).post('/api/users')
        : await register('invalid', overrides);
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain(message);
  });
});

describe('POST /api/auth/login', () => {
  const username = `${PREFIX}-dave`;
  beforeAll(() => register('dave'));

  test('answers 200 with a token and the user', async () => {
    const res = await loginAs(username);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      token: expect.stringMatching(/^[\w-]+\.[\w-]+\.[\w-]+$/),
      user: expect.objectContaining({ username, url: expect.any(String) }),
    });
  });

  test('gives the same 401 for a wrong password and an unknown username', async () => {
    const wrongPassword = await loginAs(username, 'wrong password');
    const unknownUser = await loginAs(`${PREFIX}-nobody`);
    expect(wrongPassword.status).toBe(401);
    expect(unknownUser.status).toBe(401);
    expect(wrongPassword.body).toEqual(unknownUser.body);
    expect(wrongPassword.headers['www-authenticate']).toBe('Bearer');
  });

  test('answers 400 when a field is missing', async () => {
    const res = await request(app).post('/api/auth/login').send({ username });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('"password" is required');
  });
});

describe('GET /api/users/:userId (authenticate and authorizeSelf)', () => {
  let userId: number;
  let token: string;

  beforeAll(async () => {
    userId = (await register('erin')).body.id;
    token = (await loginAs(`${PREFIX}-erin`)).body.token;
  });

  const getUser = (id: number | string, authorization?: string) => {
    const req = request(app).get(`/api/users/${id}`);
    return authorization === undefined ? req : req.set('Authorization', authorization);
  };

  test('answers 200 with the user for their own token', async () => {
    const res = await getUser(userId, `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: userId, username: `${PREFIX}-erin` });
  });

  test('answers 401 without an Authorization header', async () => {
    const res = await getUser(userId);
    expect(res.status).toBe(401);
    expect(res.headers['www-authenticate']).toBe('Bearer');
  });

  test.each([
    ['another scheme', 'Basic dXNlcjpwYXNz'],
    ['a malformed token', 'Bearer not.a.token'],
    ['a missing token', 'Bearer '],
  ])('answers 401 for %s', async (_case, header) => {
    expect((await getUser(userId, header)).status).toBe(401);
  });

  test("answers 403 for another user's id", async () => {
    const res = await getUser(userId + 1, `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: { message: "You can only access your own user's data" } });
  });

  test('answers 400 for an id that is not a positive integer', async () => {
    expect((await getUser('abc', `Bearer ${token}`)).status).toBe(400);
    expect((await getUser('99999999999', `Bearer ${token}`)).status).toBe(400);
  });

  test('checks the token before the id, so an anonymous caller learns nothing', async () => {
    expect((await getUser('abc')).status).toBe(401);
  });

  test('answers 401, not 404, when the user was deleted after logging in', async () => {
    const goneId = (await register('frank')).body.id;
    const goneToken = await signToken(goneId);
    await pool.query('DELETE FROM app_user WHERE userid = $1', [goneId]);
    const res = await getUser(goneId, `Bearer ${goneToken}`);
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: { message: 'User no longer exists' } });
  });
});
