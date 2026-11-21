// Routes for the word index. Mounted at /api/words in routes/index.ts.
import { Router } from 'express';
import { listRelatedWords } from '../controllers/word.controller.js';

export const wordRouter = Router();

wordRouter.get('/', listRelatedWords);
