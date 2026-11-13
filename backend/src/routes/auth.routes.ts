// Routes for logging in. Mounted at /api/auth in routes/index.ts.
import { Router } from 'express';
import { postLogin } from '../controllers/auth.controller.js';

export const authRouter = Router();

authRouter.post('/login', postLogin);
