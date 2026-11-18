// A genre as the database returns it and as the API sends it (docs/api-design.md 2.6).

// One row of the generes table, of get_genre_preferences(), and of the query for one
// genre preference.
export interface GenreRow {
  genereid: number;
  name: string;
}

export interface GenreDto {
  url: string;
  id: number;
  name: string;
}
