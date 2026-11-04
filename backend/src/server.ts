// Entry point: starts the HTTP server and shuts it down cleanly on Ctrl+C or SIGTERM.
// Run with: npm start (after npm run build), or npm run dev while developing.
import { app } from './app.js';
import { config } from './config/index.js';
import { pool } from './db/pool.js';

const server = app.listen(config.port, (error) => {
  if (error) {
    // For example EADDRINUSE: another process already uses the port.
    console.error(`Could not listen on port ${config.port}:`, error.message);
    process.exitCode = 1;
    void pool.end();
    return;
  }
  console.log(`API listening on http://localhost:${config.port}`);
});

// Graceful shutdown: stop accepting new connections, let requests in progress finish,
// then close the database connections, so nothing is cut off halfway.
let shuttingDown = false;

function shutdown(signal: NodeJS.Signals): void {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  console.log(`${signal} received, shutting down...`);
  server.close(async (error) => {
    if (error) {
      console.error('Error while closing the HTTP server:', error.message);
      process.exitCode = 1;
    }
    await pool.end();
    console.log('Shutdown complete.');
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
