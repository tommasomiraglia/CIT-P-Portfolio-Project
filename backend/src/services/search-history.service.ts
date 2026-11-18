// Business rules for a user's search history.
import { pool } from '../db/pool.js';
import { takePage, toLimitOffset } from '../lib/paging.js';
import { NotFoundError, UnauthorizedError } from '../middleware/errors.js';
import {
  clearSearchHistory,
  deleteSearchHistoryEntry,
  listSearchHistory,
} from '../repositories/search-history.repository.js';
import { userExists } from '../repositories/user.repository.js';
import type { PageRequest, PageSlice } from '../types/page.js';
import type { SearchHistoryDto } from '../types/search-history.js';

function toSearchHistoryDto(
  userId: number,
  row: { historyid: string; time: Date; value: string },
): SearchHistoryDto {
  return {
    url: `/api/users/${userId}/search-history/${row.historyid}`,
    id: row.historyid,
    searchText: row.value,
    time: row.time.toISOString(),
  };
}

export async function getSearchHistory(
  userId: number,
  pageRequest: PageRequest,
): Promise<PageSlice<SearchHistoryDto>> {
  await ensureUserExists(userId);
  const { limit, offset } = toLimitOffset(pageRequest);
  const rows = await listSearchHistory(pool, userId, limit, offset);
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

async function ensureUserExists(userId: number): Promise<void> {
  if (!(await userExists(pool, userId))) {
    throw new UnauthorizedError('User no longer exists');
  }
}
