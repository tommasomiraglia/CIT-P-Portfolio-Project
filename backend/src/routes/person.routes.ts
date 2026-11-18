// Routes for the person resource. Mounted at /api/people in routes/index.ts.
import { Router } from 'express';
import {
  getPersonById,
  listCoPlayers,
  listPeople,
  listPersonWords,
} from '../controllers/person.controller.js';
import { authenticateOptional } from '../middleware/auth.js';

export const personRouter = Router();

// Anyone can search; a logged-in search is also saved to the user's history.
personRouter.get('/', authenticateOptional, listPeople);
personRouter.get('/:id', getPersonById);
personRouter.get('/:id/co-players', listCoPlayers);
personRouter.get('/:id/words', listPersonWords);
