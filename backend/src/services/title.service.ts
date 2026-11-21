// Business logic for titles: fetches rows through the repository and returns API objects.

import { pool } from '../db/pool.js';
import { takePage } from '../lib/paging.js';
import { toPopularActorDto } from '../mappers/person.mapper.js';
import {
  toRankedTitleDto,
  toSimilarTitleDto,
  toTitleDto,
  toTitleSummaryDto,
  toWordMatchTitleDto,
} from '../mappers/title.mapper.js';
import { NotFoundError } from '../middleware/errors.js';
import {
  findPopularActors,
  findSimilarTitles,
  findTitleById,
  findTitlesRankedByWords,
  findTitlesWithAllWords,
  findTitlesWithAnyWord,
  searchTitlesByFields,
  searchTitlesByText,
} from '../repositories/title.repository.js';
import type { PageRequest, PageSlice } from '../types/page.js';
import type { PopularActorDto } from '../types/person.js';
import type {
  SimilarTitleDto,
  TitleDto,
  TitleFieldSearch,
  TitleSummaryDto,
  WordMatch,
} from '../types/title.js';
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

// The history stores one text per search. A structured search has up to four, so they are
// written as "title:dark knight names:ledger", the form Subproject 1 used, with the
// fields the user left out omitted.
function describeFieldSearch(fields: TitleFieldSearch): string {
  return Object.entries(fields)
    .filter(([, text]) => text !== null)
    .map(([field, text]) => `${field}:${text}`)
    .join(' ');
}

// Same rules as searchTitles: a logged-in search is saved to history on page 1 only.
export async function searchTitlesByStructuredFields(
  fields: TitleFieldSearch,
  pageRequest: PageRequest,
  userId?: number,
): Promise<PageSlice<TitleSummaryDto>> {
  if (userId !== undefined && pageRequest.page === 1) {
    await saveSearch(userId, describeFieldSearch(fields));
  }
  const rows = await searchTitlesByFields(pool, fields, pageRequest);
  return takePage(rows, pageRequest, toTitleSummaryDto);
}

// The word searches are not saved to the history: only the text, structured and name
// searches are, as in Subproject 1 (docs/api-design.md 1.5).
// Each way of matching has its own database function, and the two that rank also say
// what they ranked by: the number of words found, or the relevance score.
export async function searchTitlesByWords(
  words: string[],
  match: WordMatch,
  pageRequest: PageRequest,
): Promise<PageSlice<TitleSummaryDto>> {
  switch (match) {
    case 'exact':
      return takePage(
        await findTitlesWithAllWords(pool, words, pageRequest),
        pageRequest,
        toTitleSummaryDto,
      );
    case 'any':
      return takePage(
        await findTitlesWithAnyWord(pool, words, pageRequest),
        pageRequest,
        toWordMatchTitleDto,
      );
    case 'ranked':
      return takePage(
        await findTitlesRankedByWords(pool, words, pageRequest),
        pageRequest,
        toRankedTitleDto,
      );
  }
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
