// Business logic for titles: fetches rows through the repository and returns API objects.

import { pool } from '../db/pool.js';
import { takePage } from '../lib/paging.js';
import { toPopularActorDto } from '../mappers/person.mapper.js';
import { toSimilarTitleDto, toTitleDto, toTitleSummaryDto } from '../mappers/title.mapper.js';
import { NotFoundError } from '../middleware/errors.js';
import {
  findPopularActors,
  findSimilarTitles,
  findTitleById,
  searchTitlesByText,
} from '../repositories/title.repository.js';
import type { PageRequest, PageSlice } from '../types/page.js';
import type { PopularActorDto } from '../types/person.js';
import type { SimilarTitleDto, TitleDto, TitleSummaryDto } from '../types/title.js';
import { saveSearch } from './search-history.service.js';

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

export async function getSimilarTitles(
  tconst: string,
  pageRequest: PageRequest,
): Promise<PageSlice<SimilarTitleDto>> {
  const title = await findTitleById(tconst);
  if (!title) {
    throw new NotFoundError(`Title ${tconst} not found`);
  }
  const rows = await findSimilarTitles(pool, tconst, pageRequest);
  return takePage(rows, pageRequest, toSimilarTitleDto);
}

export async function getPopularActors(
  tconst: string,
  pageRequest: PageRequest,
): Promise<PageSlice<PopularActorDto>> {
  const title = await findTitleById(tconst);
  if (!title) {
    throw new NotFoundError(`Title ${tconst} not found`);
  }
  const rows = await findPopularActors(pool, tconst, pageRequest);
  return takePage(rows, pageRequest, toPopularActorDto);
}
