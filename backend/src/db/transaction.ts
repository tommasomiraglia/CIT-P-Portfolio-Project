// Runs several queries as one unit: either all of them take effect or none does (2-D.4).
//
// A transaction belongs to one database connection, so every query in it must go through
// the same client. pool.query() cannot guarantee that: it may pick a different connection
// for each call. withTransaction() borrows one client, hands it to `work`, and returns it.
//
// Usage in a service, which decides what must succeed or fail together:
//
//   await withTransaction(async (client) => {
//     await rateTitle(client, userId, titleId, rating);
//     await setRatingComment(client, userId, titleId, comment);
//   });
//
// The repository functions take the client as their first parameter (type Queryable),
// so the same function works both inside a transaction and on its own with `pool`.
import type { Pool, PoolClient } from 'pg';
import { pool } from './pool.js';

// What a repository function needs to run a query: the pool, or a client in a transaction.
export type Queryable = Pool | PoolClient;

// The part of the pool withTransaction uses. A parameter so that tests can pass a fake.
export interface ConnectionSource {
  connect(): Promise<PoolClient>;
}

export async function withTransaction<T>(
  work: (client: PoolClient) => Promise<T>,
  source: ConnectionSource = pool,
): Promise<T> {
  const client = await source.connect();
  // Set when ROLLBACK itself fails: the connection is then in an unknown state, and
  // passing the error to release() makes the pool close it instead of lending it out again.
  let brokenConnection: Error | undefined;
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      brokenConnection =
        rollbackError instanceof Error ? rollbackError : new Error(String(rollbackError));
    }
    // The original error is the one that explains what went wrong, not the rollback's.
    throw error;
  } finally {
    client.release(brokenConnection);
  }
}
