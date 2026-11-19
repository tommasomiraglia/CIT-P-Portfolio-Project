// The single connection pool shared by the whole application.
// A pool keeps a few connections open and lends them out per query,
// which is much faster than opening a new connection every time.
import pg from 'pg';
import { config } from '../config/index.js';

const { ssl, sslVerify, ...connection } = config.db;

export const pool = new pg.Pool({
  ...connection,
  // rejectUnauthorized: false still encrypts, but accepts any certificate, even an
  // expired one or one from someone posing as the server.
  ssl: ssl ? { rejectUnauthorized: sslVerify } : false,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

// An idle client can lose its connection (for example if the database restarts).
// Without this listener, that error would crash the process.
pool.on('error', (error) => {
  console.error('Unexpected error on an idle database client:', error.message);
});
