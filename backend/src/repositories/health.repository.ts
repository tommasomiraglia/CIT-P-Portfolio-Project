// Database access for the health check.
import { pool } from '../db/pool.js';

// Throws if no connection can be made within the pool's connection timeout.
export async function pingDatabase(): Promise<void> {
  await pool.query('SELECT 1');
}
