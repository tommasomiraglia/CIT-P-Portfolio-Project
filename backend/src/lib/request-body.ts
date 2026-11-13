// Reading fields from a JSON request body, with a 400 that names the field when it is wrong.
import { BadRequestError } from '../middleware/errors.js';

// A JSON body is parsed into req.body; without one (or with another Content-Type)
// req.body is undefined, and a JSON array or string is not a valid body either.
export function readJsonObject(body: unknown): Record<string, unknown> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new BadRequestError('Expected a JSON object as the request body');
  }
  return body as Record<string, unknown>;
}

export function requireString(body: Record<string, unknown>, field: string): string {
  const value = body[field];
  if (typeof value !== 'string' || value === '') {
    throw new BadRequestError(`"${field}" is required and must be a non-empty string`);
  }
  return value;
}
