// Unit tests for the row-to-DTO mapping of bookmarks. No database needed (2-E.1).
import { describe, expect, test } from 'vitest';
import { toPersonBookmarkDto, toTitleBookmarkDto } from '../src/mappers/bookmark.mapper.js';

describe('toTitleBookmarkDto', () => {
  test('gives the bookmark its own URL and links to the title', () => {
    const row = { tconst: 'tt0052520', primarytitle: 'The Twilight Zone' };
    expect(toTitleBookmarkDto(7, row)).toEqual({
      url: '/api/users/7/bookmarks/titles/tt0052520',
      title: { url: '/api/titles/tt0052520', name: 'The Twilight Zone' },
    });
  });
});

describe('toPersonBookmarkDto', () => {
  test('gives the bookmark its own URL and links to the person', () => {
    const row = { nconst: 'nm0000138', primaryname: 'Leonardo DiCaprio' };
    expect(toPersonBookmarkDto(7, row)).toEqual({
      url: '/api/users/7/bookmarks/people/nm0000138',
      person: { url: '/api/people/nm0000138', name: 'Leonardo DiCaprio' },
    });
  });

  test('sends only the fields of the representation, not the rest of a bigger row', () => {
    // addPersonBookmark passes the full person row it checked existence with.
    const row = {
      nconst: 'nm0000138',
      primaryname: 'Leonardo DiCaprio',
      birthyear: 1974,
      deathyear: null,
      rating: 7.5,
    };
    expect(Object.keys(toPersonBookmarkDto(7, row))).toEqual(['url', 'person']);
    expect(Object.keys(toPersonBookmarkDto(7, row).person)).toEqual(['url', 'name']);
  });
});
