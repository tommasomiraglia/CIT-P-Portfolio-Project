// Unit tests for the row-to-DTO mapping of ratings. No database needed (2-E.1).
import { describe, expect, test } from 'vitest';
import { toRatingDto } from '../src/mappers/rating.mapper.js';

describe('toRatingDto', () => {
  test('gives the rating its own URL and links to the title', () => {
    const row = {
      tconst: 'tt0052520',
      primarytitle: 'The Twilight Zone',
      value: 9,
      comment: 'Still great.',
    };
    expect(toRatingDto(7, row)).toEqual({
      url: '/api/users/7/ratings/tt0052520',
      title: { url: '/api/titles/tt0052520', name: 'The Twilight Zone' },
      rating: 9,
      comment: 'Still great.',
    });
  });

  test('keeps a missing comment as null', () => {
    const row = { tconst: 'tt0052520', primarytitle: 'The Twilight Zone', value: 1, comment: null };
    expect(toRatingDto(7, row).comment).toBeNull();
  });
});
