// Converts a genre row into the GenreDto the API sends.
import type { GenreDto, GenreRow } from '../types/genre.js';

export function genreUrl(genreId: number): string {
  return `/api/genres/${genreId}`;
}

export function toGenreDto(row: GenreRow): GenreDto {
  return {
    url: genreUrl(row.genereid),
    id: row.genereid,
    name: row.name,
  };
}
