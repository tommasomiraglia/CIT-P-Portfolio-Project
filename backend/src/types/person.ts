// One row of string_names(): just enough to list a name in search results.
export interface PersonSearchRow {
  nconst: string;
  primaryname: string;
}

// A name as an element of a list.
export interface PersonSummaryDto {
  url: string;
  id: string;
  name: string;
}