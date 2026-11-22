// PATCH /api/users/:userId over HTTP (2-E.3).
// Every username set here keeps the TestUsers prefix, so cleanUp() still finds the user.
import request from 'supertest';
import { afterAll, describe, expect, test } from 'vitest';
import { app } from '../src/app.js';
import { pool } from '../src/db/pool.js';
import { signToken } from '../src/lib/token.js';
import { type TestUser, TestUsers } from './helpers/test-users.js';

const users = new TestUsers('patch');

afterAll(async () => {
  await users.cleanUp();
  await pool.end();
});

const patchUser = (user: TestUser, body?: object, id: number = user.id) =>
  request(app).patch(`/api/users/${id}`).set('Authorization', user.authorization).send(body);

const getUser = (user: TestUser) =>
  request(app).get(`/api/users/${user.id}`).set('Authorization', user.authorization);

describe('PATCH /api/users/:userId', () => {
  test('changes the username and answers 200 with the user as GET shows it', async () => {
    const user = await users.create();
    const username = `${user.username}-new`;
    const res = await patchUser(user, { username });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      url: `/api/users/${user.id}`,
      id: user.id,
      username,
      email: `${user.username}@example.com`,
      phoneNumber: null,
    });
    expect((await getUser(user)).body).toEqual(res.body);
  });

  test('changes the email and stores it in lowercase', async () => {
    const user = await users.create();
    const res = await patchUser(user, { email: `${user.username}-New@Example.COM` });
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(`${user.username}-new@example.com`);
    expect((await getUser(user)).body.email).toBe(`${user.username}-new@example.com`);
  });

  test('sets the phone number, and removes it again with null', async () => {
    const user = await users.create();
    const set = await patchUser(user, { phoneNumber: '+45 12 34 56 78' });
    expect(set.status).toBe(200);
    expect(set.body.phoneNumber).toBe('+45 12 34 56 78');

    const cleared = await patchUser(user, { phoneNumber: null });
    expect(cleared.status).toBe(200);
    expect(cleared.body.phoneNumber).toBeNull();
    expect((await getUser(user)).body.phoneNumber).toBeNull();
  });

  test('leaves the fields that are not sent as they were', async () => {
    const user = await users.create();
    await patchUser(user, { phoneNumber: '12345678' });
    const res = await patchUser(user, { email: `${user.username}-other@example.com` });
    expect(res.body).toMatchObject({ username: user.username, phoneNumber: '12345678' });
  });

  test('ignores other fields, including a password', async () => {
    const user = await users.create();
    const res = await patchUser(user, { phoneNumber: '1234', password: 'a new password', id: 1 });
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(user.id);
    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: user.username, password: 'test password 123' });
    expect(login.status).toBe(200);
  });

  test('accepts the username the user already has', async () => {
    const user = await users.create();
    const res = await patchUser(user, { username: user.username });
    expect(res.status).toBe(200);
  });

  test.each([
    ['no body', undefined, 'Expected a JSON object'],
    ['an empty object', {}, 'Send at least one of'],
    ['only unknown fields', { password: 'a new password' }, 'Send at least one of'],
    ['a short username', { username: 'ab' }, '"username" must be 3 to 30'],
    ['a username with spaces', { username: 'a b c' }, '"username" must be 3 to 30'],
    ['a username of null', { username: null }, '"username" must be 3 to 30'],
    ['a username that is not text', { username: 12345 }, '"username" must be 3 to 30'],
    ['an invalid email', { email: 'not-an-email' }, '"email" must be'],
    ['an email that is too long', { email: `${'x'.repeat(250)}@example.com` }, '"email" must be'],
    ['an email of null', { email: null }, '"email" must be'],
    ['an invalid phone number', { phoneNumber: 'call me' }, '"phoneNumber" must be'],
    ['a phone number that is not text', { phoneNumber: 12345678 }, '"phoneNumber" must be'],
  ])('answers 400 for %s, and changes nothing', async (_case, body, message) => {
    const user = await users.create();
    const before = (await getUser(user)).body;
    const res = await patchUser(user, body);
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain(message);
    expect((await getUser(user)).body).toEqual(before);
  });

  test('answers 400 and changes nothing when one of several fields is invalid', async () => {
    const user = await users.create();
    const res = await patchUser(user, { phoneNumber: '1234', email: 'not-an-email' });
    expect(res.status).toBe(400);
    expect((await getUser(user)).body.phoneNumber).toBeNull();
  });

  test('answers 409 for a username another user has', async () => {
    const [user, other] = [await users.create(), await users.create()];
    const res = await patchUser(user, { username: other.username });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      error: { message: `Username "${other.username}" is already taken` },
    });
    expect((await getUser(user)).body.username).toBe(user.username);
  });

  test('answers 409 for an email another user has, whatever its case', async () => {
    const [user, other] = [await users.create(), await users.create()];
    const res = await patchUser(user, { email: `${other.username}@EXAMPLE.com` });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      error: { message: `Email "${other.username}@example.com" is already registered` },
    });
  });

  test('answers 200 and 409, never 500, when two users take the same username at once', async () => {
    const [first, second] = [await users.create(), await users.create()];
    const username = `${users.prefix}-race`;
    const answers = await Promise.all([
      patchUser(first, { username }),
      patchUser(second, { username }),
    ]);
    expect(answers.map((res) => res.status).sort()).toEqual([200, 409]);
  });

  test('answers 401 without a token', async () => {
    const user = await users.create();
    const res = await request(app).patch(`/api/users/${user.id}`).send({ phoneNumber: '1234' });
    expect(res.status).toBe(401);
  });

  test("answers 403 for another user's id, and changes nothing", async () => {
    const [user, other] = [await users.create(), await users.create()];
    const res = await patchUser(user, { phoneNumber: '1234' }, other.id);
    expect(res.status).toBe(403);
    expect((await getUser(other)).body.phoneNumber).toBeNull();
  });

  test('answers 400 for a user id that is not a positive integer', async () => {
    const user = await users.create();
    const res = await request(app)
      .patch('/api/users/abc')
      .set('Authorization', user.authorization)
      .send({ phoneNumber: '1234' });
    expect(res.status).toBe(400);
  });

  test('answers 401 when the user was deleted after logging in', async () => {
    const user = await users.create();
    const token = await signToken(user.id);
    await pool.query('DELETE FROM app_user WHERE userid = $1', [user.id]);
    const res = await request(app)
      .patch(`/api/users/${user.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ phoneNumber: '1234' });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: { message: 'User no longer exists' } });
  });
});
