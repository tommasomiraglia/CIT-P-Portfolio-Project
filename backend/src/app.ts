// Builds the Express application without starting it. server.ts starts it for real,
// and the tests hand it straight to supertest, so no port is needed to test the API.
import express from 'express';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { apiRouter } from './routes/index.js';

export const app = express();

// Do not advertise the framework in every response header.
app.disable('x-powered-by');

// Middleware runs in the order it is registered:
// parse JSON bodies, then the routes, then 404 for anything unmatched, then errors.
app.use(express.json());
app.use('/api', apiRouter);
app.use(notFoundHandler);
app.use(errorHandler);
