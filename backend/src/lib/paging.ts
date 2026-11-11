// Paging for every list endpoint, following docs/api-design.md section 3.
// Pure functions with no database or Express access, so they can be unit-tested directly.
//
// A list request uses them in this order:
//   controller  parsePageRequest(req.query)                  validated page and pageSize, or a 400
//   repository  toLimitOffset(pageRequest)                   p_limit and p_offset for the SQL function
//   service     takePage(rows, pageRequest, toDto)           the items to send, and whether more exist
//   controller  buildPage(slice, pageRequest, req.originalUrl)  the JSON envelope with prev/next links
import { BadRequestError } from '../middleware/errors.js';
import type { Page, PageRequest, PageSlice } from '../types/page.js';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// p_limit and p_offset are INTEGER in PostgreSQL. A larger offset would make the query
// fail with a 500, so a page that far out is rejected with a 400 instead.
const MAX_SQL_INTEGER = 2_147_483_647;

// Digits only. Number() alone would also accept "", " 3", "1e2" and "0x10".
const DIGITS = /^\d+$/;

// Returns undefined when the parameter is missing, so the caller can apply its default.
// A repeated parameter (?page=1&page=2) arrives as an array and is rejected.
function parsePositiveInteger(name: string, value: unknown): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  const parsed = typeof value === 'string' && DIGITS.test(value) ? Number(value) : 0;
  if (parsed < 1) {
    throw new BadRequestError(
      `Invalid ${name} "${String(value)}": expected one integer of 1 or more`,
    );
  }
  return parsed;
}

// Reads ?page= and ?pageSize= from a parsed query string, such as Express's req.query.
export function parsePageRequest(query: Readonly<Record<string, unknown>>): PageRequest {
  const page = parsePositiveInteger('page', query.page) ?? 1;
  const requestedSize = parsePositiveInteger('pageSize', query.pageSize);
  // Above the maximum, 2-A.3 asks for the default, not the maximum (section 3.1).
  const pageSize =
    requestedSize === undefined || requestedSize > MAX_PAGE_SIZE
      ? DEFAULT_PAGE_SIZE
      : requestedSize;
  if ((page - 1) * pageSize > MAX_SQL_INTEGER) {
    throw new BadRequestError(`Invalid page "${page}": too large for page size ${pageSize}`);
  }
  return { page, pageSize };
}

// One row more than the page holds: if it comes back, there is a next page (section 3.3).
export function toLimitOffset({ page, pageSize }: PageRequest): { limit: number; offset: number } {
  return { limit: pageSize + 1, offset: (page - 1) * pageSize };
}

// Drops the extra row fetched by toLimitOffset and maps the rest to API objects.
export function takePage<Row, Item>(
  rows: readonly Row[],
  { pageSize }: PageRequest,
  toItem: (row: Row) => Item,
): PageSlice<Item> {
  return {
    items: rows.slice(0, pageSize).map((row) => toItem(row)),
    hasNext: rows.length > pageSize,
  };
}

// requestUrl is the path and query string of the current request (req.originalUrl),
// so the links keep every other query parameter, such as ?search=.
export function buildPage<T>(
  slice: PageSlice<T>,
  request: PageRequest,
  requestUrl: string,
): Page<T> {
  const { page, pageSize } = request;
  return {
    items: slice.items,
    page,
    pageSize,
    prev: page > 1 ? linkToPage(requestUrl, page - 1, pageSize) : null,
    next: slice.hasNext ? linkToPage(requestUrl, page + 1, pageSize) : null,
  };
}

// Links are relative to the server (section 2.1). URL needs a base to parse a relative
// path, but only the path and query string of the result are used, never the base.
function linkToPage(requestUrl: string, page: number, pageSize: number): string {
  const url = new URL(requestUrl, 'http://localhost');
  url.searchParams.set('page', String(page));
  url.searchParams.set('pageSize', String(pageSize));
  return `${url.pathname}${url.search}`;
}
