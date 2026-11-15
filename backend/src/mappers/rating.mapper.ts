// Converts a rating row into the RatingDto the API sends.
import type { RatingDto, RatingRow } from '../types/rating.js';
import { titleUrl } from './title.mapper.js';
import { userUrl } from './user.mapper.js';

// The row does not say whose rating it is: every query already filters on one user,
// so the caller passes that user's id for the URL.
export function toRatingDto(userId: number, row: RatingRow): RatingDto {
  return {
    url: `${userUrl(userId)}/ratings/${row.tconst}`,
    title: { url: titleUrl(row.tconst), name: row.primarytitle },
    rating: row.value,
    comment: row.comment,
  };
}
