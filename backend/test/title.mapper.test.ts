// Unit tests for the row-to-DTO mapping. No database needed (2-E.1).
import { describe, expect, test } from 'vitest';
import { toTitleDto } from '../src/mappers/title.mapper.js';
import type { TitleRow } from '../src/types/title.js';

const row: TitleRow = {
  tconst: 'tt0052520',
  primarytitle: 'The Twilight Zone',
  titletype: 'tvSeries',
  isadult: false,
  startyear: 1959,
  endyear: 1964,
  runtimeminutes: 50,
  plot: 'A plot.',
  poster_link: 'https://example.com/poster.jpg',
};

describe('toTitleDto', () => {
  test('renames columns to camelCase and adds the resource URL', () => {
    expect(toTitleDto(row)).toEqual({
      url: '/api/titles/tt0052520',
      id: 'tt0052520',
      title: 'The Twilight Zone',
      type: 'tvSeries',
      isAdult: false,
      startYear: 1959,
      endYear: 1964,
      runtimeMinutes: 50,
      plot: 'A plot.',
      posterUrl: 'https://example.com/poster.jpg',
    });
  });

  test('turns the "N/A" and empty-string placeholders into null', () => {
    const dto = toTitleDto({ ...row, plot: 'N/A', poster_link: '' });
    expect(dto.plot).toBeNull();
    expect(dto.posterUrl).toBeNull();
  });

  test('keeps null as null', () => {
    const dto = toTitleDto({ ...row, plot: null, poster_link: null, endyear: null });
    expect(dto.plot).toBeNull();
    expect(dto.posterUrl).toBeNull();
    expect(dto.endYear).toBeNull();
  });
});
