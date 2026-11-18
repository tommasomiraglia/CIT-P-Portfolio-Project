// Converts a search history row into the SearchHistoryDto the API sends.
import type { SearchHistoryDto, SearchHistoryRow } from '../types/search-history.js';
import { userUrl } from './user.mapper.js';

// The row does not say whose entry it is: get_search_history already filters on one user,
// so the caller passes that user's id for the URL.
export function toSearchHistoryDto(userId: number, row: SearchHistoryRow): SearchHistoryDto {
  return {
    url: `${userUrl(userId)}/search-history/${row.historyid}`,
    id: row.historyid,
    searchText: row.value,
    time: row.time.toISOString(),
  };
}
