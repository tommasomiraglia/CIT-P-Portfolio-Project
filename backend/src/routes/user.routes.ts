// Routes for the user resource. Mounted at /api/users in routes/index.ts.
import { Router } from 'express';
import { createUser, getUserById } from '../controllers/user.controller.js';
import { authenticate, authorizeSelf } from '../middleware/auth.js';

export const userRouter = Router();

// Registration is the one /api/users route open to everyone.
userRouter.post('/', createUser);

// Everything under /api/users/:userId belongs to that user. Mounting the checks here
// protects every route added to ownUserRouter, so a new endpoint cannot forget them.
// mergeParams lets the routes below read :userId from the path above.
const ownUserRouter = Router({ mergeParams: true });
ownUserRouter.get('/', getUserById);

userRouter.use('/:userId', authenticate, authorizeSelf, ownUserRouter);
