//Anyone can search, a logged in search is saved to the history
// IMDB person ids: "nm" followed by 7 or 8 digits, for example nm0000136.
// Rejecting anything else early gives the client a clear 400 instead of a misleading 404.
import { Router } from 'express';
import {
  getPersonById,
  listCoPlayers,
  listPeople,
  listPersonWords,
} from '../controllers/person.controller.js';
import { authenticateOptional } from '../middleware/auth.js';

export const personRouter = Router();
personRouter.get('/', authenticateOptional, listPeople);
personRouter.get('/:id', getPersonById);
personRouter.get('/:id/co-players', listCoPlayers);
personRouter.get('/:id/words', listPersonWords);
