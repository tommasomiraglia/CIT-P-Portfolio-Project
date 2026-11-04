// Converts a title row from the database into the TitleDto the API sends.
import type { TitleDto, TitleRow } from '../types/title.js';

// The OMDB import stores "N/A" (and sometimes an empty string) where a value is unknown.
// The API uses null for every missing value, so clients only have one case to handle.
function textOrNull(value: string | null): string | null {
  return value === null || value === '' || value === 'N/A' ? null : value;
}

export function toTitleDto(row: TitleRow): TitleDto {
  return {
    url: `/api/titles/${row.tconst}`,
    id: row.tconst,
    title: row.primarytitle,
    type: row.titletype,
    isAdult: row.isadult,
    startYear: row.startyear,
    endYear: row.endyear,
    runtimeMinutes: row.runtimeminutes,
    plot: textOrNull(row.plot),
    posterUrl: textOrNull(row.poster_link),
  };
}
