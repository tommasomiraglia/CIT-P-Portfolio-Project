// Routes for the user resource. Mounted at /api/users in routes/index.ts.
import { Router } from 'express';
import {
  createUser,
  deleteOwnGenre,
  deleteSearchHistory,
  deleteSearchHistoryEntry,
  getOwnGenre,
  getUserById,
  listOwnGenres,
  listSearchHistory,
  putOwnGenre,
} from '../controllers/user.controller.js';
import { authenticate, authorizeSelf } from '../middleware/auth.js';

export const userRouter = Router();

// Registration is the one /api/users route open to everyone.
userRouter.post('/', createUser);

// Everything under /api/users/:userId belongs to that user. Mounting the checks here
// protects every route added to ownUserRouter, so a new endpoint cannot forget them.
// mergeParams lets the routes below read :userId from the path above.
const ownUserRouter = Router({ mergeParams: true });
ownUserRouter.get('/', getUserById);
ownUserRouter.get('/search-history', listSearchHistory);
ownUserRouter.delete('/search-history', deleteSearchHistory);
ownUserRouter.delete('/search-history/:entryId', deleteSearchHistoryEntry);
ownUserRouter.get('/genres', listOwnGenres);
ownUserRouter.get('/genres/:genreId', getOwnGenre);
ownUserRouter.put('/genres/:genreId', putOwnGenre);
ownUserRouter.delete('/genres/:genreId', deleteOwnGenre);

userRouter.use('/:userId', authenticate, authorizeSelf, ownUserRouter);
