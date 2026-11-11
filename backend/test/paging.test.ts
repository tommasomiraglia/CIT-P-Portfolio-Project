// Unit tests for the paging helper (docs/api-design.md section 3). No database needed.
import { describe, expect, test } from 'vitest';
import {
  buildPage,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  parsePageRequest,
  takePage,
  toLimitOffset,
} from '../src/lib/paging.js';
import { BadRequestError } from '../src/middleware/errors.js';

describe('parsePageRequest', () => {
  test('uses page 1 and the default size when both are missing', () => {
    expect(parsePageRequest({})).toEqual({ page: 1, pageSize: DEFAULT_PAGE_SIZE });
  });

  test('reads valid values', () => {
    expect(parsePageRequest({ page: '3', pageSize: '50' })).toEqual({ page: 3, pageSize: 50 });
  });

  test('accepts the maximum page size', () => {
    expect(parsePageRequest({ pageSize: String(MAX_PAGE_SIZE) }).pageSize).toBe(MAX_PAGE_SIZE);
  });

  test('applies the default, not the maximum, when the size is above the maximum', () => {
    expect(parsePageRequest({ pageSize: String(MAX_PAGE_SIZE + 1) }).pageSize).toBe(
      DEFAULT_PAGE_SIZE,
    );
    expect(parsePageRequest({ pageSize: '99999999999999999999' }).pageSize).toBe(DEFAULT_PAGE_SIZE);
  });

  test('ignores other query parameters', () => {
    expect(parsePageRequest({ search: 'star', page: '2' })).toEqual({
      page: 2,
      pageSize: DEFAULT_PAGE_SIZE,
    });
  });

  test.each([['0'], ['-1'], ['abc'], [''], [' 2'], ['1.5'], ['1e2'], ['0x10'], [['1', '2']]])(
    'rejects page %j with a 400',
    (page) => {
      expect(() => parsePageRequest({ page })).toThrow(BadRequestError);
      expect(() => parsePageRequest({ pageSize: page })).toThrow(BadRequestError);
    },
  );

  test('names the parameter and the value in the error message', () => {
    expect(() => parsePageRequest({ pageSize: 'abc' })).toThrow(
      'Invalid pageSize "abc": expected one integer of 1 or more',
    );
  });

  test('rejects a page whose offset does not fit in a PostgreSQL INTEGER', () => {
    // (107374183 - 1) * 20 = 2147483640 fits; one page more does not.
    expect(parsePageRequest({ page: '107374183' }).page).toBe(107374183);
    expect(() => parsePageRequest({ page: '107374184' })).toThrow(BadRequestError);
    expect(() => parsePageRequest({ page: '99999999999999999999' })).toThrow(BadRequestError);
  });
});

describe('toLimitOffset', () => {
  test('asks for one row more than the page size', () => {
    expect(toLimitOffset({ page: 1, pageSize: 20 })).toEqual({ limit: 21, offset: 0 });
  });

  test('skips the rows of the earlier pages', () => {
    expect(toLimitOffset({ page: 3, pageSize: 10 })).toEqual({ limit: 11, offset: 20 });
  });
});

describe('takePage', () => {
  const request = { page: 1, pageSize: 3 };
  const double = (row: number) => row * 2;

  test('drops the extra row and reports a next page', () => {
    expect(takePage([1, 2, 3, 4], request, double)).toEqual({ items: [2, 4, 6], hasNext: true });
  });

  test('reports no next page when exactly a full page comes back', () => {
    expect(takePage([1, 2, 3], request, double)).toEqual({ items: [2, 4, 6], hasNext: false });
  });

  test('handles a short and an empty page', () => {
    expect(takePage([1], request, double)).toEqual({ items: [2], hasNext: false });
    expect(takePage([], request, double)).toEqual({ items: [], hasNext: false });
  });

  test('passes only the row to the mapper', () => {
    // With a bare .map(toItem), parseInt would receive the index as its radix.
    expect(takePage(['10', '10'], { page: 1, pageSize: 2 }, Number.parseInt).items).toEqual([
      10, 10,
    ]);
  });
});

describe('buildPage', () => {
  test('matches the example envelope in the API design', () => {
    const page = buildPage(
      { items: ['a'], hasNext: true },
      { page: 2, pageSize: 20 },
      '/api/titles?search=zone&page=2',
    );
    expect(page).toEqual({
      items: ['a'],
      page: 2,
      pageSize: 20,
      prev: '/api/titles?search=zone&page=1&pageSize=20',
      next: '/api/titles?search=zone&page=3&pageSize=20',
    });
  });

  test('has no prev link on page 1 and no next link on the last page', () => {
    const page = buildPage({ items: ['a'], hasNext: false }, { page: 1, pageSize: 20 }, '/api/x');
    expect(page.prev).toBeNull();
    expect(page.next).toBeNull();
  });

  test('links a page past the end back to the page before it', () => {
    const page = buildPage(
      { items: [], hasNext: false },
      { page: 9, pageSize: 5 },
      '/api/x?page=9',
    );
    expect(page).toEqual({
      items: [],
      page: 9,
      pageSize: 5,
      prev: '/api/x?page=8&pageSize=5',
      next: null,
    });
  });

  test('puts the page size actually used in the links, not the requested one', () => {
    const page = buildPage(
      { items: [], hasNext: true },
      { page: 1, pageSize: DEFAULT_PAGE_SIZE },
      '/api/x?pageSize=500',
    );
    expect(page.next).toBe(`/api/x?pageSize=${DEFAULT_PAGE_SIZE}&page=2`);
  });

  test('keeps every other query parameter, still encoded', () => {
    const page = buildPage(
      { items: [], hasNext: true },
      { page: 1, pageSize: 20 },
      '/api/titles?title=star%20wars&plot=space&names=a%26b',
    );
    const next = new URL(page.next ?? '', 'http://localhost');
    expect(next.pathname).toBe('/api/titles');
    expect(Object.fromEntries(next.searchParams)).toEqual({
      title: 'star wars',
      plot: 'space',
      names: 'a&b',
      page: '2',
      pageSize: '20',
    });
  });
});
