// Routes for a user's ratings. Mounted at /api/users/:userId/ratings in user.routes.ts,
// behind authenticate and authorizeSelf.
import { Router } from 'express';
import {
  deleteUserRating,
  getUserRating,
  listUserRatings,
  putUserRating,
} from '../controllers/rating.controller.js';

// mergeParams lets the handlers read :userId from the path this router is mounted on.
export const ratingRouter = Router({ mergeParams: true });

ratingRouter.get('/', listUserRatings);
ratingRouter.get('/:titleId', getUserRating);
ratingRouter.put('/:titleId', putUserRating);
ratingRouter.delete('/:titleId', deleteUserRating);
