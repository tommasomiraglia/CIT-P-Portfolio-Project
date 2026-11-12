// Tests for withTransaction (2-D.4): first with a fake connection, to check the exact
// sequence of commands and how the connection is returned, then against the real database.
import type { PoolClient } from 'pg';
import { afterAll, describe, expect, test, vi } from 'vitest';
import { pool } from '../src/db/pool.js';
import { withTransaction } from '../src/db/transaction.js';

afterAll(() => pool.end());

// A client that records every SQL command and can be told to fail on one of them.
function fakeConnection(failOn?: string) {
  const commands: string[] = [];
  const release = vi.fn();
  const client = {
    query: vi.fn(async (sql: string) => {
      commands.push(sql);
      if (sql === failOn) {
        throw new Error(`${sql} failed`);
      }
      return { rows: [] };
    }),
    release,
  };
  // The fake only implements what withTransaction calls, so it is cast to the full type.
  const source = { connect: async () => client as unknown as PoolClient };
  return { commands, release, source, client };
}

describe('withTransaction with a fake connection', () => {
  test('commits and returns the result when the work succeeds', async () => {
    const { commands, release, source } = fakeConnection();
    const result = await withTransaction(async (client) => {
      await client.query('WORK');
      return 42;
    }, source);
    expect(result).toBe(42);
    expect(commands).toEqual(['BEGIN', 'WORK', 'COMMIT']);
    expect(release).toHaveBeenCalledExactlyOnceWith(undefined);
  });

  test('rolls back and rethrows the original error when the work fails', async () => {
    const { commands, release, source } = fakeConnection('WORK');
    await expect(
      withTransaction(async (client) => {
        await client.query('WORK');
      }, source),
    ).rejects.toThrow('WORK failed');
    expect(commands).toEqual(['BEGIN', 'WORK', 'ROLLBACK']);
    expect(release).toHaveBeenCalledExactlyOnceWith(undefined);
  });

  test('rolls back when COMMIT fails', async () => {
    const { commands, source } = fakeConnection('COMMIT');
    await expect(withTransaction(async () => {}, source)).rejects.toThrow('COMMIT failed');
    expect(commands).toEqual(['BEGIN', 'COMMIT', 'ROLLBACK']);
  });

  test('closes the connection instead of reusing it when ROLLBACK fails', async () => {
    const { release, source } = fakeConnection('ROLLBACK');
    await expect(
      withTransaction(async () => {
        throw new Error('work failed');
      }, source),
    ).rejects.toThrow('work failed');
    // release(error) tells the pool to destroy the connection.
    expect(release).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ message: 'ROLLBACK failed' }),
    );
  });

  test('returns the connection when BEGIN fails, without running the work', async () => {
    const { release, source } = fakeConnection('BEGIN');
    const work = vi.fn(async () => {});
    await expect(withTransaction(work, source)).rejects.toThrow('BEGIN failed');
    expect(work).not.toHaveBeenCalled();
    expect(release).toHaveBeenCalledOnce();
  });
});

describe('withTransaction against the database', () => {
  const currentTransactionId = 'SELECT pg_current_xact_id()::text AS id';

  test('runs every query of the work in the same transaction', async () => {
    const [first, second] = await withTransaction(async (client) => [
      (await client.query<{ id: string }>(currentTransactionId)).rows[0]?.id,
      (await client.query<{ id: string }>(currentTransactionId)).rows[0]?.id,
    ]);
    expect(first).toBeDefined();
    expect(second).toBe(first);
  });

  test('leaves no rows behind when the work fails halfway', async () => {
    // Unique per run, so a leftover from a failed run cannot affect the next one.
    const username = `transaction-test-${Date.now()}`;
    const countUsers = () =>
      pool.query<{ n: number }>('SELECT count(*)::int AS n FROM app_user WHERE username = $1', [
        username,
      ]);
    try {
      await expect(
        withTransaction(async (client) => {
          await client.query('SELECT create_user($1, $2, $3)', [
            username,
            `${username}@example.com`,
            'not-a-real-hash',
          ]);
          // The insert above worked; this second step fails, so it must be undone.
          await client.query('SELECT 1 / 0');
        }),
      ).rejects.toThrow('division by zero');
      expect((await countUsers()).rows[0]?.n).toBe(0);
    } finally {
      // Only matters if withTransaction is broken and the row was committed.
      await pool.query('DELETE FROM app_user WHERE username = $1', [username]);
    }
  });

  test('the pool still works after a failed transaction', async () => {
    await expect(
      withTransaction(async (client) => client.query('SELECT * FROM no_such_table')),
    ).rejects.toThrow();
    const { rows } = await pool.query<{ ok: number }>('SELECT 1 AS ok');
    expect(rows[0]?.ok).toBe(1);
  });
});
