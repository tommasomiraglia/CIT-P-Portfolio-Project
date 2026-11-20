// Business rules for users: registration hashes the password, and registration and PATCH
// report a taken username or email as a conflict.
import { pool } from '../db/pool.js';
import { withTransaction } from '../db/transaction.js';
import { hashPassword } from '../lib/password.js';
import { toUserDto } from '../mappers/user.mapper.js';
import { ConflictError, UnauthorizedError } from '../middleware/errors.js';
import {
  DuplicateUserError,
  findUserById,
  insertUser,
  updateUser,
} from '../repositories/user.repository.js';
import type { ProfileChanges, RegistrationInput, UserDto } from '../types/user.js';

// The 409 says which value is taken (docs/api-design.md 4.5), for registration and PATCH.
function asConflictError(error: unknown, input: { username?: string; email?: string }): unknown {
  if (!(error instanceof DuplicateUserError)) {
    return error;
  }
  return new ConflictError(
    error.field === 'username'
      ? `Username "${input.username}" is already taken`
      : `Email "${input.email}" is already registered`,
  );
}

export async function registerUser(input: RegistrationInput): Promise<UserDto> {
  const passwordHash = await hashPassword(input.password);
  let userId: number;
  try {
    userId = await insertUser(pool, {
      username: input.username,
      email: input.email,
      passwordHash,
      phoneNumber: input.phoneNumber,
    });
  } catch (error) {
    throw asConflictError(error, input);
  }
  return toUserDto({
    userid: userId,
    username: input.username,
    email: input.email,
    phonenumber: input.phoneNumber,
  });
}

// Only called for the logged-in user's own id (authorizeSelf checked that). If the row
// is gone, the user was deleted after logging in: the token no longer names anyone (4.5).
export async function getOwnUser(userId: number): Promise<UserDto> {
  const row = await findUserById(pool, userId);
  if (!row) {
    throw new UnauthorizedError('User no longer exists');
  }
  return toUserDto(row);
}

// update_user and get_user run in one transaction: the UPDATE locks the user's row until
// the commit, so the answer shows exactly this change, not a second PATCH of the same user
// that ran in between. update_user returns false when the row is gone: the user was deleted
// after logging in, and the token no longer names anyone (docs/api-design.md 4.5).
export async function updateOwnUser(userId: number, changes: ProfileChanges): Promise<UserDto> {
  const row = await withTransaction(async (client) => {
    let updated: boolean;
    try {
      updated = await updateUser(client, userId, changes);
    } catch (error) {
      throw asConflictError(error, changes);
    }
    return updated ? findUserById(client, userId) : undefined;
  });
  if (!row) {
    throw new UnauthorizedError('User no longer exists');
  }
  return toUserDto(row);
}
