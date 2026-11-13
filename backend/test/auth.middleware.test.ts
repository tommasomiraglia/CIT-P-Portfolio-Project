// authenticateOptional has no real route yet (the searches that save history will use it),
// so it is tested on a small app built only for this test. No database needed.
import express from 'express';
import request from 'supertest';
import { describe, expect, test } from 'vitest';
import { signToken } from '../src/lib/token.js';
import { authenticateOptional } from '../src/middleware/auth.js';
import { errorHandler } from '../src/middleware/error-handler.js';

const app = express();
app.get('/whoami', authenticateOptional, (req, res) => {
  res.json({ user: req.user ?? null });
});
app.use(errorHandler);

describe('authenticateOptional', () => {
  test('lets an anonymous request through without a user', async () => {
    const res = await request(app).get('/whoami');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ user: null });
  });

  test('sets the user when a valid token is sent', async () => {
    const res = await request(app)
      .get('/whoami')
      .set('Authorization', `Bearer ${await signToken(7)}`);
    expect(res.body).toEqual({ user: { id: 7 } });
  });

  test('still rejects a token that is sent but invalid', async () => {
    const res = await request(app).get('/whoami').set('Authorization', 'Bearer not.a.token');
    expect(res.status).toBe(401);
  });
});
