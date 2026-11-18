// The genre catalogue (/api/genres) and a user's favourite genres
// (/api/users/:userId/genres) over HTTP (2-E.3).
// The catalogue is IMDB data and only read; favourites are removed with their test users.
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { app } from '../src/app.js';
import { pool } from '../src/db/pool.js';
import type { GenreDto } from '../src/types/genre.js';
import { type TestUser, TestUsers } from './helpers/test-users.js';

const users = new TestUsers('genres');

// Two genres from the catalogue, read through the API before the tests.
let genre: GenreDto;
let otherGenre: GenreDto;

beforeAll(async () => {
  const res = await request(app).get('/api/genres?pageSize=2');
  [genre, otherGenre] = res.body.items as [GenreDto, GenreDto];
});

afterAll(async () => {
  await users.cleanUp();
  await pool.end();
});

// The largest INTEGER: a valid id that no genre has.
const UNKNOWN_GENRE_ID = 2_147_483_647;

const favouritePath = (user: TestUser, genreId: number | string = '') =>
  `/api/users/${user.id}/genres${genreId === '' ? '' : `/${genreId}`}`;

const putFavourite = (user: TestUser, genreId: number | string) =>
  request(app).put(favouritePath(user, genreId)).set('Authorization', user.authorization);

const getFavourite = (user: TestUser, genreId: number | string) =>
  request(app).get(favouritePath(user, genreId)).set('Authorization', user.authorization);

const deleteFavourite = (user: TestUser, genreId: number | string) =>
  request(app).delete(favouritePath(user, genreId)).set('Authorization', user.authorization);

const listFavourites = (user: TestUser, query = '') =>
  request(app)
    .get(`${favouritePath(user)}${query}`)
    .set('Authorization', user.authorization);

describe('GET /api/genres', () => {
  test('lists genres in the page envelope, sorted by name', async () => {
    const res = await request(app).get('/api/genres?pageSize=3');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      page: 1,
      pageSize: 3,
      prev: null,
      next: '/api/genres?pageSize=3&page=2',
    });
    expect(res.body.items).toHaveLength(3);
    for (const item of res.body.items as GenreDto[]) {
      expect(item).toEqual({ url: `/api/genres/${item.id}`, id: item.id, name: item.name });
    }
    const names = (res.body.items as GenreDto[]).map((item) => item.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  test('following the next link gives the following genres', async () => {
    const first = await request(app).get('/api/genres?pageSize=2');
    const second = await request(app).get(first.body.next);
    expect(second.status).toBe(200);
    expect(second.body.prev).toBe('/api/genres?pageSize=2&page=1');
    const firstIds = (first.body.items as GenreDto[]).map((item) => item.id);
    for (const item of second.body.items as GenreDto[]) {
      expect(firstIds).not.toContain(item.id);
    }
  });

  test('answers 400 for an invalid page size', async () => {
    expect((await request(app).get('/api/genres?pageSize=abc')).status).toBe(400);
  });
});

describe('GET /api/genres/:genreId', () => {
  test('answers 200 with the genre its url names', async () => {
    const res = await request(app).get(genre.url);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(genre);
  });

  test('answers 404 for a genre that does not exist', async () => {
    const res = await request(app).get(`/api/genres/${UNKNOWN_GENRE_ID}`);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { message: `Genre ${UNKNOWN_GENRE_ID} not found` } });
  });

  test.each([
    ['a word', 'abc'],
    ['zero', '0'],
    ['a number larger than an INTEGER', '2147483648'],
  ])('answers 400 for %s as the id', async (_case, genreId) => {
    expect((await request(app).get(`/api/genres/${genreId}`)).status).toBe(400);
  });
});

describe('PUT /api/users/:userId/genres/:genreId', () => {
  test('answers 200 with the genre, also when it already is a favourite', async () => {
    const user = await users.create();
    const first = await putFavourite(user, genre.id);
    expect(first.status).toBe(200);
    expect(first.body).toEqual(genre);

    // PUT is idempotent: sending it again changes nothing and is not an error (1.6).
    const again = await putFavourite(user, genre.id);
    expect(again.status).toBe(200);
    expect(again.body).toEqual(genre);
    expect((await listFavourites(user)).body.items).toEqual([genre]);
  });

  test('answers 404 for a genre that does not exist, and stores nothing', async () => {
    const user = await users.create();
    const res = await putFavourite(user, UNKNOWN_GENRE_ID);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { message: `Genre ${UNKNOWN_GENRE_ID} not found` } });
    expect((await listFavourites(user)).body.items).toEqual([]);
  });

  test('answers 400 for an id that is not a positive integer', async () => {
    const user = await users.create();
    expect((await putFavourite(user, 'abc')).status).toBe(400);
  });
});

describe('GET /api/users/:userId/genres and /:genreId', () => {
  test('lists only my own favourites, sorted by name, page by page', async () => {
    const user = await users.create();
    const other = await users.create();
    await putFavourite(user, genre.id);
    await putFavourite(user, otherGenre.id);
    await putFavourite(other, genre.id);

    const firstPage = await listFavourites(user, '?pageSize=1');
    expect(firstPage.status).toBe(200);
    expect(firstPage.body).toEqual({
      items: [genre],
      page: 1,
      pageSize: 1,
      prev: null,
      next: `${favouritePath(user)}?pageSize=1&page=2`,
    });
    const secondPage = await request(app)
      .get(firstPage.body.next)
      .set('Authorization', user.authorization);
    expect(secondPage.body).toMatchObject({ items: [otherGenre], next: null });
  });

  test('answers 200 with one favourite, and 404 for a genre that is not one', async () => {
    const user = await users.create();
    await putFavourite(user, genre.id);
    expect((await getFavourite(user, genre.id)).body).toEqual(genre);

    const res = await getFavourite(user, otherGenre.id);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: { message: `Genre ${otherGenre.id} is not one of your favourite genres` },
    });
  });
});

describe('DELETE /api/users/:userId/genres/:genreId', () => {
  test('answers 204 with no body and removes the favourite, then 404', async () => {
    const user = await users.create();
    await putFavourite(user, genre.id);

    const res = await deleteFavourite(user, genre.id);
    expect(res.status).toBe(204);
    expect(res.text).toBe('');
    expect((await getFavourite(user, genre.id)).status).toBe(404);
    expect((await deleteFavourite(user, genre.id)).status).toBe(404);
  });
});

describe('who may use the favourite genre endpoints', () => {
  let owner: TestUser;
  let intruder: TestUser;

  beforeAll(async () => {
    owner = await users.create();
    intruder = await users.create();
    await putFavourite(owner, genre.id);
  });

  // Every route of the resource, as [method, path of the owner's data].
  const routes = (): ['get' | 'put' | 'delete', string][] => [
    ['get', favouritePath(owner)],
    ['get', favouritePath(owner, genre.id)],
    ['put', favouritePath(owner, otherGenre.id)],
    ['delete', favouritePath(owner, genre.id)],
  ];

  test('answers 401 without a token on every route', async () => {
    for (const [method, path] of routes()) {
      const res = await request(app)[method](path);
      expect(res.status, `${method} ${path}`).toBe(401);
      expect(res.headers['www-authenticate']).toBe('Bearer');
    }
  });

  test("answers 403 for another user's favourites on every route", async () => {
    for (const [method, path] of routes()) {
      const res = await request(app)[method](path).set('Authorization', intruder.authorization);
      expect(res.status, `${method} ${path}`).toBe(403);
    }
    // The intruder's PUT and DELETE changed nothing.
    expect((await listFavourites(owner)).body.items).toEqual([genre]);
  });

  test('answers 401 on every route when the user was deleted after logging in', async () => {
    const gone = await users.create();
    await pool.query('DELETE FROM app_user WHERE userid = $1', [gone.id]);
    const goneRoutes: ['get' | 'put' | 'delete', string][] = [
      ['get', favouritePath(gone)],
      ['get', favouritePath(gone, genre.id)],
      ['put', favouritePath(gone, genre.id)],
      ['delete', favouritePath(gone, genre.id)],
    ];
    for (const [method, path] of goneRoutes) {
      const res = await request(app)[method](path).set('Authorization', gone.authorization);
      expect(res.status, `${method} ${path}`).toBe(401);
      expect(res.body).toEqual({ error: { message: 'User no longer exists' } });
    }
  });
});
