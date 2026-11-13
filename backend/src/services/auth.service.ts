// Login: checks a username and password and issues a token (docs/api-design.md 4.2).
import { pool } from '../db/pool.js';
import { verifyAgainstDummyHash, verifyPassword } from '../lib/password.js';
import { signToken } from '../lib/token.js';
import { toUserDto } from '../mappers/user.mapper.js';
import { UnauthorizedError } from '../middleware/errors.js';
import { findCredentialsByUsername } from '../repositories/user.repository.js';
import type { LoginResultDto } from '../types/user.js';

// The same message for an unknown username and a wrong password, so the answer never
// tells an attacker which usernames exist.
const INVALID_CREDENTIALS = 'Invalid username or password';

export async function login(username: string, password: string): Promise<LoginResultDto> {
  const credentials = await findCredentialsByUsername(pool, username);
  const passwordMatches = credentials
    ? await verifyPassword(credentials.password, password)
    : await verifyAgainstDummyHash(password);
  if (!credentials || !passwordMatches) {
    throw new UnauthorizedError(INVALID_CREDENTIALS);
  }
  return {
    token: await signToken(credentials.userid),
    user: toUserDto(credentials),
  };
}
