// Database access for a user's search history.
import type { Queryable } from '../db/transaction.js';

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
