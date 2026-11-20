// Database access for a user's ratings. Each function takes the connection to use as its
// first parameter (pool, or a client inside withTransaction), see CONTRIBUTING.md.
import type { Queryable } from '../db/transaction.js';
import { toLimitOffset } from '../lib/paging.js';
import type { PageRequest } from '../types/page.js';
import type { RatingRow } from '../types/rating.js';

// One page of a user's ratings, ordered by title. Fetches one row more than the page
// holds, so the service can tell whether there is a next page (docs/api-design.md 3.3).
export async function findRatingsByUser(
  db: Queryable,
  userId: number,
  pageRequest: PageRequest,
): Promise<RatingRow[]> {
  const { limit, offset } = toLimitOffset(pageRequest);
  const result = await db.query<RatingRow>(
    'SELECT tconst, primarytitle, value, comment FROM get_rating_history($1, $2, $3)',
    [userId, limit, offset],
  );
  return result.rows;
}

// No database function returns a single rating, and get_rating_history can only page
// through all of them. The columns are the same as get_rating_history's, so both
// queries share RatingRow and the mapper.
const FIND_RATING = `
  SELECT rh.tconst, tb.primarytitle, rh.value, rh.comment
  FROM rating_history rh
  JOIN title_basic tb ON tb.tconst = rh.tconst
  WHERE rh.userid = $1 AND rh.tconst = $2`;

export async function findRating(
  db: Queryable,
  userId: number,
  tconst: string,
): Promise<RatingRow | undefined> {
  const result = await db.query<RatingRow>(FIND_RATING, [userId, tconst]);
  return result.rows[0];
}

// Adds the user's rating or changes it, and updates the title's average rating.
export async function rateTitle(
  db: Queryable,
  userId: number,
  tconst: string,
  rating: number,
): Promise<void> {
  await db.query('SELECT rate($1, $2, $3)', [userId, tconst, rating]);
}

// Returns false when the user has no rating on this title to put the comment on.
export async function setRatingComment(
  db: Queryable,
  userId: number,
  tconst: string,
  comment: string | null,
): Promise<boolean> {
  const result = await db.query<{ updated: boolean }>(
    'SELECT set_rating_comment($1, $2, $3) AS updated',
    [userId, tconst, comment],
  );
  return result.rows[0]?.updated === true;
}

// Removes the rating and takes it out of the title's average. Returns false when there
// was no rating to remove.
export async function removeRating(
  db: Queryable,
  userId: number,
  tconst: string,
): Promise<boolean> {
  const result = await db.query<{ removed: boolean }>('SELECT unrate($1, $2) AS removed', [
    userId,
    tconst,
  ]);
  return result.rows[0]?.removed === true;
}

// The titles a user has rated, all of them: deleting the user has to take every vote out of
// the averages, so this is not paged.
export async function findRatedTitleIds(db: Queryable, userId: number): Promise<string[]> {
  const result = await db.query<{ tconst: string }>(
    'SELECT tconst FROM rating_history WHERE userid = $1 ORDER BY tconst',
    [userId],
  );
  return result.rows.map((row) => row.tconst);
}
