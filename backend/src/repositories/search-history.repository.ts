// Database access for a user's search history. Returns raw rows; mapping them to API
// objects is the mapper's job.
import type { Queryable } from '../db/transaction.js';
import { toLimitOffset } from '../lib/paging.js';
import type { PageRequest } from '../types/page.js';
import type { SearchHistoryRow } from '../types/search-history.js';

// Thrown when the user id no longer exists: a user deleted after logging in still has a
// valid token (docs/api-design.md 4.3). The service turns it into a 401.
export class UnknownUserError extends Error {
  override name = 'UnknownUserError';
}

// PostgreSQL's error code for a foreign key violation: here, history.userid names no user.
const FOREIGN_KEY_VIOLATION = '23503';

function isForeignKeyViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    Reflect.get(error, 'code') === FOREIGN_KEY_VIOLATION
  );
}

export async function addSearchHistory(
  db: Queryable,
  userId: number,
  value: string,
): Promise<void> {
  try {
    await db.query('SELECT add_search_history($1, $2)', [userId, value]);
  } catch (error) {
    throw isForeignKeyViolation(error) ? new UnknownUserError() : error;
  }
}

// One page of the user's searches, newest first. Fetches one row more than the page holds,
// so the service can tell whether there is a next page (docs/api-design.md 3.3).
export async function listSearchHistory(
  db: Queryable,
  userId: number,
  pageRequest: PageRequest,
): Promise<SearchHistoryRow[]> {
  const { limit, offset } = toLimitOffset(pageRequest);
  const result = await db.query<SearchHistoryRow>(
    'SELECT historyid, "time", value FROM get_search_history($1, $2, $3)',
    [userId, limit, offset],
  );
  return result.rows;
}

// Returns false when the user has no entry with this id, also when it is another user's.
// historyId is a string because the column is a BIGINT (see SearchHistoryRow).
export async function deleteSearchHistoryEntry(
  db: Queryable,
  userId: number,
  historyId: string,
): Promise<boolean> {
  const result = await db.query<{ deleted: boolean }>(
    'SELECT delete_search_history_entry($1, $2::BIGINT) AS deleted',
    [userId, historyId],
  );
  return result.rows[0]?.deleted ?? false;
}

export async function clearSearchHistory(db: Queryable, userId: number): Promise<void> {
  await db.query('SELECT clear_search_history($1)', [userId]);
}
