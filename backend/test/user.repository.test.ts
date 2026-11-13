// Repository tests against the database, inside a transaction that is rolled back, so
// every run starts from the same data and leaves nothing behind (2-E.2).
import type { PoolClient } from 'pg';
import { afterAll, afterEach, beforeEach, describe, expect, test } from 'vitest';
import { pool } from '../src/db/pool.js';
import {
  DuplicateUserError,
  findCredentialsByUsername,
  findUserById,
  insertUser,
} from '../src/repositories/user.repository.js';

afterAll(() => pool.end());

let client: PoolClient;

beforeEach(async () => {
  client = await pool.connect();
  await client.query('BEGIN');
});

afterEach(async () => {
  await client.query('ROLLBACK');
  client.release();
});

const newUser = {
  username: 'repository-test',
  email: 'repository-test@example.com',
  passwordHash: 'hash',
  phoneNumber: '+45 12 34 56 78',
};

describe('user repository', () => {
  test('inserts a user and reads it back without the password', async () => {
    const id = await insertUser(client, newUser);
    expect(await findUserById(client, id)).toEqual({
      userid: id,
      username: 'repository-test',
      email: 'repository-test@example.com',
      phonenumber: '+45 12 34 56 78',
    });
  });

  test('reads the password hash only through findCredentialsByUsername', async () => {
    const id = await insertUser(client, newUser);
    expect(await findCredentialsByUsername(client, 'repository-test')).toMatchObject({
      userid: id,
      password: 'hash',
    });
    expect(await findCredentialsByUsername(client, 'no-such-user')).toBeUndefined();
  });

  test('returns undefined for an id that does not exist', async () => {
    expect(await findUserById(client, 2_147_483_647)).toBeUndefined();
  });

  test.each([
    ['username', { ...newUser, email: 'other@example.com' }],
    ['email', { ...newUser, username: 'other-name' }],
  ] as const)('reports a duplicate %s', async (field, duplicate) => {
    await insertUser(client, newUser);
    const error = await insertUser(client, duplicate).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DuplicateUserError);
    expect((error as DuplicateUserError).field).toBe(field);
  });
});
