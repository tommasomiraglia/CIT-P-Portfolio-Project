// HTTP handlers for /api/auth.
import type { Request, Response } from 'express';
import { readJsonObject, requireString } from '../lib/request-body.js';
import { login } from '../services/auth.service.js';

// POST /api/auth/login with { "username": "...", "password": "..." }.
export async function postLogin(req: Request, res: Response): Promise<void> {
  const body = readJsonObject(req.body);
  res.json(await login(requireString(body, 'username'), requireString(body, 'password')));
}
