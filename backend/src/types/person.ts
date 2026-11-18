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

// One row of the person query (name_basics + name_ratings).
export interface PersonRow {
  nconst: string;
  primaryname: string;
  birthyear: number | null;
  deathyear: number | null;
  rating: number | null;
}
// A list of professions
export interface PersonProfessionRow {
  name: string;
}

// A url and a title of the movie
export interface PersonKnownForRow {
  tconst: string;
  primarytitle: string;
}

// One known-for title in the API response
export interface KnownForTitleDto {
  url: string;
  title: string;
}

export interface PersonDto {
  url: string;
  id: string;
  name: string;
  birthYear: number | null;
  deathYear: number | null;
  professions: string[];
  rating: number | null;
  knownFor: KnownForTitleDto[];
}

export interface CoPlayerRow {
  nconst: string;
  primaryname: string;
  freq: number;
}

export interface CoPlayerDto extends PersonSummaryDto {
  sharedTitles: number;
}

export interface PersonWordRow {
  word: string;
  freq: number;
}

export interface PersonWordDto {
  url: string;
  word: string;
  frequency: number;
}
