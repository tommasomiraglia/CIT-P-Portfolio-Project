// Endpoint tests over HTTP. supertest starts the app on a temporary port for each
// request, so no server has to be started by hand (2-E.3).
// They run against the real database configured in backend/.env and only read from it.
import request from 'supertest';
import { afterAll, describe, expect, test } from 'vitest';
import { app } from '../src/app.js';
import { pool } from '../src/db/pool.js';

// The first title in the dataset ordered by id, a TV series with no missing values.
const EXISTING_TITLE_ID = 'tt0052520';
// Well-formed, but not in the dataset.
const MISSING_TITLE_ID = 'tt9999999';

// Without this, the open pool connections would keep the test process alive.
afterAll(() => pool.end());

describe('GET /api/health', () => {
  test('returns 200 when the database is reachable', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});

describe('GET /api/titles/:id', () => {
  test('returns 200 and the title for an existing id', async () => {
    const res = await request(app).get(`/api/titles/${EXISTING_TITLE_ID}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body).toEqual({
      url: `/api/titles/${EXISTING_TITLE_ID}`,
      id: EXISTING_TITLE_ID,
      title: 'The Twilight Zone',
      type: 'tvSeries',
      isAdult: false,
      startYear: 1959,
      endYear: 1964,
      runtimeMinutes: 50,
      plot: expect.any(String),
      posterUrl: expect.stringMatching(/^https:\/\//),
    });
  });

  test('returns 404 for an id that does not exist', async () => {
    const res = await request(app).get(`/api/titles/${MISSING_TITLE_ID}`);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { message: `Title ${MISSING_TITLE_ID} not found` } });
  });

  test('returns 400 for a malformed id', async () => {
    const res = await request(app).get(`/api/titles/${encodeURIComponent("1' OR '1'='1")}`);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: { message: expect.any(String) } });
  });
});

describe('unknown routes', () => {
  test('return 404 with a JSON error', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body).toEqual({ error: { message: 'No route for GET /api/does-not-exist' } });
  });
});

describe('malformed JSON body', () => {
  test('returns 400 with a JSON error, not a 500', async () => {
    const res = await request(app)
      .post('/api/titles')
      .set('Content-Type', 'application/json')
      .send('{ not json');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: { message: expect.any(String) } });
  });
});
