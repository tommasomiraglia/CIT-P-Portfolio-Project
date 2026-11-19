// Validation of the ids in URLs (docs/api-design.md 1.5): positive integers, and IMDB
// title and person ids.
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

// IMDB title ids: "tt" followed by 7 or 8 digits, for example tt0052520.
// Rejecting anything else early gives the client a clear 400 instead of a misleading 404.
const TITLE_ID = /^tt\d{7,8}$/;

export function parseTitleId(value: string): string {
  if (!TITLE_ID.test(value)) {
    throw new BadRequestError(
      `Invalid title id "${value}": expected "tt" followed by 7 or 8 digits`,
    );
  }
  return value;
}

// IMDB person ids: "nm" followed by 7 or 8 digits, for example nm0000136.
const PERSON_ID = /^nm\d{7,8}$/;

export function parsePersonId(value: string): string {
  if (!PERSON_ID.test(value)) {
    throw new BadRequestError(
      `Invalid person id "${value}": expected "nm" followed by 7 or 8 digits`,
    );
  }
  return value;
}
