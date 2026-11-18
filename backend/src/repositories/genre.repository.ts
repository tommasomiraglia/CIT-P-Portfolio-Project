// Database access for genres and a user's genre preferences. Returns raw rows; mapping
// them to API objects is the mapper's job.
import type { Queryable } from '../db/transaction.js';
import { toLimitOffset } from '../lib/paging.js';
import type { GenreRow } from '../types/genre.js';
import type { PageRequest } from '../types/page.js';

// The genre catalogue has no database function: it is one small table, read directly.
// Fetches one row more than the page holds, so the service can tell whether there is a
// next page (docs/api-design.md 3.3).
export async function listGenres(db: Queryable, pageRequest: PageRequest): Promise<GenreRow[]> {
  const { limit, offset } = toLimitOffset(pageRequest);
  const result = await db.query<GenreRow>(
    'SELECT genereid, name FROM generes ORDER BY name, genereid LIMIT $1 OFFSET $2',
    [limit, offset],
  );
  return result.rows;
}

export async function findGenreById(db: Queryable, genreId: number): Promise<GenreRow | undefined> {
  const result = await db.query<GenreRow>(
    'SELECT genereid, name FROM generes WHERE genereid = $1',
    [genreId],
  );
  return result.rows[0];
}

export async function listGenrePreferences(
  db: Queryable,
  userId: number,
  pageRequest: PageRequest,
): Promise<GenreRow[]> {
  const { limit, offset } = toLimitOffset(pageRequest);
  const result = await db.query<GenreRow>(
    'SELECT genereid, name FROM get_genre_preferences($1, $2, $3)',
    [userId, limit, offset],
  );
  return result.rows;
}

// No database function returns a single preference, and get_genre_preferences can only
// page through all of them. The columns are the same, so both share GenreRow.
const FIND_GENRE_PREFERENCE = `
  SELECT g.genereid, g.name
  FROM generes_user gu
  JOIN generes g ON g.genereid = gu.genereid
  WHERE gu.userid = $1 AND gu.genereid = $2`;

export async function findGenrePreference(
  db: Queryable,
  userId: number,
  genreId: number,
): Promise<GenreRow | undefined> {
  const result = await db.query<GenreRow>(FIND_GENRE_PREFERENCE, [userId, genreId]);
  return result.rows[0];
}

// Adds the genre to the user's favourites. Adding one that is already there changes nothing
// (ON CONFLICT DO NOTHING in add_genre_preference), which is what makes PUT idempotent.
// The genre must exist: the service checks that first, since an unknown genre would only
// fail here with a foreign key error.
export async function addGenrePreference(
  db: Queryable,
  userId: number,
  genreId: number,
): Promise<void> {
  await db.query('SELECT add_genre_preference($1, $2)', [userId, genreId]);
}

// Returns false when the genre was not among the user's favourites.
export async function removeGenrePreference(
  db: Queryable,
  userId: number,
  genreId: number,
): Promise<boolean> {
  const result = await db.query<{ removed: boolean }>(
    'SELECT remove_genre_preference($1, $2) AS removed',
    [userId, genreId],
  );
  return result.rows[0]?.removed === true;
}
