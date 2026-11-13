// Routes for the title resource. Mounted at /api/titles in routes/index.ts.
import { Router } from 'express';
import { getTitleById, listTitles } from '../controllers/title.controller.js';
import { authenticateOptional } from '../middleware/auth.js';

export const titleRouter = Router();

// Anyone can search; a logged-in search is also saved to the user's history.
titleRouter.get('/', authenticateOptional, listTitles);
titleRouter.get('/:id', getTitleById);
