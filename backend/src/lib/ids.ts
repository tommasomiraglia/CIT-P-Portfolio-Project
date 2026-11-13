// Validation of numeric ids in URLs (docs/api-design.md 1.5: positive integers).
import { BadRequestError } from '../middleware/errors.js';

// Digits only, no leading zero. The upper bound is PostgreSQL's INTEGER, the type of the
// id columns: a larger value would make the query fail with a 500 instead of a 400.
const POSITIVE_INTEGER = /^[1-9]\d*$/;
const MAX_SQL_INTEGER = 2_147_483_647;

export function parseIntegerId(name: string, value: string): number {
  const id = POSITIVE_INTEGER.test(value) ? Number(value) : 0;
  if (id < 1 || id > MAX_SQL_INTEGER) {
    throw new BadRequestError(`Invalid ${name} "${value}": expected a positive integer`);
  }
  return id;
}
