// HTTP handlers for /api/titles: validate the request, call the service, send the JSON.
import type { Request, Response } from 'express';
import { parseTitleId } from '../lib/ids.js';
import { buildPage, parsePageRequest } from '../lib/paging.js';
import { parseWords } from '../lib/words.js';
import { BadRequestError } from '../middleware/errors.js';
import {
  getPopularActors,
  getSimilarTitles,
  getTitle,
  searchTitles,
  searchTitlesByStructuredFields,
  searchTitlesByWords,
} from '../services/title.service.js';
import type { PageRequest, PageSlice } from '../types/page.js';
import type { TitleFieldSearch, TitleSummaryDto, WordMatch } from '../types/title.js';

// Express 5 catches errors thrown by async handlers and passes them to the error
// handler, so there is no try/catch here.
export async function getTitleById(req: Request<{ id: string }>, res: Response): Promise<void> {
  res.json(await getTitle(parseTitleId(req.params.id)));
}

// Bounds the work of one search: the text is matched against every title and plot.
const MAX_SEARCH_LENGTH = 200;

type Query = Readonly<Record<string, unknown>>;

// GET /api/titles is one collection with three ways to search it, each with its own query
// parameters (docs/api-design.md 1.5). A request uses exactly one of them.
const FIELD_PARAMETERS = ['title', 'plot', 'characters', 'names'] as const;
const WORD_PARAMETERS = ['words', 'match'] as const;
const WORD_MATCHES: readonly WordMatch[] = ['exact', 'any', 'ranked'];

type SearchKind = 'text' | 'fields' | 'words';

// Decided by which parameters are present, before any of them is validated: a request
// that mixes two kinds is ambiguous whatever the values are.
function parseSearchKind(query: Query): SearchKind {
  const kinds: SearchKind[] = [];
  if (query.search !== undefined) {
    kinds.push('text');
  }
  if (FIELD_PARAMETERS.some((name) => query[name] !== undefined)) {
    kinds.push('fields');
  }
  if (WORD_PARAMETERS.some((name) => query[name] !== undefined)) {
    kinds.push('words');
  }
  const [kind, ...others] = kinds;
  if (kind === undefined) {
    throw new BadRequestError(
      'Searching titles needs "search", or at least one of "title", "plot", "characters" ' +
        'and "names", or "words"',
    );
  }
  if (others.length > 0) {
    throw new BadRequestError(
      'Use one kind of search per request: "search", or the fields "title", "plot", ' +
        '"characters" and "names", or "words" with "match"',
    );
  }
  return kind;
}

// GET /api/titles?search=... (docs/api-design.md 1.7)
function parseSearch(query: Query): string {
  const value = query.search;
  const search = typeof value === 'string' ? value.trim() : '';
  if (search === '' || search.length > MAX_SEARCH_LENGTH) {
    throw new BadRequestError(
      `"search" must be given once, with 1 to ${MAX_SEARCH_LENGTH} characters`,
    );
  }
  return search;
}

// One field of the structured search. A search form sends every field, the unused ones
// empty (?title=batman&plot=&characters=&names=), so an empty field means "not given".
function parseField(query: Query, name: (typeof FIELD_PARAMETERS)[number]): string | null {
  const value = query[name];
  if (value === undefined) {
    return null;
  }
  const text = typeof value === 'string' ? value.trim() : undefined;
  if (text === undefined || text.length > MAX_SEARCH_LENGTH) {
    throw new BadRequestError(
      `"${name}" must be given once, with at most ${MAX_SEARCH_LENGTH} characters`,
    );
  }
  return text === '' ? null : text;
}

// GET /api/titles?title=...&plot=...&characters=...&names=... (docs/api-design.md 1.16)
function parseFieldSearch(query: Query): TitleFieldSearch {
  const fields: TitleFieldSearch = {
    title: parseField(query, 'title'),
    plot: parseField(query, 'plot'),
    characters: parseField(query, 'characters'),
    names: parseField(query, 'names'),
  };
  // Without this check the database function would return nothing, and the client could
  // not tell an empty form from a search that found no title.
  if (Object.values(fields).every((text) => text === null)) {
    throw new BadRequestError(
      'Give text for at least one of "title", "plot", "characters" and "names"',
    );
  }
  return fields;
}

// Ranked is the default: it puts the titles that are most about the words first.
function parseMatch(query: Query): WordMatch {
  const value = query.match;
  if (value === undefined) {
    return 'ranked';
  }
  const match = WORD_MATCHES.find((known) => known === value);
  if (match === undefined) {
    throw new BadRequestError('"match" must be "exact", "any" or "ranked"');
  }
  return match;
}

function runSearch(req: Request, pageRequest: PageRequest): Promise<PageSlice<TitleSummaryDto>> {
  switch (parseSearchKind(req.query)) {
    case 'text':
      return searchTitles(parseSearch(req.query), pageRequest, req.user?.id);
    case 'fields':
      return searchTitlesByStructuredFields(parseFieldSearch(req.query), pageRequest, req.user?.id);
    case 'words':
      // GET /api/titles?words=a,b&match=exact|any|ranked (docs/api-design.md 1.17)
      return searchTitlesByWords(parseWords(req.query.words), parseMatch(req.query), pageRequest);
  }
}

export async function listTitles(req: Request, res: Response): Promise<void> {
  const pageRequest = parsePageRequest(req.query);
  const slice = await runSearch(req, pageRequest);
  // originalUrl, not url: inside the router req.url has lost the /api/titles prefix.
  res.json(buildPage(slice, pageRequest, req.originalUrl));
}

export async function listSimilarTitles(
  req: Request<{ id: string }>,
  res: Response,
): Promise<void> {
  const id = parseTitleId(req.params.id);
  const pageRequest = parsePageRequest(req.query);
  const slice = await getSimilarTitles(id, pageRequest);
  res.json(buildPage(slice, pageRequest, req.originalUrl));
}
// GET /api/titles/:id/actors
export async function listPopularActors(
  req: Request<{ id: string }>,
  res: Response,
): Promise<void> {
  const id = parseTitleId(req.params.id);
  const pageRequest = parsePageRequest(req.query);
  const slice = await getPopularActors(id, pageRequest);
  res.json(buildPage(slice, pageRequest, req.originalUrl));
}
