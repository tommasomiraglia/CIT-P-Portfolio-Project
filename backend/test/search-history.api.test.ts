// The search history endpoints under /api/users/:userId/search-history over HTTP (2-E.3).
// Entries are made the way the frontend makes them: by a logged-in title search.
// Saving a search is tested with the search itself, in titles-search.api.test.ts.
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { app } from '../src/app.js';
import { pool } from '../src/db/pool.js';
import { type TestUser, TestUsers } from './helpers/test-users.js';

const users = new TestUsers('history');

afterAll(async () => {
  await users.cleanUp();
  await pool.end();
});

const historyPath = (user: TestUser, entryId = '') =>
  `/api/users/${user.id}/search-history${entryId === '' ? '' : `/${entryId}`}`;

const searchTitles = (user: TestUser, text: string) =>
  request(app)
    .get(`/api/titles?search=${encodeURIComponent(text)}&pageSize=1`)
    .set('Authorization', user.authorization);

const listHistory = (user: TestUser, query = '') =>
  request(app)
    .get(`${historyPath(user)}${query}`)
    .set('Authorization', user.authorization);

const deleteEntry = (user: TestUser, entryId: string) =>
  request(app).delete(historyPath(user, entryId)).set('Authorization', user.authorization);

const clearHistory = (user: TestUser) =>
  request(app).delete(historyPath(user)).set('Authorization', user.authorization);

async function searchTextsOf(user: TestUser): Promise<string[]> {
  const res = await listHistory(user);
  return res.body.items.map((item: { searchText: string }) => item.searchText);
}

describe('GET /api/users/:userId/search-history', () => {
  test('lists my searches newest first, page by page', async () => {
    const user = await users.create();
    await searchTitles(user, 'Twilight Zone');
    await searchTitles(user, 'The Twilight Zone');

    const firstPage = await listHistory(user, '?pageSize=1');
    expect(firstPage.status).toBe(200);
    expect(firstPage.body).toEqual({
      items: [
        {
          url: expect.stringMatching(new RegExp(`^/api/users/${user.id}/search-history/\\d+$`)),
          id: expect.stringMatching(/^\d+$/),
          searchText: 'The Twilight Zone',
          time: expect.stringMatching(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/),
        },
      ],
      page: 1,
      pageSize: 1,
      prev: null,
      next: `${historyPath(user)}?pageSize=1&page=2`,
    });
    // The id is the last part of the url, so the client never has to build a URI.
    expect(firstPage.body.items[0].url).toBe(historyPath(user, firstPage.body.items[0].id));

    const secondPage = await request(app)
      .get(firstPage.body.next)
      .set('Authorization', user.authorization);
    expect(secondPage.body.items.map((item: { searchText: string }) => item.searchText)).toEqual([
      'Twilight Zone',
    ]);
    expect(secondPage.body.next).toBeNull();
    expect(secondPage.body.prev).toBe(`${historyPath(user)}?pageSize=1&page=1`);
  });

  test('answers an empty page for a user who never searched', async () => {
    const user = await users.create();
    const res = await listHistory(user);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items: [], page: 1, pageSize: 20, prev: null, next: null });
  });

  test('answers 400 for an invalid page', async () => {
    const user = await users.create();
    expect((await listHistory(user, '?page=0')).status).toBe(400);
  });
});

describe('DELETE /api/users/:userId/search-history/:entryId', () => {
  test('answers 204 with no body, removes only that entry, then 404', async () => {
    const user = await users.create();
    await searchTitles(user, 'Twilight Zone');
    await searchTitles(user, 'The Twilight Zone');
    const [newest] = (await listHistory(user)).body.items as { id: string }[];

    const deleted = await deleteEntry(user, newest?.id ?? '');
    expect(deleted.status).toBe(204);
    expect(deleted.text).toBe('');
    expect(await searchTextsOf(user)).toEqual(['Twilight Zone']);

    expect((await deleteEntry(user, newest?.id ?? '')).status).toBe(404);
  });

  test("answers 404 for another user's entry, and leaves it in place", async () => {
    const owner = await users.create();
    const other = await users.create();
    await searchTitles(owner, 'Twilight Zone');
    const [entry] = (await listHistory(owner)).body.items as { id: string }[];

    // The other user's own URL with the owner's entry id: authorizeSelf lets it through,
    // so only the database function can stop it.
    const res = await deleteEntry(other, entry?.id ?? '');
    expect(res.status).toBe(404);
    expect(await searchTextsOf(owner)).toEqual(['Twilight Zone']);
  });

  test.each([
    ['a word', 'abc'],
    ['zero', '0'],
    ['a number larger than a BIGINT', '9223372036854775808'],
  ])('answers 400 for %s as the entry id', async (_case, entryId) => {
    const user = await users.create();
    const res = await deleteEntry(user, entryId);
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('Invalid search history entry id');
  });
});

describe('DELETE /api/users/:userId/search-history', () => {
  test('answers 204 and removes all of my searches, but not those of others', async () => {
    const user = await users.create();
    const other = await users.create();
    await searchTitles(user, 'Twilight Zone');
    await searchTitles(user, 'The Twilight Zone');
    await searchTitles(other, 'Twilight Zone');

    const res = await clearHistory(user);
    expect(res.status).toBe(204);
    expect(await searchTextsOf(user)).toEqual([]);
    expect(await searchTextsOf(other)).toEqual(['Twilight Zone']);
  });

  test('answers 204 when there is nothing to remove', async () => {
    const user = await users.create();
    expect((await clearHistory(user)).status).toBe(204);
  });
});

describe('who may use the search history endpoints', () => {
  let owner: TestUser;
  let intruder: TestUser;
  let entryId: string;

  beforeAll(async () => {
    owner = await users.create();
    intruder = await users.create();
    await searchTitles(owner, 'Twilight Zone');
    entryId = (await listHistory(owner)).body.items[0].id;
  });

  // Every route of the resource, as [method, path of the owner's data].
  const routes = (): ['get' | 'delete', string][] => [
    ['get', historyPath(owner)],
    ['delete', historyPath(owner)],
    ['delete', historyPath(owner, entryId)],
  ];

  test('answers 401 without a token on every route', async () => {
    for (const [method, path] of routes()) {
      const res = await request(app)[method](path);
      expect(res.status, `${method} ${path}`).toBe(401);
      expect(res.headers['www-authenticate']).toBe('Bearer');
    }
  });

  test("answers 403 for another user's history on every route", async () => {
    for (const [method, path] of routes()) {
      const res = await request(app)[method](path).set('Authorization', intruder.authorization);
      expect(res.status, `${method} ${path}`).toBe(403);
    }
    // The intruder's DELETEs changed nothing.
    expect(await searchTextsOf(owner)).toEqual(['Twilight Zone']);
  });

  test('answers 401 on every route when the user was deleted after logging in', async () => {
    const gone = await users.create();
    await pool.query('DELETE FROM app_user WHERE userid = $1', [gone.id]);
    for (const [method, path] of [
      ['get', historyPath(gone)],
      ['delete', historyPath(gone)],
      ['delete', historyPath(gone, '1')],
    ] as const) {
      const res = await request(app)[method](path).set('Authorization', gone.authorization);
      expect(res.status, `${method} ${path}`).toBe(401);
      expect(res.body).toEqual({ error: { message: 'User no longer exists' } });
    }
  });
});
