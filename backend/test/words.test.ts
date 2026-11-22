// Unit tests for the ?words= parser (docs/api-design.md 1.17) and the word mapper.
// No database needed (2-E.1).
import { describe, expect, test } from 'vitest';
import { MAX_WORD_LENGTH, MAX_WORDS, parseWords } from '../src/lib/words.js';
import { toRankedTitleDto, toWordMatchTitleDto } from '../src/mappers/title.mapper.js';
import { toWordDto } from '../src/mappers/word.mapper.js';
import { BadRequestError } from '../src/middleware/errors.js';

describe('parseWords', () => {
  test('splits on commas and trims each word', () => {
    expect(parseWords('twilight, zone ,serling')).toEqual(['twilight', 'zone', 'serling']);
  });

  test('lowers the letters A to Z, as the word index does', () => {
    expect(parseWords('Twilight,ZONE')).toEqual(['twilight', 'zone']);
  });

  test('keeps other capital letters, which the index did not lower', () => {
    expect(parseWords('Élisabeth')).toEqual(['Élisabeth']);
  });

  test('drops empty items and repeated words', () => {
    expect(parseWords('zone,,Zone, ,twilight,zone')).toEqual(['zone', 'twilight']);
  });

  test('accepts the largest allowed list and the longest allowed word', () => {
    const words = Array.from({ length: MAX_WORDS }, (_, index) => `word${index}`);
    expect(parseWords(words.join(','))).toEqual(words);
    expect(parseWords('x'.repeat(MAX_WORD_LENGTH))).toHaveLength(1);
  });

  test.each([
    ['a missing parameter', undefined],
    ['an empty parameter', ''],
    ['only commas and spaces', ' , ,'],
    ['a repeated parameter', ['twilight', 'zone']],
    ['a word with a space in it', 'twilight zone'],
    ['a word that is too long', 'x'.repeat(MAX_WORD_LENGTH + 1)],
    [
      'too many words',
      Array.from({ length: MAX_WORDS + 1 }, (_, index) => `word${index}`).join(','),
    ],
  ])('rejects %s', (_case, value) => {
    expect(() => parseWords(value)).toThrow(BadRequestError);
  });
});

describe('toWordDto', () => {
  test('freq becomes frequency, and the url searches titles for the word', () => {
    expect(toWordDto({ word: 'zone', freq: 12 })).toEqual({
      url: '/api/titles?words=zone&match=any',
      word: 'zone',
      frequency: 12,
    });
  });

  test('encodes the word in the url', () => {
    expect(toWordDto({ word: 'rosario,', freq: 1 }).url).toBe(
      '/api/titles?words=rosario%2C&match=any',
    );
  });
});

describe('the mappers of the word searches', () => {
  const row = { tconst: 'tt0052520', primarytitle: 'The Twilight Zone', rank: 2 };
  const summary = { url: '/api/titles/tt0052520', id: 'tt0052520', title: 'The Twilight Zone' };

  test('match=any: rank becomes matchedWords', () => {
    expect(toWordMatchTitleDto(row)).toEqual({ ...summary, matchedWords: 2 });
  });

  test('match=ranked: rank becomes relevance', () => {
    expect(toRankedTitleDto({ ...row, rank: 29.4 })).toEqual({ ...summary, relevance: 29.4 });
  });
});
