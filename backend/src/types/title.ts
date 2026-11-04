// A title as the database returns it (TitleRow) and as the API sends it (TitleDto).
// Keeping both shapes lets the database schema change without changing the API contract.

// One row of the query in title.repository.ts: title_basic joined with its type name.
// Column names are lowercase because that is how PostgreSQL returns unquoted identifiers.
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
}
