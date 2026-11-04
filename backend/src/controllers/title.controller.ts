// HTTP handlers for /api/titles: validate the request, call the service, send the JSON.
import type { Request, Response } from 'express';
import { BadRequestError } from '../middleware/errors.js';
import { getTitle } from '../services/title.service.js';

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
