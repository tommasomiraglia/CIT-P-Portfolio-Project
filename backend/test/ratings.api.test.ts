// The rating endpoints under /api/users/:userId/ratings over HTTP (2-E.3).
// How these tests leave the database as it was is explained in helpers/test-ratings.ts.
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { app } from '../src/app.js';
import { pool } from '../src/db/pool.js';
import { findUnratedTitles, removeRatingsOf, titleRating } from './helpers/test-ratings.js';
import { type TestUser, TestUsers } from './helpers/test-users.js';

const users = new TestUsers('ratings');

// Three titles nobody has rated. The first is only used by the test of the average.
let titles: string[];
let averageTitle: string;
let title: string;
let otherTitle: string;

beforeAll(async () => {
  titles = await findUnratedTitles(3, 0);
  [averageTitle, title, otherTitle] = titles as [string, string, string];
});

afterAll(async () => {
  await removeRatingsOf(users.prefix);
  await users.cleanUp();
  const left = await Promise.all(titles.map((tconst) => titleRating(tconst)));
  await pool.end();
  // Every test vote is gone, so the titles are unrated again.
  expect(left).toEqual([null, null, null]);
});

const ratingsPath = (user: TestUser, titleId = '') =>
  `/api/users/${user.id}/ratings${titleId === '' ? '' : `/${titleId}`}`;

const putRating = (user: TestUser, titleId: string, body?: object) =>
  request(app).put(ratingsPath(user, titleId)).set('Authorization', user.authorization).send(body);

const getRating = (user: TestUser, titleId: string) =>
  request(app).get(ratingsPath(user, titleId)).set('Authorization', user.authorization);

const deleteRating = (user: TestUser, titleId: string) =>
  request(app).delete(ratingsPath(user, titleId)).set('Authorization', user.authorization);

const listRatings = (user: TestUser, query = '') =>
  request(app)
    .get(`${ratingsPath(user)}${query}`)
    .set('Authorization', user.authorization);

describe('PUT /api/users/:userId/ratings/:titleId', () => {
  test('saves the rating with its comment and answers 200 with the rating', async () => {
    const user = await users.create();
    const res = await putRating(user, title, { rating: 8, comment: 'Good one.' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      url: `/api/users/${user.id}/ratings/${title}`,
      title: { url: `/api/titles/${title}`, name: expect.any(String) },
      rating: 8,
      comment: 'Good one.',
    });
    expect((await getRating(user, title)).body).toEqual(res.body);
  });

  test('replaces the rating and the comment when sent again', async () => {
    const user = await users.create();
    await putRating(user, title, { rating: 3, comment: 'Boring.' });
    const res = await putRating(user, title, { rating: 9, comment: 'I was wrong.' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ rating: 9, comment: 'I was wrong.' });
  });

  test('removes the old comment when the new rating has none', async () => {
    const user = await users.create();
    await putRating(user, title, { rating: 3, comment: 'Boring.' });
    const res = await putRating(user, title, { rating: 4 });
    expect(res.body).toMatchObject({ rating: 4, comment: null });
  });

  test('trims the comment, and stores a comment of only spaces as null', async () => {
    const user = await users.create();
    expect((await putRating(user, title, { rating: 5, comment: '  ok  ' })).body.comment).toBe(
      'ok',
    );
    expect((await putRating(user, title, { rating: 5, comment: '   ' })).body.comment).toBeNull();
  });

  test('is idempotent: the same request twice counts as one vote', async () => {
    const user = await users.create();
    const votesBefore = (await titleRating(otherTitle))?.votes ?? 0;
    const first = await putRating(user, otherTitle, { rating: 6, comment: 'Fine.' });
    const second = await putRating(user, otherTitle, { rating: 6, comment: 'Fine.' });
    expect(second.status).toBe(200);
    expect(second.body).toEqual(first.body);
    expect((await titleRating(otherTitle))?.votes).toBe(votesBefore + 1);
  });

  test('counts one vote when the same user sends several requests at once', async () => {
    const user = await users.create();
    const votesBefore = (await titleRating(otherTitle))?.votes ?? 0;
    const answers = await Promise.all(
      [1, 2, 3, 4, 5].map(() => putRating(user, otherTitle, { rating: 7 })),
    );
    expect(answers.map((res) => res.status)).toEqual([200, 200, 200, 200, 200]);
    expect((await titleRating(otherTitle))?.votes).toBe(votesBefore + 1);
  });

  test.each([
    ['no body', undefined, 'Expected a JSON object'],
    ['a missing rating', { comment: 'no number' }, '"rating" is required'],
    ['a rating below 1', { rating: 0 }, '"rating" is required'],
    ['a rating above 10', { rating: 11 }, '"rating" is required'],
    ['a rating with decimals', { rating: 7.5 }, '"rating" is required'],
    ['a rating sent as text', { rating: '7' }, '"rating" is required'],
    ['a comment that is not text', { rating: 7, comment: 42 }, '"comment" must be'],
    ['a comment that is too long', { rating: 7, comment: 'x'.repeat(2001) }, '"comment" must be'],
  ])('answers 400 for %s, and saves nothing', async (_case, body, message) => {
    const user = await users.create();
    const res = await putRating(user, title, body);
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain(message);
    expect((await getRating(user, title)).status).toBe(404);
  });

  test('answers 400 for a title id that is not an IMDB id', async () => {
    const user = await users.create();
    const res = await putRating(user, 'abc', { rating: 7 });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('Invalid title id "abc"');
  });

  test('answers 404 for a title that does not exist', async () => {
    const user = await users.create();
    const res = await putRating(user, 'tt99999999', { rating: 7 });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { message: 'Title tt99999999 not found' } });
  });
});

describe("the title's average rating", () => {
  // Read through GET /api/titles/:id, as a client sees it, not from title_ratings.
  const ratingShownFor = async (titleId: string) =>
    (await request(app).get(`/api/titles/${titleId}`)).body.rating;

  test('changes after PUT and after DELETE', async () => {
    const alice = await users.create();
    const bob = await users.create();
    expect(await ratingShownFor(averageTitle)).toBeNull();

    await putRating(alice, averageTitle, { rating: 10 });
    expect(await ratingShownFor(averageTitle)).toEqual({ average: 10, votes: 1 });

    await putRating(bob, averageTitle, { rating: 5 });
    expect(await ratingShownFor(averageTitle)).toEqual({ average: 7.5, votes: 2 });

    // Changing a rating moves the average but is still the same vote.
    await putRating(bob, averageTitle, { rating: 7 });
    expect(await ratingShownFor(averageTitle)).toEqual({ average: 8.5, votes: 2 });

    expect((await deleteRating(bob, averageTitle)).status).toBe(204);
    expect(await ratingShownFor(averageTitle)).toEqual({ average: 10, votes: 1 });

    expect((await deleteRating(alice, averageTitle)).status).toBe(204);
    expect(await ratingShownFor(averageTitle)).toBeNull();
  });
});

describe('GET /api/users/:userId/ratings', () => {
  test('answers an empty page for a user without ratings', async () => {
    const user = await users.create();
    const res = await listRatings(user);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items: [], page: 1, pageSize: 20, prev: null, next: null });
  });

  test('lists only my own ratings, page by page', async () => {
    const user = await users.create();
    const someoneElse = await users.create();
    await putRating(user, title, { rating: 2, comment: 'First.' });
    await putRating(user, otherTitle, { rating: 9 });
    await putRating(someoneElse, title, { rating: 5 });

    const firstPage = await listRatings(user, '?pageSize=1');
    expect(firstPage.status).toBe(200);
    expect(firstPage.body).toMatchObject({
      page: 1,
      pageSize: 1,
      prev: null,
      next: `/api/users/${user.id}/ratings?pageSize=1&page=2`,
    });
    const secondPage = await request(app)
      .get(firstPage.body.next)
      .set('Authorization', user.authorization);
    expect(secondPage.body).toMatchObject({
      page: 2,
      prev: `/api/users/${user.id}/ratings?pageSize=1&page=1`,
      next: null,
    });

    const items = [...firstPage.body.items, ...secondPage.body.items];
    // The two pages together hold each rating once; their order (by title) is not checked.
    expect(items).toHaveLength(2);
    expect(items).toContainEqual({
      url: `/api/users/${user.id}/ratings/${title}`,
      title: { url: `/api/titles/${title}`, name: expect.any(String) },
      rating: 2,
      comment: 'First.',
    });
    expect(items).toContainEqual({
      url: `/api/users/${user.id}/ratings/${otherTitle}`,
      title: { url: `/api/titles/${otherTitle}`, name: expect.any(String) },
      rating: 9,
      comment: null,
    });
  });

  test('answers 400 for an invalid page', async () => {
    const user = await users.create();
    expect((await listRatings(user, '?page=0')).status).toBe(400);
  });
});

describe('GET /api/users/:userId/ratings/:titleId', () => {
  test('answers 200 with my rating', async () => {
    const user = await users.create();
    await putRating(user, title, { rating: 4, comment: 'Meh.' });
    const res = await getRating(user, title);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ rating: 4, comment: 'Meh.' });
  });

  test('answers 404 for a title I have not rated, even if someone else has', async () => {
    const user = await users.create();
    const someoneElse = await users.create();
    await putRating(someoneElse, title, { rating: 4 });
    const res = await getRating(user, title);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { message: `You have not rated title ${title}` } });
  });

  test('answers 400 for a title id that is not an IMDB id', async () => {
    const user = await users.create();
    expect((await getRating(user, 'nm0000001')).status).toBe(400);
  });
});

describe('DELETE /api/users/:userId/ratings/:titleId', () => {
  test('answers 204 with no body, and the rating is gone', async () => {
    const user = await users.create();
    await putRating(user, title, { rating: 4 });
    const res = await deleteRating(user, title);
    expect(res.status).toBe(204);
    expect(res.text).toBe('');
    expect((await getRating(user, title)).status).toBe(404);
  });

  test('answers 404 when there is no rating to remove', async () => {
    const user = await users.create();
    await putRating(user, title, { rating: 4 });
    await deleteRating(user, title);
    const res = await deleteRating(user, title);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { message: `You have not rated title ${title}` } });
  });

  test('answers 400 for a title id that is not an IMDB id', async () => {
    const user = await users.create();
    expect((await deleteRating(user, 'abc')).status).toBe(400);
  });
});

describe('who may use the rating endpoints', () => {
  let owner: TestUser;
  let intruder: TestUser;

  beforeAll(async () => {
    owner = await users.create();
    intruder = await users.create();
    await putRating(owner, title, { rating: 8, comment: 'Mine.' });
  });

  // Every route of the resource, as [method, path of the owner's data].
  const routes = (): ['get' | 'put' | 'delete', string][] => [
    ['get', ratingsPath(owner)],
    ['get', ratingsPath(owner, title)],
    ['put', ratingsPath(owner, title)],
    ['delete', ratingsPath(owner, title)],
  ];

  test('answers 401 without a token on every route', async () => {
    for (const [method, path] of routes()) {
      const res = await request(app)[method](path).send({ rating: 1 });
      expect(res.status, `${method} ${path}`).toBe(401);
      expect(res.headers['www-authenticate']).toBe('Bearer');
    }
  });

  test("answers 403 for another user's ratings on every route", async () => {
    for (const [method, path] of routes()) {
      const res = await request(app)
        [method](path)
        .set('Authorization', intruder.authorization)
        .send({ rating: 1 });
      expect(res.status, `${method} ${path}`).toBe(403);
    }
    // The intruder's PUT and DELETE changed nothing.
    expect((await getRating(owner, title)).body).toMatchObject({ rating: 8, comment: 'Mine.' });
  });

  test('answers 401 to PUT and DELETE when the user was deleted after logging in', async () => {
    const gone = await users.create();
    await pool.query('DELETE FROM app_user WHERE userid = $1', [gone.id]);
    const put = await putRating(gone, title, { rating: 7 });
    expect(put.status).toBe(401);
    expect(put.body).toEqual({ error: { message: 'User no longer exists' } });
    expect((await deleteRating(gone, title)).status).toBe(401);
  });
});
