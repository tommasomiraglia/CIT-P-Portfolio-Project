// Converts a title row from the database into the TitleDto the API sends.
import type {
  RankedTitleDto,
  RankedTitleRow,
  SimilarTitleDto,
  SimilarTitleRow,
  TitleDto,
  TitleRatingDto,
  TitleRow,
  TitleSearchRow,
  TitleSummaryDto,
  WordMatchTitleDto,
} from '../types/title.js';

// The OMDB import stores "N/A" (and sometimes an empty string) where a value is unknown.
// The API uses null for every missing value, so clients only have one case to handle.
function textOrNull(value: string | null): string | null {
  return value === null || value === '' || value === 'N/A' ? null : value;
}

export function titleUrl(tconst: string): string {
  return `/api/titles/${tconst}`;
}

export function toTitleDto(row: TitleRow): TitleDto {
  return {
    url: titleUrl(row.tconst),
    id: row.tconst,
    title: row.primarytitle,
    type: row.titletype,
    isAdult: row.isadult,
    startYear: row.startyear,
    endYear: row.endyear,
    runtimeMinutes: row.runtimeminutes,
    plot: textOrNull(row.plot),
    posterUrl: textOrNull(row.poster_link),
    genres: row.genres,
    rating: toTitleRatingDto(row),
  };
}

// A title without votes has no title_ratings row, so both columns are null. One rating
// object or null keeps the client from handling an average without votes or the reverse.
function toTitleRatingDto(row: TitleRow): TitleRatingDto | null {
  if (row.averagerating === null || row.numvotes === null) {
    return null;
  }
  return { average: row.averagerating, votes: row.numvotes };
}

export function toTitleSummaryDto(row: TitleSearchRow): TitleSummaryDto {
  return {
    url: titleUrl(row.tconst),
    id: row.tconst,
    title: row.primarytitle,
  };
}

// One similarity_search row → a similar title in a list.
export function toSimilarTitleDto(row: SimilarTitleRow): SimilarTitleDto {
  return {
    url: titleUrl(row.tconst),
    id: row.tconst,
    title: row.primarytitle,
    sharedGenres: row.freq,
  };
}

// One any_match_search row: rank is the number of the given words the title contains.
export function toWordMatchTitleDto(row: RankedTitleRow): WordMatchTitleDto {
  return { ...toTitleSummaryDto(row), matchedWords: row.rank };
}

// One weights_search row: rank is the summed weight of the given words in the title.
export function toRankedTitleDto(row: RankedTitleRow): RankedTitleDto {
  return { ...toTitleSummaryDto(row), relevance: row.rank };
}
