// Routes for the title resource. Mounted at /api/titles in routes/index.ts.
import { Router } from 'express';
import { getTitleById } from '../controllers/title.controller.js';

export const titleRouter = Router();

titleRouter.get('/:id', getTitleById);
