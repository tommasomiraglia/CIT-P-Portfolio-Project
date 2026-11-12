// CORS policy over HTTP (2-D.7). supertest does not enforce CORS like a browser does,
// so these tests check the headers a browser would base its decision on.
import request from 'supertest';
import { afterAll, describe, expect, test } from 'vitest';
import { app } from '../src/app.js';
import { config } from '../src/config/index.js';
import { pool } from '../src/db/pool.js';

afterAll(() => pool.end());

// Read from the config, so the tests pass whatever CORS_ORIGINS a developer has in .env.
const allowedOrigin = config.corsOrigins[0] ?? '';
const otherOrigin = 'https://not-our-frontend.example';

describe('CORS', () => {
  test('allows the frontend origin to read a response', async () => {
    const res = await request(app).get('/api/titles/tt0052520').set('Origin', allowedOrigin);
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe(allowedOrigin);
    expect(res.headers['access-control-expose-headers']).toBe('Location');
    // Tells caches that the response differs per Origin, so one origin's answer is never
    // served to another.
    expect(res.headers.vary).toMatch(/Origin/);
  });

  test('gives no permission to any other origin', async () => {
    const res = await request(app).get('/api/titles/tt0052520').set('Origin', otherOrigin);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  test('answers a preflight request for an authenticated JSON call', async () => {
    const res = await request(app)
      .options('/api/users/7/ratings/tt0052520')
      .set('Origin', allowedOrigin)
      .set('Access-Control-Request-Method', 'PUT')
      .set('Access-Control-Request-Headers', 'authorization,content-type');
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe(allowedOrigin);
    expect(res.headers['access-control-allow-methods']).toBe('GET,POST,PUT,PATCH,DELETE');
    expect(res.headers['access-control-allow-headers']).toBe('Content-Type,Authorization');
    expect(res.headers['access-control-max-age']).toBe('3600');
  });

  test('also puts the headers on error responses, so the frontend can read the error', async () => {
    const res = await request(app).get('/api/does-not-exist').set('Origin', allowedOrigin);
    expect(res.status).toBe(404);
    expect(res.headers['access-control-allow-origin']).toBe(allowedOrigin);
    expect(res.body).toEqual({ error: { message: expect.any(String) } });
  });
});
