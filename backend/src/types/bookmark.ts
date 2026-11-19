// A user's bookmarks of titles and people as the database returns them and as the API
// sends them (docs/api-design.md 1.13 and 2.6).
import type { TitleReferenceDto } from './rating.js';

// One row of get_bookmarked_titles(), and of the query for a single title bookmark.
export interface TitleBookmarkRow {
  tconst: string;
  primarytitle: string;
}

// One row of get_bookmarked_persons(), and of the query for a single person bookmark.
export interface PersonBookmarkRow {
  nconst: string;
  primaryname: string;
}

// A reference to a person: its URI and a label to display (docs/api-design.md 2.4).
export interface PersonReferenceDto {
  url: string;
  name: string;
}

export interface TitleBookmarkDto {
  url: string;
  title: TitleReferenceDto;
}

export interface PersonBookmarkDto {
  url: string;
  person: PersonReferenceDto;
}
