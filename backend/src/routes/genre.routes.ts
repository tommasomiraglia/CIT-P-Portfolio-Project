// Routes for the read-only genre catalogue. Mounted at /api/genres.
import { Router } from 'express';
import { getGenreByIdHandler, listGenres } from '../controllers/genre.controller.js';

export const genreRouter = Router();

genreRouter.get('/', listGenres);
genreRouter.get('/:genreId', getGenreByIdHandler);
