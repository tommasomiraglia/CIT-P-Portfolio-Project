// Helpers for tests that rate titles through the API.
//
// A rating changes title_ratings, which is IMDB data that deleting the test user does not
// put back. Two rules keep the database exactly as it was:
//
// 1. Tests only rate titles that nobody has rated (findUnratedTitles). Their average is
//    then made of test votes only, and removing the last vote removes the row again.
//    On a title with real votes the average is stored with one decimal, so adding and
//    removing a vote could leave it 0.1 off.
// 2. afterAll calls removeRatingsOf before deleting the users: unrate() takes each vote
//    out of the average, which ON DELETE CASCADE on the user would not do.
import { pool } from '../../src/db/pool.js';

// Test files run at the same time, so each one passes its own offset to get its own titles.
export async function findUnratedTitles(count: number, offset: number): Promise<string[]> {
  const { rows } = await pool.query<{ tconst: string }>(
    `SELECT tb.tconst
     FROM title_basic tb
     WHERE NOT EXISTS (SELECT 1 FROM title_ratings tr WHERE tr.tconst = tb.tconst)
     ORDER BY tb.tconst
     LIMIT $1 OFFSET $2`,
    [count, offset],
  );
  if (rows.length < count) {
    throw new Error(`Expected ${count} titles without a rating, found ${rows.length}`);
  }
  return rows.map((row) => row.tconst);
}

export interface TitleRating {
  average: number;
  votes: number;
}

// The title's average rating as the database stores it, or null when it has no votes.
export async function titleRating(tconst: string): Promise<TitleRating | null> {
  const { rows } = await pool.query<{ averagerating: string; numvotes: number }>(
    'SELECT averagerating, numvotes FROM title_ratings WHERE tconst = $1',
    [tconst],
  );
  const row = rows[0];
  // pg returns NUMERIC as a string, so that no decimals are lost.
  return row ? { average: Number(row.averagerating), votes: row.numvotes } : null;
}

// Removes every rating of the users whose name starts with the prefix, through unrate().
export async function removeRatingsOf(usernamePrefix: string): Promise<void> {
  await pool.query(
    `SELECT unrate(rh.userid, rh.tconst)
     FROM rating_history rh
     JOIN app_user u ON u.userid = rh.userid
     WHERE u.username LIKE $1 || '%'`,
    [usernamePrefix],
  );
}
