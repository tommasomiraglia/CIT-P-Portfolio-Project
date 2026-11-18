// HTTP handlers for /api/people: validate the request, call the service, send the json

import type { Request, Response } from 'express';
import { buildPage, parsePageRequest } from '../lib/paging.js';
import { BadRequestError } from '../middleware/errors.js';
import {
  getCoPlayers,
  getPerson,
  getPersonWords,
  searchPeople,
} from '../services/person.service.js';

// Bounds the work of one name: the text is matched against every person name.
const MAX_SEARCH_LENGTH = 200;

// IMDB person ids: "nm" followed by 7 or 8 digits, for example nm0000136.
// Rejecting anything else early gives the client a clear 400 instead of a misleading 404.
const PERSON_ID_PATTERN = /^nm\d{7,8}$/;

// The :id of every /api/people/:id route.
function parsePersonId(id: string): string {
  if (!PERSON_ID_PATTERN.test(id)) {
    throw new BadRequestError(`Invalid person id "${id}": expected "nm" followed by 7 or 8 digits`);
  }
  return id;
}

// GET /api/people/:id
export async function getPersonById(req: Request<{ id: string }>, res: Response): Promise<void> {
  const id = parsePersonId(req.params.id);
  res.json(await getPerson(id));
}

// GET /api/people?name=... (docs/api-design.md 1.8).
function parseName(query: Readonly<Record<string, unknown>>): string {
  const value = query.name;
  if (value === undefined) {
    throw new BadRequestError('Searching people needs a "name" query parameter');
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

// GET /api/people/:id/co-players
export async function listCoPlayers(req: Request<{ id: string }>, res: Response): Promise<void> {
  const id = parsePersonId(req.params.id);
  const pageRequest = parsePageRequest(req.query);
  const slice = await getCoPlayers(id, pageRequest);
  res.json(buildPage(slice, pageRequest, req.originalUrl));
}

// GET /api/people/:id/words
export async function listPersonWords(req: Request<{ id: string }>, res: Response): Promise<void> {
  const id = parsePersonId(req.params.id);
  const pageRequest = parsePageRequest(req.query);
  const slice = await getPersonWords(id, pageRequest);
  res.json(buildPage(slice, pageRequest, req.originalUrl));
}
