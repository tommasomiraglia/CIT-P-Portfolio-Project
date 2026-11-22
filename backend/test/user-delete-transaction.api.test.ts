// DELETE /api/users/:userId removes the user's ratings and then the user in one
// transaction (2-D.4). This test makes the last step fail and checks that the ratings
// removed before it are back, with their votes in the average.
//
// A real request cannot make delete_user fail once the user is locked, so the repository
// function is replaced by a wrapper that calls the real one unless a test tells it to fail,
// as in ratings-transaction.api.test.ts. Everything else is real.
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import { app } from '../src/app.js';
import { pool } from '../src/db/pool.js';
import { deleteUser } from '../src/repositories/user.repository.js';
import { findUnratedTitles, removeRatingsOf, titleRating } from './helpers/test-ratings.js';
import { TestUsers } from './helpers/test-users.js';

// Vitest moves vi.mock above the imports, so the service already gets the wrapper.
vi.mock('../src/repositories/user.repository.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/repositories/user.repository.js')>();
  return { ...original, deleteUser: vi.fn(original.deleteUser) };
});

const users = new TestUsers('delete-tx');
let title: string;

beforeAll(async () => {
  // Offset 20: the other rating tests run at the same time and use offsets 0 to 17.
  [title] = (await findUnratedTitles(1, 20)) as [string];
  // The error handler logs every 500. This test causes one on purpose.
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(async () => {
  await removeRatingsOf(users.prefix);
  await users.cleanUp();
  const left = await titleRating(title);
  await pool.end();
  expect(left).toBeNull();
});

describe('DELETE user when delete_user fails', () => {
  test('nothing is deleted: the user, the rating and its vote in the average stay', async () => {
    const user = await users.create();
    const auth = { Authorization: user.authorization };
    const rated = await request(app)
      .put(`/api/users/${user.id}/ratings/${title}`)
      .set(auth)
      .send({ rating: 6 });
    expect(rated.status).toBe(200);
    vi.mocked(deleteUser).mockRejectedValueOnce(new Error('delete failed'));

    const res = await request(app).delete(`/api/users/${user.id}`).set(auth);

    expect(res.status).toBe(500);
    expect((await request(app).get(`/api/users/${user.id}`).set(auth)).status).toBe(200);
    expect(
      (await request(app).get(`/api/users/${user.id}/ratings/${title}`).set(auth)).status,
    ).toBe(200);
    expect(await titleRating(title)).toEqual({ average: 6, votes: 1 });

    // Once delete_user works again, the same request deletes everything.
    expect((await request(app).delete(`/api/users/${user.id}`).set(auth)).status).toBe(204);
    expect(await titleRating(title)).toBeNull();
  });
});
