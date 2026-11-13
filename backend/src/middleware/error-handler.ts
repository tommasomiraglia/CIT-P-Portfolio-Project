// The last two middleware in the chain: a 404 for unknown routes, and the one place
// where errors become HTTP responses, so controllers never repeat error handling (2-D.5).
// Every error response has the same shape: { "error": { "message": "..." } }.
import type { ErrorRequestHandler, RequestHandler } from 'express';
import { HttpError, NotFoundError } from './errors.js';

// Errors from Express's own middleware (for example invalid JSON in a request body)
// have a 4xx `status` and `expose: true`, meaning their message is safe to show.
interface ExposableError {
  status: number;
  expose: true;
  message: string;
}

function isExposableClientError(error: unknown): error is ExposableError {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const { status, expose } = error as Partial<ExposableError>;
  return typeof status === 'number' && status >= 400 && status < 500 && expose === true;
}

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new NotFoundError(`No route for ${req.method} ${req.path}`));
};

// Express recognizes an error handler by its four parameters, so `_next` must stay
// even though it is unused.
export const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  if (error instanceof HttpError || isExposableClientError(error)) {
    if (error.status === 401) {
      // The HTTP standard requires every 401 to say which kind of credentials to send.
      res.set('WWW-Authenticate', 'Bearer');
    }
    res.status(error.status).json({ error: { message: error.message } });
    return;
  }
  // Anything else is a bug or an infrastructure failure. The details (stack trace,
  // SQL error) stay in the server log; the client only gets a generic message (2-A.4).
  console.error('Unhandled error:', error);
  res.status(500).json({ error: { message: 'Internal server error' } });
};
