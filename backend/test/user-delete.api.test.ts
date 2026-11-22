// DELETE /api/users/:userId over HTTP (2-E.3): the account and all its data are gone,
// and the user's votes are taken out of the averages again.
// How the rating part leaves the database as it was is explained in helpers/test-ratings.ts.
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { app } from '../src/app.js';
import { pool } from '../src/db/pool.js';
import { findUnratedTitles, removeRatingsOf, titleRating } from './helpers/test-ratings.js';
import { type TestUser, TestUsers } from './helpers/test-users.js';

const users = new TestUsers('delete');

// Two titles nobody has rated. Offset 16: the other rating tests use offsets 0 to 10, and
// these titles have people with a name rating, so the name_ratings check means something.
let sharedTitle: string;
let ownTitle: string;

beforeAll(async () => {
  [sharedTitle, ownTitle] = (await findUnratedTitles(2, 16)) as [string, string];
});

afterAll(async () => {
  await removeRatingsOf(users.prefix);
  await users.cleanUp();
  const left = await Promise.all([titleRating(sharedTitle), titleRating(ownTitle)]);
  await pool.end();
  expect(left).toEqual([null, null]);
});

const as = (user: TestUser) => ({ Authorization: user.authorization });

const deleteUser = (user: TestUser, id: number = user.id) =>
  request(app).delete(`/api/users/${id}`).set(as(user));

const ratingShownFor = async (titleId: string) =>
  (await request(app).get(`/api/titles/${titleId}`)).body.rating;

async function rate(user: TestUser, titleId: string, rating: number): Promise<void> {
  const res = await request(app)
    .put(`/api/users/${user.id}/ratings/${titleId}`)
    .set(as(user))
    .send({ rating });
  expect(res.status).toBe(200);
}

// Gives the user one row of every kind of data, each through the API.
async function fillWithData(user: TestUser): Promise<void> {
  const genreId: number = (await request(app).get('/api/genres')).body.items[0].id;
  const answers = await Promise.all([
    request(app).put(`/api/users/${user.id}/bookmarks/titles/tt0052520`).set(as(user)),
    request(app).put(`/api/users/${user.id}/bookmarks/people/nm0000138`).set(as(user)),
    request(app).put(`/api/users/${user.id}/genres/${genreId}`).set(as(user)),
    request(app).get('/api/titles?search=zone').set(as(user)),
  ]);
  expect(answers.map((res) => res.status)).toEqual([200, 200, 200, 200]);
}

// How many rows of each table belong to the user.
async function rowsOf(userId: number): Promise<Record<string, number>> {
  const { rows } = await pool.query<Record<string, number>>(
    `SELECT (SELECT count(*)::int FROM app_user WHERE userid = $1) AS "user",
            (SELECT count(*)::int FROM bookmarking_title WHERE userid = $1) AS "titleBookmarks",
            (SELECT count(*)::int FROM bookmarking_person WHERE userid = $1) AS "personBookmarks",
            (SELECT count(*)::int FROM rating_history WHERE userid = $1) AS "ratings",
            (SELECT count(*)::int FROM history WHERE userid = $1) AS "searchHistory",
            (SELECT count(*)::int FROM generes_user WHERE userid = $1) AS "genres"`,
    [userId],
  );
  return rows[0] ?? {};
}

// The name rating of every person in the title, which the trigger changes with each vote.
async function nameRatingsOf(titleId: string) {
  const { rows } = await pool.query(
    `SELECT nr.nconst, nr.averagerating, nr.agg_numvotes
     FROM name_ratings nr
     WHERE nr.nconst IN (SELECT nconst FROM title_principals WHERE tconst = $1)
     ORDER BY nr.nconst`,
    [titleId],
  );
  return rows;
}

describe('DELETE /api/users/:userId', () => {
  test('answers 204 with no body and removes the user and all their data', async () => {
    const user = await users.create();
    await fillWithData(user);
    await rate(user, ownTitle, 8);
    expect(await rowsOf(user.id)).toEqual({
      user: 1,
      titleBookmarks: 1,
      personBookmarks: 1,
      ratings: 1,
      searchHistory: 1,
      genres: 1,
    });

    const res = await deleteUser(user);

    expect(res.status).toBe(204);
    expect(res.text).toBe('');
    expect(await rowsOf(user.id)).toEqual({
      user: 0,
      titleBookmarks: 0,
      personBookmarks: 0,
      ratings: 0,
      searchHistory: 0,
      genres: 0,
    });
  });

  test("takes the user's votes out of the averages again", async () => {
    const [user, other] = [await users.create(), await users.create()];
    await rate(other, sharedTitle, 4);
    const sharedBefore = await ratingShownFor(sharedTitle);
    const namesBefore = await nameRatingsOf(ownTitle);
    expect(sharedBefore).toEqual({ average: 4, votes: 1 });
    expect(await ratingShownFor(ownTitle)).toBeNull();

    await rate(user, sharedTitle, 10);
    await rate(user, ownTitle, 8);
    expect(await ratingShownFor(sharedTitle)).toEqual({ average: 7, votes: 2 });
    const namesRated = await nameRatingsOf(ownTitle);
    expect(namesRated.length).toBeGreaterThan(0);
    expect(namesRated).not.toEqual(namesBefore);

    expect((await deleteUser(user)).status).toBe(204);

    // Back to what it was before the user rated: the other user's vote stays.
    expect(await ratingShownFor(sharedTitle)).toEqual(sharedBefore);
    expect(await ratingShownFor(ownTitle)).toBeNull();
    expect(await nameRatingsOf(ownTitle)).toEqual(namesBefore);
  });

  test('the same token then gets a 401, on GET and on a second DELETE', async () => {
    const user = await users.create();
    expect((await deleteUser(user)).status).toBe(204);

    const get = await request(app).get(`/api/users/${user.id}`).set(as(user));
    expect(get.status).toBe(401);
    expect(get.body).toEqual({ error: { message: 'User no longer exists' } });

    const again = await deleteUser(user);
    expect(again.status).toBe(401);
    expect(again.body).toEqual({ error: { message: 'User no longer exists' } });
  });

  test("answers 403 for another user's id, and deletes nothing", async () => {
    const [user, other] = [await users.create(), await users.create()];
    const res = await deleteUser(user, other.id);
    expect(res.status).toBe(403);
    expect((await rowsOf(other.id)).user).toBe(1);
  });

  test('answers 401 without a token, and deletes nothing', async () => {
    const user = await users.create();
    const res = await request(app).delete(`/api/users/${user.id}`);
    expect(res.status).toBe(401);
    expect((await rowsOf(user.id)).user).toBe(1);
  });

  test('answers 400 for a user id that is not a positive integer', async () => {
    const user = await users.create();
    const res = await request(app).delete('/api/users/abc').set(as(user));
    expect(res.status).toBe(400);
  });
});
