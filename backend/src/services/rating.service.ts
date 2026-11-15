// Business rules for a user's ratings. Every function is only called for the logged-in
// user's own id: authorizeSelf checked that before the controller ran.
import { pool } from '../db/pool.js';
import type { Queryable } from '../db/transaction.js';
import { withTransaction } from '../db/transaction.js';
import { takePage } from '../lib/paging.js';
import { toRatingDto } from '../mappers/rating.mapper.js';
import { NotFoundError, UnauthorizedError } from '../middleware/errors.js';
import {
  findRating,
  findRatingsByUser,
  rateTitle,
  removeRating,
  setRatingComment,
} from '../repositories/rating.repository.js';
import { findTitleById } from '../repositories/title.repository.js';
import { lockUser } from '../repositories/user.repository.js';
import type { PageRequest, PageSlice } from '../types/page.js';
import type { RatingDto, RatingInput } from '../types/rating.js';

export async function listRatings(
  userId: number,
  pageRequest: PageRequest,
): Promise<PageSlice<RatingDto>> {
  const rows = await findRatingsByUser(pool, userId, pageRequest);
  return takePage(rows, pageRequest, (row) => toRatingDto(userId, row));
}

export async function getRating(userId: number, titleId: string): Promise<RatingDto> {
  const row = await findRating(pool, userId, titleId);
  if (!row) {
    throw new NotFoundError(`You have not rated title ${titleId}`);
  }
  return toRatingDto(userId, row);
}

// rate() and unrate() first read the user's current rating and then change the title's
// average with it. Two requests of the same user at the same moment (a double click)
// would both read the old state. Locking the user's row makes them take turns.
// A missing row means the user was deleted after logging in: the token no longer names
// anyone (docs/api-design.md 4.3).
async function lockOwnUser(db: Queryable, userId: number): Promise<void> {
  if (!(await lockUser(db, userId))) {
    throw new UnauthorizedError('User no longer exists');
  }
}

// Saves the rating and its comment together (2-D.4): rate() and set_rating_comment() are
// two database calls, and without the transaction a failure of the second would leave a
// new rating without its comment, or a changed rating with the comment of the old one.
// PUT replaces the whole rating, so a missing comment removes the one that was there.
export async function saveRating(
  userId: number,
  titleId: string,
  input: RatingInput,
): Promise<RatingDto> {
  // Checked before the transaction: titles never change (IMDB data is read-only), and
  // rate() itself would only fail with a foreign key error, which says nothing clear.
  if (!(await findTitleById(titleId))) {
    throw new NotFoundError(`Title ${titleId} not found`);
  }
  const row = await withTransaction(async (client) => {
    await lockOwnUser(client, userId);
    await rateTitle(client, userId, titleId, input.rating);
    const commented = await setRatingComment(client, userId, titleId, input.comment);
    // Read back what is stored, so the answer is the resource a GET would return.
    const saved = commented ? await findRating(client, userId, titleId) : undefined;
    if (!saved) {
      // Cannot happen while the user is locked. Throwing rolls the rating back.
      throw new Error(`Rating of user ${userId} on ${titleId} was not there after saving it`);
    }
    return saved;
  });
  return toRatingDto(userId, row);
}

// One database call, but in a transaction so that the lock on the user holds during it.
export async function deleteRating(userId: number, titleId: string): Promise<void> {
  const removed = await withTransaction(async (client) => {
    await lockOwnUser(client, userId);
    return removeRating(client, userId, titleId);
  });
  if (!removed) {
    throw new NotFoundError(`You have not rated title ${titleId}`);
  }
}
