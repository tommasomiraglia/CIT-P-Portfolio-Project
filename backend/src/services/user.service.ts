// Business rules for users: registration hashes the password and reports a taken
// username or email as a conflict.
import { pool } from '../db/pool.js';
import { hashPassword } from '../lib/password.js';
import { toUserDto } from '../mappers/user.mapper.js';
import { ConflictError, UnauthorizedError } from '../middleware/errors.js';
import { DuplicateUserError, findUserById, insertUser } from '../repositories/user.repository.js';
import type { RegistrationInput, UserDto } from '../types/user.js';

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
    if (error instanceof DuplicateUserError) {
      throw new ConflictError(
        error.field === 'username'
          ? `Username "${input.username}" is already taken`
          : `Email "${input.email}" is already registered`,
      );
    }
    throw error;
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
