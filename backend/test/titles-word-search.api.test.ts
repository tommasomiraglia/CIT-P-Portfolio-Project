// GET /api/titles?words=a,b&match=exact|any|ranked and GET /api/words?words=a,b over HTTP:
// the searches on the word index (docs/api-design.md 1.17, 2-E.3). Also the rule that one
// request uses one kind of search. They only read IMDB data, except the history check,
// which writes and cleans up through TestUsers.
import request from 'supertest';
import { afterAll, describe, expect, test } from 'vitest';
import { app } from '../src/app.js';
import { pool } from '../src/db/pool.js';
import { TestUsers } from './helpers/test-users.js';

const users = new TestUsers('words');

afterAll(async () => {
  await users.cleanUp();
  await pool.end();
});

// Two words with a small, stable number of matches, so walking every page stays fast.
const WORDS = ['twilight', 'zone'];
const TWILIGHT_ZONE = 'tt0052520';

const search = (query: string) => request(app).get(`/api/titles?${query}`);
const relatedWords = (query: string) => request(app).get(`/api/words?${query}`);

interface Item {
  id: string;
  matchedWords?: number;
  relevance?: number;
}

// Follows the next links from `first` and returns every item.
async function walk(first: string): Promise<Item[]> {
  const items: Item[] = [];
  let next: string | null = first;
  while (next !== null) {
    const res = await request(app).get(next);
    expect(res.status).toBe(200);
    items.push(...res.body.items);
    next = res.body.next;
  }
  return items;
}

async function countOf(searchFunction: string): Promise<number> {
  // The function name comes from this file, never from input.
  const { rows } = await pool.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM ${searchFunction}($1::text[], 100000, 0)`,
    [WORDS],
  );
  return rows[0]?.n ?? -1;
}

// How many of WORDS the word index holds for each of the titles.
async function wordsFoundIn(titleIds: string[]): Promise<Map<string, number>> {
  const { rows } = await pool.query<{ tconst: string; n: number }>(
    `SELECT tconst, count(DISTINCT word)::int AS n
     FROM wi
     WHERE tconst = ANY($1::text[]) AND word = ANY($2::text[])
     GROUP BY tconst`,
    [titleIds, WORDS],
  );
  return new Map(rows.map((row) => [row.tconst, row.n]));
}

describe('GET /api/titles?words=&match=exact', () => {
  test('returns titles in the page envelope, each as a title in a list', async () => {
    const res = await search('words=twilight,zone&match=exact&pageSize=5');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      items: expect.any(Array),
      page: 1,
      pageSize: 5,
      prev: null,
      next: '/api/titles?words=twilight%2Czone&match=exact&pageSize=5&page=2',
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

  test('visits every match exactly once, and each contains every word', async () => {
    const items = await walk('/api/titles?words=twilight,zone&match=exact&pageSize=5');
    const ids = items.map((item) => item.id);
    expect(ids).toHaveLength(await countOf('exact_match_search'));
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain(TWILIGHT_ZONE);
    const found = await wordsFoundIn(ids);
    for (const id of ids) {
      expect(found.get(id), id).toBe(WORDS.length);
    }
  });

  test('ignores upper case, spaces around words and repeated words', async () => {
    const plain = await search('words=twilight,zone&match=exact&pageSize=50');
    const messy = await search('words=Zone,%20TWILIGHT%20,zone,&match=exact&pageSize=50');
    expect(messy.status).toBe(200);
    expect(messy.body.items).toEqual(plain.body.items);
  });

  test('answers an empty page for a word that is in no title', async () => {
    const res = await search('words=twilight,zzzznotaword&match=exact');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ items: [], prev: null, next: null });
  });
});

describe('GET /api/titles?words=&match=any', () => {
  test('visits every title with at least one word, those with the most words first', async () => {
    const items = await walk('/api/titles?words=twilight,zone&match=any&pageSize=50');
    const ids = items.map((item) => item.id);
    expect(ids).toHaveLength(await countOf('any_match_search'));
    expect(new Set(ids).size).toBe(ids.length);

    const counts = items.map((item) => item.matchedWords);
    expect(counts).toEqual([...counts].sort((a, b) => (b ?? 0) - (a ?? 0)));
    // Wider than exact: it also holds titles with only one of the two words.
    expect(counts[0]).toBe(2);
    expect(counts.at(-1)).toBe(1);

    const found = await wordsFoundIn(ids);
    for (const item of items) {
      expect(item.matchedWords, item.id).toBe(found.get(item.id));
    }
  });

  test("the url of a word in a person's word list is a working word search", async () => {
    const words = await request(app).get('/api/people/nm0000138/words?pageSize=1');
    const res = await request(app).get(words.body.items[0].url);
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    expect(res.body.items[0]).toMatchObject({ matchedWords: 1 });
  });
});

describe('GET /api/titles?words=&match=ranked', () => {
  test('orders by relevance, highest first, and puts the best match on top', async () => {
    const items = await walk('/api/titles?words=twilight,zone&match=ranked&pageSize=50');
    const ids = items.map((item) => item.id);
    expect(ids).toHaveLength(await countOf('weights_search'));
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids[0]).toBe(TWILIGHT_ZONE);

    const relevance = items.map((item) => item.relevance ?? Number.NaN);
    expect(relevance.every((score) => score > 0)).toBe(true);
    expect(relevance).toEqual([...relevance].sort((a, b) => b - a));
  });

  test('is what a search without "match" does', async () => {
    const ranked = await search('words=twilight,zone&match=ranked&pageSize=5');
    const byDefault = await search('words=twilight,zone&pageSize=5');
    expect(byDefault.status).toBe(200);
    expect(byDefault.body.items).toEqual(ranked.body.items);
    expect(byDefault.body.next).toBe('/api/titles?words=twilight%2Czone&pageSize=5&page=2');
  });
});

describe('GET /api/titles with invalid word search parameters', () => {
  test.each([
    ['an empty word list', 'words=', '"words" must be given once'],
    ['only commas', 'words=,,', '"words" must be given once'],
    ['a repeated parameter', 'words=twilight&words=zone', '"words" must be given once'],
    ['a word with a space', 'words=twilight%20zone', '"words" must be given once'],
    [
      'more than 10 words',
      `words=${Array.from({ length: 11 }, (_, i) => `w${i}`).join(',')}`,
      '"words" must be given once',
    ],
    ['a word that is too long', `words=${'x'.repeat(61)}`, '"words" must be given once'],
    ['"match" without "words"', 'match=any', '"words" must be given once'],
    ['an unknown way to match', 'words=zone&match=best', '"match" must be "exact", "any"'],
    ['a repeated "match"', 'words=zone&match=any&match=exact', '"match" must be "exact", "any"'],
    ['an invalid page size', 'words=zone&pageSize=abc', 'Invalid pageSize "abc"'],
  ])('answers 400 for %s', async (_case, query, message) => {
    const res = await search(query);
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain(message);
  });
});

describe('one kind of search per request', () => {
  test.each([
    ['text and words', 'search=zone&words=zone'],
    ['text and a field', 'search=zone&title=zone'],
    ['a field and words', 'names=serling&words=zone'],
    ['text and "match"', 'search=zone&match=any'],
    ['a field and "match"', 'title=zone&match=exact'],
    ['all three', 'search=zone&plot=zone&words=zone'],
    // Decided by which parameters are present, so an empty one still counts.
    ['text and an empty field', 'search=zone&title='],
  ])('answers 400 for %s', async (_case, query) => {
    const res = await search(query);
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('Use one kind of search per request');
  });

  test('answers 400 when no search parameter is given at all', async () => {
    const res = await search('pageSize=5');
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('Searching titles needs "search"');
  });
});

describe('the word search and the history', () => {
  test('a logged-in word search is not saved', async () => {
    const user = await users.create();
    const res = await search('words=twilight,zone').set('Authorization', user.authorization);
    expect(res.status).toBe(200);
    const { rows } = await pool.query('SELECT 1 FROM history WHERE userid = $1', [user.id]);
    expect(rows).toHaveLength(0);
  });

  test('rejects an invalid token, like the other searches of the collection', async () => {
    const res = await search('words=zone').set('Authorization', 'Bearer not.a.token');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/words?words=', () => {
  test('lists the words that occur with the given ones, most frequent first', async () => {
    const res = await relatedWords('words=twilight,zone&pageSize=5');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      page: 1,
      pageSize: 5,
      prev: null,
      next: '/api/words?words=twilight%2Czone&pageSize=5&page=2',
    });
    const { rows } = await pool.query<{ word: string; freq: number }>(
      'SELECT word, freq::int AS freq FROM words_query($1::text[], 5, 0)',
      [WORDS],
    );
    expect(res.body.items).toEqual(
      rows.map((row) => ({
        url: `/api/titles?words=${encodeURIComponent(row.word)}&match=any`,
        word: row.word,
        frequency: row.freq,
      })),
    );
    const frequencies = res.body.items.map((item: { frequency: number }) => item.frequency);
    expect(frequencies).toEqual([...frequencies].sort((a, b) => b - a));
  });

  test('leaves out the given words themselves', async () => {
    const res = await relatedWords('words=Twilight,ZONE&pageSize=100');
    const words = res.body.items.map((item: { word: string }) => item.word);
    expect(words).toHaveLength(100);
    expect(words).not.toContain('twilight');
    expect(words).not.toContain('zone');
  });

  test('the second page continues where the first ended', async () => {
    const first = await relatedWords('words=twilight,zone&pageSize=10');
    const second = await request(app).get(first.body.next);
    const both = await relatedWords('words=twilight,zone&pageSize=20');
    expect(second.body.prev).toBe('/api/words?words=twilight%2Czone&pageSize=10&page=1');
    expect([...first.body.items, ...second.body.items]).toEqual(both.body.items);
  });

  test('the url of a word is a working word search', async () => {
    const words = await relatedWords('words=twilight,zone&pageSize=1');
    const res = await request(app).get(words.body.items[0].url);
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
  });

  test('answers an empty page for a word that is in no title', async () => {
    const res = await relatedWords('words=zzzznotaword');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items: [], page: 1, pageSize: 20, prev: null, next: null });
  });

  test.each([
    ['no words parameter', '', '"words" must be given once'],
    ['an empty word list', 'words=', '"words" must be given once'],
    ['a repeated parameter', 'words=twilight&words=zone', '"words" must be given once'],
    ['a word with a space', 'words=twilight%20zone', '"words" must be given once'],
    ['an invalid page', 'words=zone&page=0', 'Invalid page "0"'],
  ])('answers 400 for %s', async (_case, query, message) => {
    const res = await relatedWords(query);
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain(message);
  });

  test('only supports GET: the word index is read-only', async () => {
    expect((await request(app).post('/api/words').send({ words: 'zone' })).status).toBe(404);
  });
});
