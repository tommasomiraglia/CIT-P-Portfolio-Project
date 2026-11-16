// Database access for genres and a user's genre preferences.
import type { Queryable } from '../db/transaction.js';

export interface GenreRow {
  genereid: number;
  name: string;
}

export async function listGenres(
  db: Queryable,
  limit: number,
  offset: number,
): Promise<GenreRow[]> {
  const result = await db.query<GenreRow>(
    'SELECT genereid, name FROM generes ORDER BY name, genereid LIMIT $1 OFFSET $2',
    [limit, offset],
  );
  return result.rows;
}

export async function getGenre(db: Queryable, genreId: number): Promise<GenreRow | undefined> {
  const result = await db.query<GenreRow>(
    'SELECT genereid, name FROM generes WHERE genereid = $1',
    [genreId],
  );
  return result.rows[0];
}

export async function listGenrePreferences(
  db: Queryable,
  userId: number,
  limit: number,
  offset: number,
): Promise<GenreRow[]> {
  const result = await db.query<GenreRow>(
    'SELECT genereid, name FROM get_genre_preferences($1, $2, $3)',
    [userId, limit, offset],
  );
  return result.rows;
}

export async function getGenrePreference(
  db: Queryable,
  userId: number,
  genreId: number,
): Promise<GenreRow | undefined> {
  const result = await db.query<GenreRow>(
    `SELECT g.genereid, g.name
     FROM generes_user gu
     JOIN generes g ON g.genereid = gu.genereid
     WHERE gu.userid = $1 AND gu.genereid = $2`,
    [userId, genreId],
  );
  return result.rows[0];
}

export async function addGenrePreference(
  db: Queryable,
  userId: number,
  genreId: number,
): Promise<GenreRow | undefined> {
  const genre = await getGenre(db, genreId);
  if (!genre) {
    return undefined;
  }
  await db.query(
    'INSERT INTO generes_user (userid, genereid) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [userId, genreId],
  );
  return genre;
}

export async function removeGenrePreference(
  db: Queryable,
  userId: number,
  genreId: number,
): Promise<boolean> {
  const result = await db.query<{ removed: boolean }>(
    'SELECT remove_genre_preference($1, $2) AS removed',
    [userId, genreId],
  );
  return result.rows[0]?.removed ?? false;
}
