// Converts bookmark rows into the bookmark DTOs the API sends.
import type {
  PersonBookmarkDto,
  PersonBookmarkRow,
  TitleBookmarkDto,
  TitleBookmarkRow,
} from '../types/bookmark.js';
import { personUrl } from './person.mapper.js';
import { titleUrl } from './title.mapper.js';
import { userUrl } from './user.mapper.js';

// The rows do not say whose bookmark it is: every query already filters on one user,
// so the caller passes that user's id for the URL.
export function toTitleBookmarkDto(userId: number, row: TitleBookmarkRow): TitleBookmarkDto {
  return {
    url: `${userUrl(userId)}/bookmarks/titles/${row.tconst}`,
    title: { url: titleUrl(row.tconst), name: row.primarytitle },
  };
}

export function toPersonBookmarkDto(userId: number, row: PersonBookmarkRow): PersonBookmarkDto {
  return {
    url: `${userUrl(userId)}/bookmarks/people/${row.nconst}`,
    person: { url: personUrl(row.nconst), name: row.primaryname },
  };
}
