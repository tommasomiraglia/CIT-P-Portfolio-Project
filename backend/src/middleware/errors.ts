// Error classes that carry an HTTP status. Services and controllers throw them,
// and the error handler in error-handler.ts turns them into JSON responses.
// Their messages are sent to the client, so they must never contain SQL or internal details.

export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export class BadRequestError extends HttpError {
  override name = 'BadRequestError';

  constructor(message: string) {
    super(400, message);
  }
}

// Missing, invalid or expired credentials: the caller is not known (docs/api-design.md 4.4).
export class UnauthorizedError extends HttpError {
  override name = 'UnauthorizedError';

  constructor(message: string) {
    super(401, message);
  }
}

// The caller is known, but may not act on this resource, for example another user's data.
export class ForbiddenError extends HttpError {
  override name = 'ForbiddenError';

  constructor(message: string) {
    super(403, message);
  }
}

export class NotFoundError extends HttpError {
  override name = 'NotFoundError';

  constructor(message: string) {
    super(404, message);
  }
}

// The request is valid but clashes with existing data, such as a username already taken.
export class ConflictError extends HttpError {
  override name = 'ConflictError';

  constructor(message: string) {
    super(409, message);
  }
}

export class ServiceUnavailableError extends HttpError {
  override name = 'ServiceUnavailableError';

  constructor(message: string) {
    super(503, message);
  }
}
