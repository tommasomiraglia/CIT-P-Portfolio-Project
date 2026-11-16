//Anyone can search, a logged in search is saved to the history

import { Router } from 'express';
import { listPeople } from '../controllers/person.controller.js';
import { authenticateOptional } from '../middleware/auth.js';

export const personRouter = Router();

personRouter.get('/', authenticateOptional, listPeople);

