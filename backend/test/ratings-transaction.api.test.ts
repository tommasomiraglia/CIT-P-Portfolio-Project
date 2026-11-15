// PUT /api/users/:userId/ratings/:titleId saves the rating and its comment in one
// transaction (2-D.4). These tests make the second step fail and check that the first
// step, the rating itself, is rolled back.
//
// The comment cannot be made to fail with a real request: everything the database would
// refuse is already a 400 in the controller. So the repository function that saves the
// comment is replaced by a wrapper that normally calls the real one, and that a test can
// tell to fail once. Everything else, including rate() and the transaction, is real.
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import { app } from '../src/app.js';
import { pool } from '../src/db/pool.js';
import { setRatingComment } from '../src/repositories/rating.repository.js';
import { findUnratedTitles, removeRatingsOf, titleRating } from './helpers/test-ratings.js';
import { type TestUser, TestUsers } from './helpers/test-users.js';

// Vitest moves vi.mock above the imports, so the service already gets the wrapper.
vi.mock('../src/repositories/rating.repository.js', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('../src/repositories/rating.repository.js')>();
  return { ...original, setRatingComment: vi.fn(original.setRatingComment) };
});

const users = new TestUsers('ratings-tx');
let title: string;

beforeAll(async () => {
  // Offset 5: ratings.api.test.ts runs at the same time and uses the first three.
  [title] = (await findUnratedTitles(1, 5)) as [string];
  // The error handler logs every 500. These tests cause them on purpose.
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(async () => {
  await removeRatingsOf(users.prefix);
  await users.cleanUp();
  const left = await titleRating(title);
  await pool.end();
  expect(left).toBeNull();
});

const putRating = (user: TestUser, body: object) =>
  request(app)
    .put(`/api/users/${user.id}/ratings/${title}`)
    .set('Authorization', user.authorization)
    .send(body);

async function storedRating(user: TestUser) {
  const { rows } = await pool.query<{ value: number; comment: string | null }>(
    'SELECT value, comment FROM rating_history WHERE userid = $1 AND tconst = $2',
    [user.id, title],
  );
  return rows[0] ?? null;
}

describe('PUT rating when saving the comment fails', () => {
  test('a new rating is rolled back: no rating, and the average is unchanged', async () => {
    const user = await users.create();
    vi.mocked(setRatingComment).mockRejectedValueOnce(new Error('comment failed'));

    const res = await putRating(user, { rating: 9, comment: 'Never saved.' });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: { message: 'Internal server error' } });
    expect(await storedRating(user)).toBeNull();
    expect(await titleRating(title)).toBeNull();
  });

  test('a changed rating is rolled back: the old rating, comment and average stay', async () => {
    const user = await users.create();
    expect((await putRating(user, { rating: 3, comment: 'Old.' })).status).toBe(200);
    vi.mocked(setRatingComment).mockRejectedValueOnce(new Error('comment failed'));

    const res = await putRating(user, { rating: 9, comment: 'New.' });

    expect(res.status).toBe(500);
    expect(await storedRating(user)).toEqual({ value: 3, comment: 'Old.' });
    expect(await titleRating(title)).toEqual({ average: 3, votes: 1 });
  });

  test('is also rolled back when the comment finds no rating to attach to', async () => {
    const user = await users.create();
    const before = await titleRating(title);
    vi.mocked(setRatingComment).mockResolvedValueOnce(false);

    const res = await putRating(user, { rating: 9, comment: 'Never saved.' });

    expect(res.status).toBe(500);
    expect(await storedRating(user)).toBeNull();
    expect(await titleRating(title)).toEqual(before);
  });

  test('the same request succeeds once the comment can be saved again', async () => {
    const user = await users.create();
    const res = await putRating(user, { rating: 9, comment: 'Saved.' });
    expect(res.status).toBe(200);
    expect(await storedRating(user)).toEqual({ value: 9, comment: 'Saved.' });
  });
});
