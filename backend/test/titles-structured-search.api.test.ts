// GET /api/titles?title=&plot=&characters=&names= over HTTP: the structured search
// (docs/api-design.md 1.16, 2-E.3). It only reads IMDB data; the history tests write and
// clean up through TestUsers.
import request from 'supertest';
import { afterAll, describe, expect, test } from 'vitest';
import { app } from '../src/app.js';
import { pool } from '../src/db/pool.js';
import { TestUsers } from './helpers/test-users.js';

const users = new TestUsers('structured');

afterAll(async () => {
  await users.cleanUp();
  await pool.end();
});

// The example of user story S2: "the one where Ledger plays the Joker".
const DARK_KNIGHT = { url: '/api/titles/tt0468569', id: 'tt0468569', title: 'The Dark Knight' };

const search = (query: string) => request(app).get(`/api/titles?${query}`);

async function historyOf(userId: number): Promise<string[]> {
  const { rows } = await pool.query<{ value: string }>(
    'SELECT value FROM history WHERE userid = $1 ORDER BY historyid',
    [userId],
  );
  return rows.map((row) => row.value);
}

describe('GET /api/titles?title=&plot=&characters=&names=', () => {
  test('finds the title that matches every given field', async () => {
    const res = await search('title=dark%20knight&characters=joker&names=ledger');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      items: [DARK_KNIGHT],
      page: 1,
      pageSize: 20,
      prev: null,
      next: null,
    });
  });

  test('searches the plot too', async () => {
    const res = await search('title=dark%20knight&plot=gotham');
    expect(res.status).toBe(200);
    expect(res.body.items).toContainEqual(DARK_KNIGHT);
  });

  test('finds nothing when one field does not match, even if the others do', async () => {
    const res = await search('title=dark%20knight&names=nobody-has-this-name');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ items: [], next: null });
  });

  test('ignores upper and lower case', async () => {
    const res = await search('title=DARK%20knight&names=LEDGER');
    expect(res.body.items).toContainEqual(DARK_KNIGHT);
  });

  test('treats an empty field as not given, as a search form sends it', async () => {
    const withEmptyFields = await search('title=&plot=&characters=&names=heath%20ledger');
    const withoutThem = await search('names=heath%20ledger');
    expect(withEmptyFields.status).toBe(200);
    expect(withEmptyFields.body.items).toEqual(withoutThem.body.items);
    expect(withEmptyFields.body.items).toContainEqual(DARK_KNIGHT);
  });

  test('following the next links visits every match exactly once', async () => {
    const seen: string[] = [];
    let next: string | null = '/api/titles?title=batman&characters=joker&pageSize=5';
    let pages = 0;
    while (next !== null) {
      const res = await request(app).get(next);
      expect(res.status).toBe(200);
      for (const item of res.body.items) {
        expect(item).toEqual({
          url: `/api/titles/${item.id}`,
          id: expect.stringMatching(/^tt\d{7,8}$/),
          title: expect.any(String),
        });
      }
      seen.push(...res.body.items.map((item: { id: string }) => item.id));
      next = res.body.next;
      pages += 1;
    }
    const { rows } = await pool.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM structured_string_search('batman', NULL, 'joker', NULL, 100000, 0)",
    );
    expect(seen).toHaveLength(rows[0]?.n ?? -1);
    expect(new Set(seen).size).toBe(seen.length);
    expect(pages).toBe(Math.ceil(seen.length / 5));
    expect(pages).toBeGreaterThan(1);
  });

  test('keeps the fields in the links to other pages', async () => {
    const res = await search('title=batman&characters=joker&pageSize=5&page=2');
    expect(res.body).toMatchObject({
      page: 2,
      prev: '/api/titles?title=batman&characters=joker&pageSize=5&page=1',
      next: '/api/titles?title=batman&characters=joker&pageSize=5&page=3',
    });
  });

  test.each([
    ['only empty fields', 'title=&plot=&characters=&names=', 'Give text for at least one'],
    ['a field of only spaces', 'title=%20%20', 'Give text for at least one'],
    ['a repeated field', 'title=a&title=b', '"title" must be given once'],
    ['a field that is too long', `plot=${'x'.repeat(201)}`, '"plot" must be given once'],
    ['an invalid page', 'names=ledger&page=0', 'Invalid page "0"'],
  ])('answers 400 for %s', async (_case, query, message) => {
    const res = await search(query);
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain(message);
  });
});

describe('search history of the structured search', () => {
  test('saves a logged-in search once, on page 1 only, with the fields that were given', async () => {
    const user = await users.create();
    const query = 'title=batman&plot=&characters=joker&pageSize=5';
    await search(query).set('Authorization', user.authorization);
    await search(`${query}&page=2`).set('Authorization', user.authorization);
    expect(await historyOf(user.id)).toEqual(['title:batman characters:joker']);
  });

  test('shows up in the history list of the user', async () => {
    const user = await users.create();
    await search('names=heath%20ledger').set('Authorization', user.authorization);
    const res = await request(app)
      .get(`/api/users/${user.id}/search-history`)
      .set('Authorization', user.authorization);
    expect(res.status).toBe(200);
    expect(res.body.items.map((item: { searchText: string }) => item.searchText)).toEqual([
      'names:heath ledger',
    ]);
  });

  test('saves nothing for an anonymous search', async () => {
    const marker = `nothing-matches-${users.prefix}`;
    await search(`title=${marker}`);
    const { rows } = await pool.query<{ n: number }>(
      'SELECT count(*)::int AS n FROM history WHERE value = $1',
      [`title:${marker}`],
    );
    expect(rows[0]?.n).toBe(0);
  });

  test('saves nothing when the request is invalid', async () => {
    const user = await users.create();
    const res = await search('title=&plot=').set('Authorization', user.authorization);
    expect(res.status).toBe(400);
    expect(await historyOf(user.id)).toEqual([]);
  });

  test('rejects an invalid token instead of searching anonymously', async () => {
    const res = await search('names=ledger').set('Authorization', 'Bearer not.a.token');
    expect(res.status).toBe(401);
  });

  test('answers 401 when the user was deleted after logging in', async () => {
    const user = await users.create();
    await pool.query('DELETE FROM app_user WHERE userid = $1', [user.id]);
    const res = await search('names=ledger').set('Authorization', user.authorization);
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: { message: 'User no longer exists' } });
  });
});
