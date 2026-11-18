// A search history entry as the database returns it and as the API sends it
// (docs/api-design.md 2.6).

// One row of get_search_history(). historyid is a BIGSERIAL: pg returns a BIGINT as a
// string, because it can be larger than a JavaScript number holds exactly.
export interface SearchHistoryRow {
  historyid: string;
  time: Date;
  value: string;
}

export interface SearchHistoryDto {
  url: string;
  id: string;
  searchText: string;
  time: string;
}
