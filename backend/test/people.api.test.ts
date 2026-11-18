// The person endpoints under /api/people over HTTP (2-E.3). They only read IMDB data;
// the history tests write through TestUsers, which deletes its users afterwards.
import request from 'supertest';
import { afterAll, describe, expect, test } from 'vitest';
import { app } from '../src/app.js';
import { pool } from '../src/db/pool.js';
import type { CoPlayerDto, PersonSummaryDto, PersonWordDto } from '../src/types/person.js';
import { TestUsers } from './helpers/test-users.js';

const users = new TestUsers('people');

afterAll(async () => {
  await users.cleanUp();
  await pool.end();
});

// A person with known-for titles, co-players and words in the database.
const PERSON = 'nm0000138';
// A valid id that no person has.
const UNKNOWN_PERSON = 'nm9999999';
// A name search with a few dozen matches, so paging has more than one page.
const NAME = 'hanks';

const searchPeople = (query: string) => request(app).get(`/api/people?${query}`);

async function historyOf(userId: number): Promise<string[]> {
  const { rows } = await pool.query<{ value: string }>(
    'SELECT value FROM history WHERE userid = $1 ORDER BY historyid',
    [userId],
  );
  return rows.map((row) => row.value);
}

describe('GET /api/people?name=', () => {
  test('returns the first page of matching people in the page envelope', async () => {
    const res = await searchPeople(`name=${NAME}&pageSize=5`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      page: 1,
      pageSize: 5,
      prev: null,
      next: `/api/people?name=${NAME}&pageSize=5&page=2`,
    });
    expect(res.body.items).toHaveLength(5);
    for (const item of res.body.items as PersonSummaryDto[]) {
      expect(item).toEqual({ url: `/api/people/${item.id}`, id: item.id, name: item.name });
      expect(item.id).toMatch(/^nm\d{7,8}$/);
      // The search ignores case (docs/api-design.md 1.8).
      expect(item.name.toLowerCase()).toContain(NAME);
    }
  });

  test('following the next links visits every match exactly once', async () => {
    const ids: string[] = [];
    let next: string | null = `/api/people?name=${NAME}&pageSize=10`;
    while (next !== null) {
      const res = await request(app).get(next);
      expect(res.status).toBe(200);
      ids.push(...(res.body.items as PersonSummaryDto[]).map((item) => item.id));
      next = res.body.next;
    }
    expect(ids.length).toBeGreaterThan(10);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test.each([
    ['a missing name', 'pageSize=5', 'needs a "name" query parameter'],
    ['an empty name', 'name=%20%20', '"name" must be given once'],
    ['a name that is too long', `name=${'a'.repeat(201)}`, '"name" must be given once'],
    ['a repeated name', 'name=a&name=b', '"name" must be given once'],
    ['an invalid page', `name=${NAME}&page=0`, 'Invalid page'],
  ])('answers 400 for %s', async (_case, query, message) => {
    const res = await searchPeople(query);
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain(message);
  });
});

describe('people search history', () => {
  test('saves a logged-in search once, on page 1 only', async () => {
    const user = await users.create();
    await searchPeople(`name=${NAME}&pageSize=5`).set('Authorization', user.authorization);
    await searchPeople(`name=${NAME}&pageSize=5&page=2`).set('Authorization', user.authorization);
    expect(await historyOf(user.id)).toEqual([NAME]);
  });

  test('saves nothing for an anonymous search', async () => {
    const marker = `nobody-${users.prefix}`;
    await searchPeople(`name=${marker}`);
    const { rows } = await pool.query<{ n: number }>(
      'SELECT count(*)::int AS n FROM history WHERE value = $1',
      [marker],
    );
    expect(rows[0]?.n).toBe(0);
  });

  test('rejects an invalid token instead of searching anonymously', async () => {
    const res = await searchPeople(`name=${NAME}`).set('Authorization', 'Bearer not.a.token');
    expect(res.status).toBe(401);
  });

  test('answers 401 when the user was deleted after logging in', async () => {
    const user = await users.create();
    await pool.query('DELETE FROM app_user WHERE userid = $1', [user.id]);
    const res = await searchPeople(`name=${NAME}`).set('Authorization', user.authorization);
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: { message: 'User no longer exists' } });
  });
});

describe('GET /api/people/:id', () => {
  test('answers 200 with the person, known-for titles and links to longer lists', async () => {
    const res = await request(app).get(`/api/people/${PERSON}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      url: `/api/people/${PERSON}`,
      id: PERSON,
      name: 'Leonardo DiCaprio',
      birthYear: 1974,
      deathYear: null,
      professions: expect.arrayContaining(['actor']),
      rating: expect.any(Number),
      knownFor: expect.any(Array),
      coPlayersUrl: `/api/people/${PERSON}/co-players`,
      wordsUrl: `/api/people/${PERSON}/words`,
    });
    expect(res.body.knownFor.length).toBeGreaterThan(0);
    for (const title of res.body.knownFor as { url: string; title: string }[]) {
      expect(title).toEqual({
        url: expect.stringMatching(/^\/api\/titles\/tt\d{7,8}$/),
        title: expect.any(String),
      });
      // Every link leads to a title that exists (2-A.2).
      expect((await request(app).get(title.url)).status).toBe(200);
    }
  });

  test('answers 404 for a person that does not exist', async () => {
    const res = await request(app).get(`/api/people/${UNKNOWN_PERSON}`);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { message: `Person ${UNKNOWN_PERSON} not found` } });
  });

  test.each(['banana', 'nm123', 'tt0052520'])('answers 400 for the id %s', async (id) => {
    const res = await request(app).get(`/api/people/${id}`);
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('Invalid person id');
  });
});

describe('GET /api/people/:id/co-players', () => {
  test('lists co-players, most shared titles first, page by page', async () => {
    const firstPage = await request(app).get(`/api/people/${PERSON}/co-players?pageSize=3`);
    expect(firstPage.status).toBe(200);
    expect(firstPage.body).toMatchObject({
      page: 1,
      pageSize: 3,
      prev: null,
      next: `/api/people/${PERSON}/co-players?pageSize=3&page=2`,
    });
    const items = firstPage.body.items as CoPlayerDto[];
    expect(items).toHaveLength(3);
    for (const item of items) {
      expect(item).toEqual({
        url: `/api/people/${item.id}`,
        id: item.id,
        name: item.name,
        sharedTitles: expect.any(Number),
      });
      expect(item.id).not.toBe(PERSON);
      expect(item.sharedTitles).toBeGreaterThan(0);
    }
    const counts = items.map((item) => item.sharedTitles);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));

    const secondPage = await request(app).get(firstPage.body.next);
    const firstIds = items.map((item) => item.id);
    for (const item of secondPage.body.items as CoPlayerDto[]) {
      expect(firstIds).not.toContain(item.id);
    }
  });

  test('answers 404 for a person that does not exist', async () => {
    expect((await request(app).get(`/api/people/${UNKNOWN_PERSON}/co-players`)).status).toBe(404);
  });

  test('answers 400 for an invalid id or page', async () => {
    expect((await request(app).get('/api/people/banana/co-players')).status).toBe(400);
    expect((await request(app).get(`/api/people/${PERSON}/co-players?page=0`)).status).toBe(400);
  });
});

describe('GET /api/people/:id/words', () => {
  test("lists the words of the person's titles, most frequent first, page by page", async () => {
    const res = await request(app).get(`/api/people/${PERSON}/words?pageSize=5`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      page: 1,
      pageSize: 5,
      prev: null,
      next: `/api/people/${PERSON}/words?pageSize=5&page=2`,
    });
    const items = res.body.items as PersonWordDto[];
    expect(items).toHaveLength(5);
    for (const item of items) {
      expect(item).toEqual({
        url: `/api/titles?words=${encodeURIComponent(item.word)}&match=any`,
        word: item.word,
        frequency: expect.any(Number),
      });
    }
    const frequencies = items.map((item) => item.frequency);
    expect(frequencies).toEqual([...frequencies].sort((a, b) => b - a));
  });

  test('answers 404 for a person that does not exist', async () => {
    expect((await request(app).get(`/api/people/${UNKNOWN_PERSON}/words`)).status).toBe(404);
  });

  test('answers 400 for an invalid id or page', async () => {
    expect((await request(app).get('/api/people/banana/words')).status).toBe(400);
    expect((await request(app).get(`/api/people/${PERSON}/words?pageSize=abc`)).status).toBe(400);
  });
});
