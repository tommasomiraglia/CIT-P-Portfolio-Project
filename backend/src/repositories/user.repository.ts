// Database access for users. Each function takes the connection to use as its first
// parameter (pool, or a client inside withTransaction), see CONTRIBUTING.md.
import type { Queryable } from '../db/transaction.js';
import type { NewUser, ProfileChanges, UserCredentialsRow, UserRow } from '../types/user.js';

// Thrown when the username or email is already taken. The service turns it into a 409;
// the repository only says which value clashed, without anything about HTTP.
export class DuplicateUserError extends Error {
  override name = 'DuplicateUserError';
  readonly field: 'username' | 'email';

  constructor(field: 'username' | 'email') {
    super(`Duplicate ${field}`);
    this.field = field;
  }
}

// PostgreSQL's error code for a UNIQUE constraint violation.
const UNIQUE_VIOLATION = '23505';

// The default names PostgreSQL gave the UNIQUE constraints of app_user in C2.
const DUPLICATE_FIELD_BY_CONSTRAINT: Record<string, 'username' | 'email'> = {
  app_user_username_key: 'username',
  app_user_email_key: 'email',
};

interface PostgresError {
  code: string;
  constraint?: string;
}

function isPostgresError(error: unknown): error is PostgresError {
  return (
    typeof error === 'object' && error !== null && typeof Reflect.get(error, 'code') === 'string'
  );
}

export async function insertUser(db: Queryable, user: NewUser): Promise<number> {
  try {
    const result = await db.query<{ userid: number }>(
      'SELECT create_user($1, $2, $3, $4) AS userid',
      [user.username, user.email, user.passwordHash, user.phoneNumber],
    );
    const userId = result.rows[0]?.userid;
    if (userId === undefined) {
      throw new Error('create_user returned no id');
    }
    return userId;
  } catch (error) {
    throw asDuplicateUserError(error);
  }
}

// The UNIQUE constraints are the real check for a taken username or email: two requests
// that claim the same value at the same moment both pass any SELECT done beforehand, but
// only one of them passes the constraint. So no separate "is it taken?" query is needed.
// Any other error, including a UNIQUE violation on a constraint we do not know, stays as
// it is and becomes a 500: it would be a bug, not something the client did wrong.
function asDuplicateUserError(error: unknown): unknown {
  const field =
    isPostgresError(error) && error.code === UNIQUE_VIOLATION && error.constraint
      ? DUPLICATE_FIELD_BY_CONSTRAINT[error.constraint]
      : undefined;
  return field ? new DuplicateUserError(field) : error;
}

// Changes the fields present in `changes` and leaves the others. Returns false when the
// user does not exist. Throws DuplicateUserError for a username or email that is taken.
export async function updateUser(
  db: Queryable,
  userId: number,
  changes: ProfileChanges,
): Promise<boolean> {
  // update_user keeps a field whose argument is NULL, so a missing field is passed as NULL,
  // and removing the phone number needs its own flag.
  const clearPhoneNumber = changes.phoneNumber === null;
  try {
    const result = await db.query<{ updated: boolean }>(
      `SELECT update_user($1, p_username => $2, p_email => $3, p_phonenumber => $4,
                          p_clear_phonenumber => $5) AS updated`,
      [
        userId,
        changes.username ?? null,
        changes.email ?? null,
        changes.phoneNumber ?? null,
        clearPhoneNumber,
      ],
    );
    return result.rows[0]?.updated === true;
  } catch (error) {
    throw asDuplicateUserError(error);
  }
}

export async function findUserById(db: Queryable, userId: number): Promise<UserRow | undefined> {
  const result = await db.query<UserRow>(
    'SELECT userid, username, email, phonenumber FROM get_user($1)',
    [userId],
  );
  return result.rows[0];
}

// Deletes the user; ON DELETE CASCADE removes their bookmarks, ratings, history and genres.
// Returns false when there was no such user.
export async function deleteUser(db: Queryable, userId: number): Promise<boolean> {
  const result = await db.query<{ deleted: boolean }>('SELECT delete_user($1) AS deleted', [
    userId,
  ]);
  return result.rows[0]?.deleted === true;
}

export async function userExists(db: Queryable, userId: number): Promise<boolean> {
  const result = await db.query('SELECT 1 FROM app_user WHERE userid = $1', [userId]);
  return result.rowCount === 1;
}

// Locks the user's row until the surrounding transaction ends, and returns false when the
// user does not exist. Two transactions that lock the same user run one after the other,
// so a service can read a user's data and then write it without another request of that
// user changing it in between. Only useful inside withTransaction.
// FOR NO KEY UPDATE is the lock an ordinary UPDATE takes: a second locker waits, but an
// INSERT of a row that references the user, such as a new bookmark, does not.
export async function lockUser(db: Queryable, userId: number): Promise<boolean> {
  const result = await db.query('SELECT 1 FROM app_user WHERE userid = $1 FOR NO KEY UPDATE', [
    userId,
  ]);
  return result.rows.length > 0;
}

// No database function returns the password hash (get_user leaves it out on purpose),
// so login reads it here, in the one place that needs it.
export async function findCredentialsByUsername(
  db: Queryable,
  username: string,
): Promise<UserCredentialsRow | undefined> {
  const result = await db.query<UserCredentialsRow>(
    'SELECT userid, username, email, phonenumber, password FROM app_user WHERE username = $1',
    [username],
  );
  return result.rows[0];
}
