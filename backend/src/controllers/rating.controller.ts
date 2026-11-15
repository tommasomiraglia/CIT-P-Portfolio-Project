// HTTP handlers for /api/users/:userId/ratings: validate the request, call the service,
// send the JSON. authenticate and authorizeSelf already ran, so :userId is valid and
// belongs to the caller.
import type { Request, Response } from 'express';
import { parseIntegerId, parseTitleId } from '../lib/ids.js';
import { buildPage, parsePageRequest } from '../lib/paging.js';
import { readJsonObject } from '../lib/request-body.js';
import { BadRequestError } from '../middleware/errors.js';
import { deleteRating, getRating, listRatings, saveRating } from '../services/rating.service.js';
import type { RatingInput } from '../types/rating.js';

type UserParams = { userId: string };
type RatingParams = { userId: string; titleId: string };

// The rules of docs/api-design.md 1.8.
const MIN_RATING = 1;
const MAX_RATING = 10;
const MAX_COMMENT_LENGTH = 2000;
// PostgreSQL cannot store this character in a text column: the query would fail with a 500.
const NUL = '\u0000';

// A JSON number only: "8" is rejected, like 8.5, null and a missing field.
function parseRating(value: unknown): number {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < MIN_RATING ||
    value > MAX_RATING
  ) {
    throw new BadRequestError(
      `"rating" is required and must be a whole number from ${MIN_RATING} to ${MAX_RATING}`,
    );
  }
  return value;
}

// A missing comment, null and a comment of only spaces all mean "no comment".
function parseComment(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const comment = typeof value === 'string' ? value.trim() : undefined;
  // Counted in characters, not UTF-16 units, so an emoji counts once.
  if (comment === undefined || [...comment].length > MAX_COMMENT_LENGTH || comment.includes(NUL)) {
    throw new BadRequestError(
      `"comment" must be null or a text of at most ${MAX_COMMENT_LENGTH} characters`,
    );
  }
  return comment === '' ? null : comment;
}

function parseRatingInput(body: Record<string, unknown>): RatingInput {
  return { rating: parseRating(body.rating), comment: parseComment(body.comment) };
}

// GET /api/users/:userId/ratings
export async function listUserRatings(req: Request<UserParams>, res: Response): Promise<void> {
  const userId = parseIntegerId('user id', req.params.userId);
  const pageRequest = parsePageRequest(req.query);
  const slice = await listRatings(userId, pageRequest);
  res.json(buildPage(slice, pageRequest, req.originalUrl));
}

// GET /api/users/:userId/ratings/:titleId
export async function getUserRating(req: Request<RatingParams>, res: Response): Promise<void> {
  const userId = parseIntegerId('user id', req.params.userId);
  res.json(await getRating(userId, parseTitleId(req.params.titleId)));
}

// PUT /api/users/:userId/ratings/:titleId with { "rating": 1-10, "comment": "..." }.
// 200 for a first rating too: the client chose the URI, so there is no new address to
// announce with 201 and a Location header (docs/api-design.md 1.6).
export async function putUserRating(req: Request<RatingParams>, res: Response): Promise<void> {
  const userId = parseIntegerId('user id', req.params.userId);
  const titleId = parseTitleId(req.params.titleId);
  const input = parseRatingInput(readJsonObject(req.body));
  res.json(await saveRating(userId, titleId, input));
}

// DELETE /api/users/:userId/ratings/:titleId
export async function deleteUserRating(req: Request<RatingParams>, res: Response): Promise<void> {
  const userId = parseIntegerId('user id', req.params.userId);
  await deleteRating(userId, parseTitleId(req.params.titleId));
  res.status(204).end();
}
