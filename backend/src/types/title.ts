// A title as the database returns it (TitleRow) and as the API sends it (TitleDto).
// Keeping both shapes lets the database schema change without changing the API contract.

// One row of the query in title.repository.ts: title_basic joined with its type name,
// its rating and its genres. Column names are lowercase because that is how PostgreSQL
// returns unquoted identifiers.
export interface TitleRow {
  tconst: string;
  primarytitle: string;
  titletype: string | null;
  isadult: boolean | null;
  startyear: number | null;
  endyear: number | null;
  runtimeminutes: number | null;
  plot: string | null;
  poster_link: string | null;
  // Both null when the title has no row in title_ratings, that is, no votes.
  averagerating: number | null;
  numvotes: number | null;
  // Sorted by name, empty when the title has none.
  genres: string[];
}

export interface TitleRatingDto {
  average: number;
  votes: number;
}

export interface TitleDto {
  // URI of this resource, so clients never have to build URLs themselves (requirement 2-A.2).
  url: string;
  id: string;
  title: string;
  type: string | null;
  isAdult: boolean | null;
  startYear: number | null;
  endYear: number | null;
  runtimeMinutes: number | null;
  plot: string | null;
  posterUrl: string | null;
  // Embedded: a title has a handful of genres and one rating (docs/api-design.md 2.4).
  genres: string[];
  rating: TitleRatingDto | null;
}

// One row of string_search(): just enough to list a title in search results.
export interface TitleSearchRow {
  tconst: string;
  primarytitle: string;
}

// A title as an element of a list. The client follows `url` for the full TitleDto.
export interface TitleSummaryDto {
  url: string;
  id: string;
  title: string;
}
// One row of similarity_search(): a title and how many genres it shares with the given title
export interface SimilarTitleRow {
  tconst: string;
  primarytitle: string;
  freq: number;
}
// A similar title in a list: a title in a list and the number of genres it shares.

export interface SimilarTitleDto extends TitleSummaryDto {
  sharedGenres: number;
}
