// HTTP handlers for the public genre catalogue.
import type { Request, Response } from 'express';
import { parseIntegerId } from '../lib/ids.js';
import { buildPage, parsePageRequest } from '../lib/paging.js';
import { getGenreById, getGenres } from '../services/genre.service.js';

export async function listGenres(req: Request, res: Response): Promise<void> {
  const pageRequest = parsePageRequest(req.query);
  const slice = await getGenres(pageRequest);
  res.json(buildPage(slice, pageRequest, req.originalUrl));
}

export async function getGenreByIdHandler(
  req: Request<{ genreId: string }>,
  res: Response,
): Promise<void> {
  res.json(await getGenreById(parseIntegerId('genre id', req.params.genreId)));
}
