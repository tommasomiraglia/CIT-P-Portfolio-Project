import type { Request, Response } from 'express';
import { buildPage, parsePageRequest } from '../lib/paging.js';
import { BadRequestError } from '../middleware/errors.js';
import { searchPeople } from '../services/person.service.js';


// Bounds the work of one name: the text is matched against every person name.
const MAX_SEARCH_LENGTH = 200;

function parseName(query: Readonly<Record<string, unknown>>): string {
  const value = query.name;
  if (value === undefined) {
    throw new BadRequestError('Searching titles needs a "search" query parameter');
  }
  const name = typeof value === 'string' ? value.trim() : '';
  if (name === '' || name.length > MAX_SEARCH_LENGTH) {
    throw new BadRequestError(
      `"name" must be given once, with 1 to ${MAX_SEARCH_LENGTH} characters`,
    );
  }
  return name;
}

export async function listPeople(req: Request, res: Response): Promise<void> {
  const name = parseName(req.query);
  const pageRequest = parsePageRequest(req.query);
  const slice = await searchPeople(name, pageRequest, req.user?.id);
  // originalUrl, not url: inside the router req.url has lost the /api/people prefix.
  res.json(buildPage(slice, pageRequest, req.originalUrl));
}