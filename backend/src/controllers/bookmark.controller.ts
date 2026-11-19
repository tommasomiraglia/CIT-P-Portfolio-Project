// HTTP handlers for /api/users/:userId/bookmarks: validate the request, call the service,
// send the JSON. authenticate and authorizeSelf already ran, so :userId is valid and
// belongs to the caller.
import type { Request, Response } from 'express';
import { parseIntegerId, parsePersonId, parseTitleId } from '../lib/ids.js';
import { buildPage, parsePageRequest } from '../lib/paging.js';
import {
  addPersonBookmark,
  addTitleBookmark,
  getPersonBookmark,
  getTitleBookmark,
  listPersonBookmarks,
  listTitleBookmarks,
  removeOwnPersonBookmark,
  removeOwnTitleBookmark,
} from '../services/bookmark.service.js';

type UserParams = { userId: string };
type TitleBookmarkParams = { userId: string; titleId: string };
type PersonBookmarkParams = { userId: string; personId: string };

// GET /api/users/:userId/bookmarks/titles
export async function listUserTitleBookmarks(
  req: Request<UserParams>,
  res: Response,
): Promise<void> {
  const userId = parseIntegerId('user id', req.params.userId);
  const pageRequest = parsePageRequest(req.query);
  const slice = await listTitleBookmarks(userId, pageRequest);
  res.json(buildPage(slice, pageRequest, req.originalUrl));
}

// GET /api/users/:userId/bookmarks/titles/:titleId
export async function getUserTitleBookmark(
  req: Request<TitleBookmarkParams>,
  res: Response,
): Promise<void> {
  const userId = parseIntegerId('user id', req.params.userId);
  res.json(await getTitleBookmark(userId, parseTitleId(req.params.titleId)));
}

// PUT /api/users/:userId/bookmarks/titles/:titleId, with no body.
// 200 for a new bookmark too: the client chose the URI, so there is no new address to
// announce with 201 and a Location header (docs/api-design.md 1.6).
export async function putUserTitleBookmark(
  req: Request<TitleBookmarkParams>,
  res: Response,
): Promise<void> {
  const userId = parseIntegerId('user id', req.params.userId);
  res.json(await addTitleBookmark(userId, parseTitleId(req.params.titleId)));
}

// DELETE /api/users/:userId/bookmarks/titles/:titleId
export async function deleteUserTitleBookmark(
  req: Request<TitleBookmarkParams>,
  res: Response,
): Promise<void> {
  const userId = parseIntegerId('user id', req.params.userId);
  await removeOwnTitleBookmark(userId, parseTitleId(req.params.titleId));
  res.status(204).end();
}

// GET /api/users/:userId/bookmarks/people
export async function listUserPersonBookmarks(
  req: Request<UserParams>,
  res: Response,
): Promise<void> {
  const userId = parseIntegerId('user id', req.params.userId);
  const pageRequest = parsePageRequest(req.query);
  const slice = await listPersonBookmarks(userId, pageRequest);
  res.json(buildPage(slice, pageRequest, req.originalUrl));
}

// GET /api/users/:userId/bookmarks/people/:personId
export async function getUserPersonBookmark(
  req: Request<PersonBookmarkParams>,
  res: Response,
): Promise<void> {
  const userId = parseIntegerId('user id', req.params.userId);
  res.json(await getPersonBookmark(userId, parsePersonId(req.params.personId)));
}

// PUT /api/users/:userId/bookmarks/people/:personId, with no body. 200 as for titles.
export async function putUserPersonBookmark(
  req: Request<PersonBookmarkParams>,
  res: Response,
): Promise<void> {
  const userId = parseIntegerId('user id', req.params.userId);
  res.json(await addPersonBookmark(userId, parsePersonId(req.params.personId)));
}

// DELETE /api/users/:userId/bookmarks/people/:personId
export async function deleteUserPersonBookmark(
  req: Request<PersonBookmarkParams>,
  res: Response,
): Promise<void> {
  const userId = parseIntegerId('user id', req.params.userId);
  await removeOwnPersonBookmark(userId, parsePersonId(req.params.personId));
  res.status(204).end();
}
