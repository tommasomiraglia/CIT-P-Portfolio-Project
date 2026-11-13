// Database access for users. Each function takes the connection to use as its first
// parameter (pool, or a client inside withTransaction), see CONTRIBUTING.md.
import type { Queryable } from '../db/transaction.js';
import type { NewUser, UserCredentialsRow, UserRow } from '../types/user.js';

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
    const field =
      isPostgresError(error) && error.code === UNIQUE_VIOLATION && error.constraint
        ? DUPLICATE_FIELD_BY_CONSTRAINT[error.constraint]
        : undefined;
    // Any other error, including a UNIQUE violation on a constraint we do not know,
    // stays a 500: it would be a bug, not something the client did wrong.
    throw field ? new DuplicateUserError(field) : error;
  }
}

export async function findUserById(db: Queryable, userId: number): Promise<UserRow | undefined> {
  const result = await db.query<UserRow>(
    'SELECT userid, username, email, phonenumber FROM get_user($1)',
    [userId],
  );
  return result.rows[0];
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
