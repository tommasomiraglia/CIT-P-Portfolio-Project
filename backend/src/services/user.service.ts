// Business rules for users: registration hashes the password, and registration and PATCH
// report a taken username or email as a conflict.
import { pool } from '../db/pool.js';
import { withTransaction } from '../db/transaction.js';
import { hashPassword } from '../lib/password.js';
import { toUserDto } from '../mappers/user.mapper.js';
import { ConflictError, UnauthorizedError } from '../middleware/errors.js';
import { findRatedTitleIds, removeRating } from '../repositories/rating.repository.js';
import {
  DuplicateUserError,
  deleteUser,
  findUserById,
  insertUser,
  lockUser,
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

// Deletes the account and all its data (2-D.4: everything or nothing).
// delete_user alone would leave the user's votes in title_ratings and name_ratings: ON DELETE
// CASCADE removes the rating_history rows but does not recompute the averages. So every
// rating is first removed through unrate(), as DELETE of one rating does.
// The lock comes first, so that a rating the same user saves at the same moment either
// finishes before the list is read, or waits and then finds the user gone (401).
// A missing row means the user was already deleted: the token no longer names anyone (4.3).
export async function deleteOwnUser(userId: number): Promise<void> {
  await withTransaction(async (client) => {
    if (!(await lockUser(client, userId))) {
      throw new UnauthorizedError('User no longer exists');
    }
    for (const titleId of await findRatedTitleIds(client, userId)) {
      await removeRating(client, userId, titleId);
    }
    if (!(await deleteUser(client, userId))) {
      // Cannot happen while the user is locked. Throwing rolls the unrates back.
      throw new Error(`User ${userId} was not there to delete after locking it`);
    }
  });
}
