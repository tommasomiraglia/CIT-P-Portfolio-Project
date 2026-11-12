// Builds the Express application without starting it. server.ts starts it for real,
// and the tests hand it straight to supertest, so no port is needed to test the API.
import express from 'express';
import { corsPolicy } from './middleware/cors.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { apiRouter } from './routes/index.js';

export const app = express();

// Do not advertise the framework in every response header.
app.disable('x-powered-by');

// Middleware runs in the order it is registered:
// CORS headers, then parse JSON bodies, then the routes, then 404 for anything unmatched,
// then errors.
// CORS comes first so that every response carries its headers, error responses included:
// without them the browser would hide a 400 or 404 from the frontend behind a network error.
// It also answers preflight OPTIONS requests before they reach the 404 handler.
app.use(corsPolicy);
app.use(express.json());
app.use('/api', apiRouter);
app.use(notFoundHandler);
app.use(errorHandler);
