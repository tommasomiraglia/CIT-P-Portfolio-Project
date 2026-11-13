// Business logic for titles: fetches rows through the repository and returns API objects.

import { pool } from '../db/pool.js';
import { takePage } from '../lib/paging.js';
import { toTitleDto, toTitleSummaryDto } from '../mappers/title.mapper.js';
import { NotFoundError, UnauthorizedError } from '../middleware/errors.js';
import { addSearchHistory, UnknownUserError } from '../repositories/search-history.repository.js';
import { findTitleById, searchTitlesByText } from '../repositories/title.repository.js';
import type { PageRequest, PageSlice } from '../types/page.js';
import type { TitleDto, TitleSummaryDto } from '../types/title.js';

export async function getTitle(tconst: string): Promise<TitleDto> {
  const row = await findTitleById(tconst);
  if (!row) {
    throw new NotFoundError(`Title ${tconst} not found`);
  }
  return toTitleDto(row);
}

// A logged-in user's search is saved to their history, an anonymous one is not.
// Only page 1 is saved: following the next links is still the same search, and saving
// every page was the problem the database change in database/CHANGES.md removed.
// The history write and the search do not need a transaction: a search that is shown
// but not saved, or saved but not shown, leaves no inconsistent data.
export async function searchTitles(
  query: string,
  pageRequest: PageRequest,
  userId?: number,
): Promise<PageSlice<TitleSummaryDto>> {
  if (userId !== undefined && pageRequest.page === 1) {
    await saveSearch(userId, query);
  }
  const rows = await searchTitlesByText(pool, query, pageRequest);
  return takePage(rows, pageRequest, toTitleSummaryDto);
}

async function saveSearch(userId: number, query: string): Promise<void> {
  try {
    await addSearchHistory(pool, userId, query);
  } catch (error) {
    if (error instanceof UnknownUserError) {
      throw new UnauthorizedError('User no longer exists');
    }
    throw error;
  }
}
