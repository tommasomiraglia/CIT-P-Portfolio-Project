// Business rules for a user's search history.
import { pool } from '../db/pool.js';
import { takePage } from '../lib/paging.js';
import { toSearchHistoryDto } from '../mappers/search-history.mapper.js';
import { NotFoundError, UnauthorizedError } from '../middleware/errors.js';
import {
  addSearchHistory,
  clearSearchHistory,
  deleteSearchHistoryEntry,
  listSearchHistory,
  UnknownUserError,
} from '../repositories/search-history.repository.js';
import { userExists } from '../repositories/user.repository.js';
import type { PageRequest, PageSlice } from '../types/page.js';
import type { SearchHistoryDto } from '../types/search-history.js';

// Records one search of a logged-in user. The title and person searches call it.
export async function saveSearch(userId: number, query: string): Promise<void> {
  try {
    await addSearchHistory(pool, userId, query);
  } catch (error) {
    if (error instanceof UnknownUserError) {
      throw new UnauthorizedError('User no longer exists');
    }
    throw error;
  }
}

export async function getSearchHistory(
  userId: number,
  pageRequest: PageRequest,
): Promise<PageSlice<SearchHistoryDto>> {
  await ensureUserExists(userId);
  const rows = await listSearchHistory(pool, userId, pageRequest);
  return takePage(rows, pageRequest, (row) => toSearchHistoryDto(userId, row));
}

export async function removeSearchHistoryEntry(userId: number, entryId: string): Promise<void> {
  await ensureUserExists(userId);
  if (!(await deleteSearchHistoryEntry(pool, userId, entryId))) {
    throw new NotFoundError(`Search history entry ${entryId} not found`);
  }
}

export async function removeAllSearchHistory(userId: number): Promise<void> {
  await ensureUserExists(userId);
  await clearSearchHistory(pool, userId);
}

// A user deleted after logging in still has a valid token (docs/api-design.md 4.3).
async function ensureUserExists(userId: number): Promise<void> {
  if (!(await userExists(pool, userId))) {
    throw new UnauthorizedError('User no longer exists');
  }
}
