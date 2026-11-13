// HTTP handlers for /api/titles: validate the request, call the service, send the JSON.
import type { Request, Response } from 'express';
import { buildPage, parsePageRequest } from '../lib/paging.js';
import { BadRequestError } from '../middleware/errors.js';
import { getTitle, searchTitles } from '../services/title.service.js';

// IMDB title ids: "tt" followed by 7 or 8 digits, for example tt0052520.
// Rejecting anything else early gives the client a clear 400 instead of a misleading 404.
const TITLE_ID_PATTERN = /^tt\d{7,8}$/;

// Express 5 catches errors thrown by async handlers and passes them to the error
// handler, so there is no try/catch here.
export async function getTitleById(req: Request<{ id: string }>, res: Response): Promise<void> {
  const { id } = req.params;
  if (!TITLE_ID_PATTERN.test(id)) {
    throw new BadRequestError(`Invalid title id "${id}": expected "tt" followed by 7 or 8 digits`);
  }
  res.json(await getTitle(id));
}

// Bounds the work of one search: the text is matched against every title and plot.
const MAX_SEARCH_LENGTH = 200;

// GET /api/titles?search=... The other ways to search titles (structured fields, words)
// will be more query parameters on the same collection (docs/api-design.md 1.5).
function parseSearch(query: Readonly<Record<string, unknown>>): string {
  const value = query.search;
  if (value === undefined) {
    throw new BadRequestError('Searching titles needs a "search" query parameter');
  }
  const search = typeof value === 'string' ? value.trim() : '';
  if (search === '' || search.length > MAX_SEARCH_LENGTH) {
    throw new BadRequestError(
      `"search" must be given once, with 1 to ${MAX_SEARCH_LENGTH} characters`,
    );
  }
  return search;
}

export async function listTitles(req: Request, res: Response): Promise<void> {
  const search = parseSearch(req.query);
  const pageRequest = parsePageRequest(req.query);
  const slice = await searchTitles(search, pageRequest, req.user?.id);
  // originalUrl, not url: inside the router req.url has lost the /api/titles prefix.
  res.json(buildPage(slice, pageRequest, req.originalUrl));
}
