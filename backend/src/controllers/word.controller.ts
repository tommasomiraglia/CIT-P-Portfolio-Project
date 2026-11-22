// HTTP handlers for /api/words: validate the request, call the service, send the JSON.
import type { Request, Response } from 'express';
import { buildPage, parsePageRequest } from '../lib/paging.js';
import { parseWords } from '../lib/words.js';
import { getRelatedWords } from '../services/word.service.js';

// GET /api/words?words=a,b (docs/api-design.md 1.17)
export async function listRelatedWords(req: Request, res: Response): Promise<void> {
  const words = parseWords(req.query.words);
  const pageRequest = parsePageRequest(req.query);
  const slice = await getRelatedWords(words, pageRequest);
  // originalUrl, not url: inside the router req.url has lost the /api/words prefix.
  res.json(buildPage(slice, pageRequest, req.originalUrl));
}
