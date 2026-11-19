// Routes for a user's bookmarks. Mounted at /api/users/:userId/bookmarks in
// user.routes.ts, behind authenticate and authorizeSelf.
import { Router } from 'express';
import {
  deleteUserPersonBookmark,
  deleteUserTitleBookmark,
  getUserPersonBookmark,
  getUserTitleBookmark,
  listUserPersonBookmarks,
  listUserTitleBookmarks,
  putUserPersonBookmark,
  putUserTitleBookmark,
} from '../controllers/bookmark.controller.js';

// mergeParams lets the handlers read :userId from the path this router is mounted on.
export const bookmarkRouter = Router({ mergeParams: true });

bookmarkRouter.get('/titles', listUserTitleBookmarks);
bookmarkRouter.get('/titles/:titleId', getUserTitleBookmark);
bookmarkRouter.put('/titles/:titleId', putUserTitleBookmark);
bookmarkRouter.delete('/titles/:titleId', deleteUserTitleBookmark);

bookmarkRouter.get('/people', listUserPersonBookmarks);
bookmarkRouter.get('/people/:personId', getUserPersonBookmark);
bookmarkRouter.put('/people/:personId', putUserPersonBookmark);
bookmarkRouter.delete('/people/:personId', deleteUserPersonBookmark);
