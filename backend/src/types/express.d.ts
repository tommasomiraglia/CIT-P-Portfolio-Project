// Adds req.user to Express's Request type (declaration merging: this interface is merged
// into the one @types/express defines). authenticate() sets it; it is undefined on
// requests that did not go through authenticate or were anonymous.
import type { AuthenticatedUser } from './user.js';

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthenticatedUser;
  }
}
