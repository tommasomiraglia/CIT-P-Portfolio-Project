// GET /api/titles?search= over HTTP: the first paged listing (2-A.3, 2-E.3).
// It only reads IMDB data; the history tests write and clean up through TestUsers.
import request from 'supertest';
import { afterAll, describe, expect, test } from 'vitest';
import { app } from '../src/app.js';
import { pool } from '../src/db/pool.js';
import { TestUsers } from './helpers/test-users.js';

const users = new TestUsers('search');

afterAll(async () => {
  await users.cleanUp();
  await pool.end();
});

// A search with a small, stable number of matches, so walking every page stays fast.
const SEARCH = 'Twilight Zone';

const search = (query: string) => request(app).get(`/api/titles?${query}`);

async function historyOf(userId: number): Promise<string[]> {
  const { rows } = await pool.query<{ value: string }>(
    'SELECT value FROM history WHERE userid = $1 ORDER BY historyid',
    [userId],
  );
  return rows.map((row) => row.value);
}

describe('GET /api/titles?search=', () => {
  test('returns the first page in the page envelope', async () => {
    const res = await search('search=Twilight%20Zone&pageSize=5');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      items: expect.any(Array),
      page: 1,
      pageSize: 5,
      prev: null,
      next: '/api/titles?search=Twilight+Zone&pageSize=5&page=2',
    });
    expect(res.body.items).toHaveLength(5);
    for (const item of res.body.items) {
      expect(item).toEqual({
        url: `/api/titles/${item.id}`,
        id: expect.stringMatching(/^tt\d{7,8}$/),
        title: expect.any(String),
      });
    }
  });

  test('following the next links visits every match exactly once', async () => {
    const seen: string[] = [];
    let next: string | null = `/api/titles?search=${encodeURIComponent(SEARCH)}&pageSize=5`;
    let pages = 0;
    while (next !== null) {
      const res = await request(app).get(next);
      expect(res.status).toBe(200);
      seen.push(...res.body.items.map((item: { id: string }) => item.id));
      next = res.body.next;
      pages += 1;
    }
    const { rows } = await pool.query<{ n: number }>(
      'SELECT count(*)::int AS n FROM string_search($1, 100000, 0)',
      [SEARCH],
    );
    expect(seen).toHaveLength(rows[0]?.n ?? -1);
    expect(new Set(seen).size).toBe(seen.length);
    expect(pages).toBe(Math.ceil(seen.length / 5));
  });

  test('ignores upper and lower case, as users type both', async () => {
    const res = await search('search=twilight%20zone');
    expect(res.status).toBe(200);
    expect(res.body.items.map((item: { id: string }) => item.id)).toContain('tt0052520');
  });

  test('a page past the end is empty and links back', async () => {
    const res = await search('search=Twilight%20Zone&page=500&pageSize=5');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      items: [],
      next: null,
      prev: '/api/titles?search=Twilight+Zone&page=499&pageSize=5',
    });
  });

  test('applies the default page size above the maximum', async () => {
    const res = await search('search=star&pageSize=1000');
    expect(res.status).toBe(200);
    expect(res.body.pageSize).toBe(20);
    expect(res.body.items).toHaveLength(20);
  });

  test.each([
    ['no search parameter', '', 'needs a "search" query parameter'],
    ['an empty search', 'search=', '"search" must be given once'],
    ['a search of only spaces', 'search=%20%20', '"search" must be given once'],
    ['a repeated search', 'search=a&search=b', '"search" must be given once'],
    ['a search that is too long', `search=${'x'.repeat(201)}`, '"search" must be given once'],
    ['an invalid page', 'search=star&page=0', 'Invalid page "0"'],
  ])('answers 400 for %s', async (_case, query, message) => {
    const res = await search(query);
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain(message);
  });
});

describe('search history', () => {
  test('saves a logged-in search once, on page 1 only', async () => {
    const user = await users.create();
    await search('search=Twilight%20Zone&pageSize=5').set('Authorization', user.authorization);
    await search('search=Twilight%20Zone&pageSize=5&page=2').set(
      'Authorization',
      user.authorization,
    );
    expect(await historyOf(user.id)).toEqual(['Twilight Zone']);
  });

  test('saves nothing for an anonymous search', async () => {
    const marker = `nothing-matches-${users.prefix}`;
    await search(`search=${marker}`);
    const { rows } = await pool.query<{ n: number }>(
      'SELECT count(*)::int AS n FROM history WHERE value = $1',
      [marker],
    );
    expect(rows[0]?.n).toBe(0);
  });

  test('rejects an invalid token instead of searching anonymously', async () => {
    const res = await search('search=star').set('Authorization', 'Bearer not.a.token');
    expect(res.status).toBe(401);
  });

  test('answers 401 when the user was deleted after logging in', async () => {
    const user = await users.create();
    await pool.query('DELETE FROM app_user WHERE userid = $1', [user.id]);
    const res = await search('search=star').set('Authorization', user.authorization);
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: { message: 'User no longer exists' } });
  });
});
