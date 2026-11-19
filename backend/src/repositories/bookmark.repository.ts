// Database access for a user's bookmarks of titles and people. Each function takes the
// connection to use as its first parameter (pool, or a client inside withTransaction),
// see CONTRIBUTING.md.
import type { Queryable } from '../db/transaction.js';
import { toLimitOffset } from '../lib/paging.js';
import type { PersonBookmarkRow, TitleBookmarkRow } from '../types/bookmark.js';
import type { PageRequest } from '../types/page.js';

// One page of a user's title bookmarks, ordered by title. Fetches one row more than the
// page holds, so the service can tell whether there is a next page (docs/api-design.md 3.3).
export async function findTitleBookmarksByUser(
  db: Queryable,
  userId: number,
  pageRequest: PageRequest,
): Promise<TitleBookmarkRow[]> {
  const { limit, offset } = toLimitOffset(pageRequest);
  const result = await db.query<TitleBookmarkRow>(
    'SELECT tconst, primarytitle FROM get_bookmarked_titles($1, $2, $3)',
    [userId, limit, offset],
  );
  return result.rows;
}

// No database function returns a single bookmark, and get_bookmarked_titles can only page
// through all of them. The columns are the same, so both share TitleBookmarkRow.
const FIND_TITLE_BOOKMARK = `
  SELECT tb.tconst, tb.primarytitle
  FROM bookmarking_title bt
  JOIN title_basic tb ON tb.tconst = bt.tconst
  WHERE bt.userid = $1 AND bt.tconst = $2`;

export async function findTitleBookmark(
  db: Queryable,
  userId: number,
  tconst: string,
): Promise<TitleBookmarkRow | undefined> {
  const result = await db.query<TitleBookmarkRow>(FIND_TITLE_BOOKMARK, [userId, tconst]);
  return result.rows[0];
}

// Bookmarking a title that is already bookmarked changes nothing (ON CONFLICT DO NOTHING
// in bookmark_title), which is what makes PUT idempotent. The title must exist: the
// service checks that first, since an unknown title would only fail here with a foreign
// key error.
export async function bookmarkTitle(db: Queryable, userId: number, tconst: string): Promise<void> {
  await db.query('SELECT bookmark_title($1, $2)', [userId, tconst]);
}

// Returns false when the title was not bookmarked.
export async function removeTitleBookmark(
  db: Queryable,
  userId: number,
  tconst: string,
): Promise<boolean> {
  const result = await db.query<{ removed: boolean }>(
    'SELECT remove_bookmark_title($1, $2) AS removed',
    [userId, tconst],
  );
  return result.rows[0]?.removed === true;
}

// One page of a user's person bookmarks, ordered by name, with one extra row as above.
export async function findPersonBookmarksByUser(
  db: Queryable,
  userId: number,
  pageRequest: PageRequest,
): Promise<PersonBookmarkRow[]> {
  const { limit, offset } = toLimitOffset(pageRequest);
  const result = await db.query<PersonBookmarkRow>(
    'SELECT nconst, primaryname FROM get_bookmarked_persons($1, $2, $3)',
    [userId, limit, offset],
  );
  return result.rows;
}

// The single-bookmark query for people, for the same reason as FIND_TITLE_BOOKMARK.
const FIND_PERSON_BOOKMARK = `
  SELECT nb.nconst, nb.primaryname
  FROM bookmarking_person bp
  JOIN name_basics nb ON nb.nconst = bp.nconst
  WHERE bp.userid = $1 AND bp.nconst = $2`;

export async function findPersonBookmark(
  db: Queryable,
  userId: number,
  nconst: string,
): Promise<PersonBookmarkRow | undefined> {
  const result = await db.query<PersonBookmarkRow>(FIND_PERSON_BOOKMARK, [userId, nconst]);
  return result.rows[0];
}

// Idempotent like bookmarkTitle, and the person must exist for the same reason.
export async function bookmarkPerson(db: Queryable, userId: number, nconst: string): Promise<void> {
  await db.query('SELECT bookmark_person($1, $2)', [userId, nconst]);
}

// Returns false when the person was not bookmarked.
export async function removePersonBookmark(
  db: Queryable,
  userId: number,
  nconst: string,
): Promise<boolean> {
  const result = await db.query<{ removed: boolean }>(
    'SELECT remove_bookmark_person($1, $2) AS removed',
    [userId, nconst],
  );
  return result.rows[0]?.removed === true;
}
