// Unit tests for the person mappers. No database needed (2-E.1).
import { describe, expect, test } from 'vitest';
import {
  toCoPlayerDto,
  toPersonDto,
  toPersonSummaryDto,
  toPersonWordDto,
} from '../src/mappers/person.mapper.js';

describe('toPersonSummaryDto', () => {
  test('renames the columns and adds the resource URL', () => {
    const result = toPersonSummaryDto({ nconst: 'nm0000136', primaryname: 'Johnny Depp' });
    expect(result).toEqual({
      url: '/api/people/nm0000136',
      id: 'nm0000136',
      name: 'Johnny Depp',
    });
  });
});

describe('toCoPlayerDto', () => {
  test('freq becomes sharedTitles', () => {
    const result = toCoPlayerDto({ nconst: 'nm0000163', primaryname: 'Dustin Hoffman', freq: 3 });
    expect(result).toEqual({
      url: '/api/people/nm0000163',
      id: 'nm0000163',
      name: 'Dustin Hoffman',
      sharedTitles: 3,
    });
  });
});

describe('toPersonWordDto', () => {
  test('freq becomes frequency, and the url searches titles for the word', () => {
    const result = toPersonWordDto({ word: 'depp', freq: 5 });
    expect(result).toEqual({
      url: '/api/titles?words=depp&match=any',
      word: 'depp',
      frequency: 5,
    });
  });

  test('encodes the word in the url, so & cannot break the query string', () => {
    const result = toPersonWordDto({ word: 'rock&roll', freq: 1 });
    expect(result.url).toBe('/api/titles?words=rock%26roll&match=any');
  });
});

describe('toPersonDto', () => {
  const person = {
    nconst: 'nm0000136',
    primaryname: 'Johnny Depp',
    birthyear: 1963,
    deathyear: null,
    rating: 8,
  };
  const professions = [{ name: 'actor' }, { name: 'director' }];
  const knownFor = [{ tconst: 'tt0325980', primarytitle: 'Pirates of the Caribbean' }];

  test('builds the person with camelCase fields, profession names and known-for links', () => {
    const result = toPersonDto(person, professions, knownFor);
    expect(result).toEqual({
      url: '/api/people/nm0000136',
      id: 'nm0000136',
      name: 'Johnny Depp',
      birthYear: 1963,
      deathYear: null,
      professions: ['actor', 'director'],
      rating: 8,
      knownFor: [{ url: '/api/titles/tt0325980', title: 'Pirates of the Caribbean' }],
    });
  });

  test('keeps a missing rating as null and empty lists as empty', () => {
    const result = toPersonDto({ ...person, rating: null }, [], []);
    expect(result.rating).toBeNull();
    expect(result.professions).toEqual([]);
    expect(result.knownFor).toEqual([]);
  });
});