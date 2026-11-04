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

export class NotFoundError extends HttpError {
  override name = 'NotFoundError';

  constructor(message: string) {
    super(404, message);
  }
}

export class ServiceUnavailableError extends HttpError {
  override name = 'ServiceUnavailableError';

  constructor(message: string) {
    super(503, message);
  }
}
