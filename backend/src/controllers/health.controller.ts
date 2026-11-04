// HTTP handler for /api/health, used to check that the API and its database are up.
import type { Request, Response } from 'express';
import { checkHealth } from '../services/health.service.js';

export async function getHealth(_req: Request, res: Response): Promise<void> {
  await checkHealth();
  res.json({ status: 'ok' });
}
