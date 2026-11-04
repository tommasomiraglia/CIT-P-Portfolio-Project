// All API routes, mounted at /api in app.ts. Each resource gets its own router,
// so the URL structure mirrors the resource model (2-D.2).
import { Router } from 'express';
import { getHealth } from '../controllers/health.controller.js';
import { titleRouter } from './title.routes.js';

export const apiRouter = Router();

apiRouter.get('/health', getHealth);
apiRouter.use('/titles', titleRouter);
