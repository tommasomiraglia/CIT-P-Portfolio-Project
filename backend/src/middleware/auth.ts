// Authentication (who is calling) and authorization (may they do this), as separate
// middlewares (2-D.6, docs/api-design.md 4.4). Routes chain them:
//   router.use('/:userId', authenticate, authorizeSelf, ownUserRouter)
import type { Request, RequestHandler } from 'express';
import { parseIntegerId } from '../lib/ids.js';
import { verifyToken } from '../lib/token.js';
import type { AuthenticatedUser } from '../types/user.js';
import { ForbiddenError, UnauthorizedError } from './errors.js';

// "Bearer" followed by the token, as the client sends it: Authorization: Bearer eyJhbGci...
const BEARER = /^Bearer +(\S+)$/i;

async function userFromHeader(header: string): Promise<AuthenticatedUser> {
  const token = BEARER.exec(header)?.[1];
  if (!token) {
    throw new UnauthorizedError('Authorization header must be "Bearer <token>"');
  }
  return { id: await verifyToken(token) };
}

// Requires a valid token. Express 5 passes errors thrown by async middleware to the
// error handler, which answers 401.
export const authenticate: RequestHandler = async (req, _res, next) => {
  const header = req.get('Authorization');
  if (header === undefined) {
    throw new UnauthorizedError('Log in first: this request needs an Authorization header');
  }
  req.user = await userFromHeader(header);
  next();
};

// For requests that work for everyone but do more for a logged-in user, such as a search
// that is saved to the history. A token that is sent must still be valid (4.4).
export const authenticateOptional: RequestHandler = async (req, _res, next) => {
  const header = req.get('Authorization');
  if (header !== undefined) {
    req.user = await userFromHeader(header);
  }
  next();
};

// Runs after authenticate on /api/users/:userId/...: a user may only reach their own data.
export const authorizeSelf: RequestHandler<{ userId: string }> = (req, _res, next) => {
  const userId = parseIntegerId('user id', req.params.userId);
  if (requireUser(req).id !== userId) {
    throw new ForbiddenError("You can only access your own user's data");
  }
  next();
};

// For controllers behind authenticate: the user is always set there, and failing loudly
// if a route forgot the middleware is better than treating the request as anonymous.
export function requireUser(req: Request): AuthenticatedUser {
  if (!req.user) {
    throw new UnauthorizedError('Log in first');
  }
  return req.user;
}
