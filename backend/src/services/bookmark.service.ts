// Business rules for a user's bookmarks of titles and people (docs/api-design.md 1.13).
// Every function is only called for the logged-in user's own id: authorizeSelf checked
// that before the controller ran.
import { pool } from '../db/pool.js';
import { takePage } from '../lib/paging.js';
import { toPersonBookmarkDto, toTitleBookmarkDto } from '../mappers/bookmark.mapper.js';
import { NotFoundError, UnauthorizedError } from '../middleware/errors.js';
import {
  bookmarkPerson,
  bookmarkTitle,
  findPersonBookmark,
  findPersonBookmarksByUser,
  findTitleBookmark,
  findTitleBookmarksByUser,
  removePersonBookmark,
  removeTitleBookmark,
} from '../repositories/bookmark.repository.js';
import { findPersonById } from '../repositories/person.repository.js';
import { findTitleById } from '../repositories/title.repository.js';
import { userExists } from '../repositories/user.repository.js';
import type { PersonBookmarkDto, TitleBookmarkDto } from '../types/bookmark.js';
import type { PageRequest, PageSlice } from '../types/page.js';

export async function listTitleBookmarks(
  userId: number,
  pageRequest: PageRequest,
): Promise<PageSlice<TitleBookmarkDto>> {
  await ensureUserExists(userId);
  const rows = await findTitleBookmarksByUser(pool, userId, pageRequest);
  return takePage(rows, pageRequest, (row) => toTitleBookmarkDto(userId, row));
}

export async function getTitleBookmark(userId: number, titleId: string): Promise<TitleBookmarkDto> {
  await ensureUserExists(userId);
  const row = await findTitleBookmark(pool, userId, titleId);
  if (!row) {
    throw new NotFoundError(`You have not bookmarked title ${titleId}`);
  }
  return toTitleBookmarkDto(userId, row);
}

// PUT: 200 with the bookmark, also when it already existed (docs/api-design.md 1.6).
// The title is checked first: titles never change (IMDB data is read-only), and
// bookmark_title itself would only fail with a foreign key error, which says nothing clear.
export async function addTitleBookmark(userId: number, titleId: string): Promise<TitleBookmarkDto> {
  await ensureUserExists(userId);
  const title = await findTitleById(titleId);
  if (!title) {
    throw new NotFoundError(`Title ${titleId} not found`);
  }
  await bookmarkTitle(pool, userId, titleId);
  return toTitleBookmarkDto(userId, title);
}

export async function removeOwnTitleBookmark(userId: number, titleId: string): Promise<void> {
  await ensureUserExists(userId);
  if (!(await removeTitleBookmark(pool, userId, titleId))) {
    throw new NotFoundError(`You have not bookmarked title ${titleId}`);
  }
}

export async function listPersonBookmarks(
  userId: number,
  pageRequest: PageRequest,
): Promise<PageSlice<PersonBookmarkDto>> {
  await ensureUserExists(userId);
  const rows = await findPersonBookmarksByUser(pool, userId, pageRequest);
  return takePage(rows, pageRequest, (row) => toPersonBookmarkDto(userId, row));
}

export async function getPersonBookmark(
  userId: number,
  personId: string,
): Promise<PersonBookmarkDto> {
  await ensureUserExists(userId);
  const row = await findPersonBookmark(pool, userId, personId);
  if (!row) {
    throw new NotFoundError(`You have not bookmarked person ${personId}`);
  }
  return toPersonBookmarkDto(userId, row);
}

// The same rules as addTitleBookmark, for people.
export async function addPersonBookmark(
  userId: number,
  personId: string,
): Promise<PersonBookmarkDto> {
  await ensureUserExists(userId);
  const person = await findPersonById(personId);
  if (!person) {
    throw new NotFoundError(`Person ${personId} not found`);
  }
  await bookmarkPerson(pool, userId, personId);
  return toPersonBookmarkDto(userId, person);
}

export async function removeOwnPersonBookmark(userId: number, personId: string): Promise<void> {
  await ensureUserExists(userId);
  if (!(await removePersonBookmark(pool, userId, personId))) {
    throw new NotFoundError(`You have not bookmarked person ${personId}`);
  }
}

// A user deleted after logging in still has a valid token (docs/api-design.md 4.3).
// Without this check the lists would answer an empty page, GET and DELETE a 404, and PUT
// a foreign key error.
async function ensureUserExists(userId: number): Promise<void> {
  if (!(await userExists(pool, userId))) {
    throw new UnauthorizedError('User no longer exists');
  }
}
