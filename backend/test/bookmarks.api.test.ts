// The bookmark endpoints under /api/users/:userId/bookmarks over HTTP (2-E.3).
// Titles and people follow the same rules, so every test runs once for each.
// The bookmarks are deleted with their users (ON DELETE CASCADE), and afterAll checks that
// none is left.
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { app } from '../src/app.js';
import { pool } from '../src/db/pool.js';
import { type TestUser, TestUsers } from './helpers/test-users.js';

const users = new TestUsers('bookmarks');
const createdIds: number[] = [];

async function createUser(): Promise<TestUser> {
  const user = await users.create();
  createdIds.push(user.id);
  return user;
}

afterAll(async () => {
  await users.cleanUp();
  const { rows } = await pool.query<{ left: number }>(
    `SELECT (SELECT count(*) FROM bookmarking_title WHERE userid = ANY($1))
          + (SELECT count(*) FROM bookmarking_person WHERE userid = ANY($1)) AS left`,
    [createdIds],
  );
  await pool.end();
  expect(Number(rows[0]?.left)).toBe(0);
});

interface Kind {
  // The path segment after /bookmarks/.
  collection: 'titles' | 'people';
  // The field of the bookmark that references the title or person.
  field: 'title' | 'person';
  resourcePath: string;
  // Two existing ids, and their names. otherId sorts before id, so a list starts with it.
  id: string;
  name: string;
  otherId: string;
  otherName: string;
  // A valid id that nothing has, and an id of the wrong kind.
  unknownId: string;
  invalidId: string;
  notFound: string;
  notBookmarked: string;
  invalid: string;
}

const kinds: Kind[] = [
  {
    collection: 'titles',
    field: 'title',
    resourcePath: '/api/titles',
    id: 'tt0052520',
    name: 'The Twilight Zone',
    otherId: 'tt0903747',
    otherName: 'Breaking Bad',
    unknownId: 'tt9999999',
    invalidId: 'nm0000138',
    notFound: 'Title tt9999999 not found',
    notBookmarked: 'You have not bookmarked title tt0052520',
    invalid: 'Invalid title id "nm0000138"',
  },
  {
    collection: 'people',
    field: 'person',
    resourcePath: '/api/people',
    id: 'nm0000138',
    name: 'Leonardo DiCaprio',
    otherId: 'nm0000136',
    otherName: 'Johnny Depp',
    unknownId: 'nm9999999',
    invalidId: 'tt0052520',
    notFound: 'Person nm9999999 not found',
    notBookmarked: 'You have not bookmarked person nm0000138',
    invalid: 'Invalid person id "tt0052520"',
  },
];

describe.each(kinds)('bookmarks of $collection', (kind) => {
  const bookmarksPath = (user: TestUser, id = '') =>
    `/api/users/${user.id}/bookmarks/${kind.collection}${id === '' ? '' : `/${id}`}`;

  const putBookmark = (user: TestUser, id: string) =>
    request(app).put(bookmarksPath(user, id)).set('Authorization', user.authorization);

  const getBookmark = (user: TestUser, id: string) =>
    request(app).get(bookmarksPath(user, id)).set('Authorization', user.authorization);

  const deleteBookmark = (user: TestUser, id: string) =>
    request(app).delete(bookmarksPath(user, id)).set('Authorization', user.authorization);

  const listBookmarks = (user: TestUser, query = '') =>
    request(app)
      .get(`${bookmarksPath(user)}${query}`)
      .set('Authorization', user.authorization);

  // The bookmark as the API should send it.
  const bookmarkOf = (user: TestUser, id: string, name: string) => ({
    url: bookmarksPath(user, id),
    [kind.field]: { url: `${kind.resourcePath}/${id}`, name },
  });

  describe('PUT', () => {
    test('bookmarks it and answers 200 with the bookmark', async () => {
      const user = await createUser();
      const res = await putBookmark(user, kind.id);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(bookmarkOf(user, kind.id, kind.name));
      expect((await getBookmark(user, kind.id)).body).toEqual(res.body);
    });

    test('answers 200 again when it is already bookmarked, and keeps one bookmark', async () => {
      const user = await createUser();
      const first = await putBookmark(user, kind.id);
      const second = await putBookmark(user, kind.id);
      expect(second.status).toBe(200);
      expect(second.body).toEqual(first.body);
      expect((await listBookmarks(user)).body.items).toEqual([first.body]);
    });

    test('answers 400 for an id of the wrong kind', async () => {
      const user = await createUser();
      const res = await putBookmark(user, kind.invalidId);
      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain(kind.invalid);
    });

    test('answers 404 for an id nothing has, and bookmarks nothing', async () => {
      const user = await createUser();
      const res = await putBookmark(user, kind.unknownId);
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: { message: kind.notFound } });
      expect((await listBookmarks(user)).body.items).toEqual([]);
    });
  });

  describe('GET one', () => {
    test('answers 200 with my bookmark', async () => {
      const user = await createUser();
      await putBookmark(user, kind.id);
      const res = await getBookmark(user, kind.id);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(bookmarkOf(user, kind.id, kind.name));
    });

    test('answers 404 when I have not bookmarked it, even if someone else has', async () => {
      const user = await createUser();
      const someoneElse = await createUser();
      await putBookmark(someoneElse, kind.id);
      const res = await getBookmark(user, kind.id);
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: { message: kind.notBookmarked } });
    });

    test('answers 400 for an id of the wrong kind', async () => {
      const user = await createUser();
      const res = await getBookmark(user, kind.invalidId);
      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain(kind.invalid);
    });
  });

  describe('DELETE', () => {
    test('answers 204 with no body, and the bookmark is gone', async () => {
      const user = await createUser();
      await putBookmark(user, kind.id);
      const res = await deleteBookmark(user, kind.id);
      expect(res.status).toBe(204);
      expect(res.text).toBe('');
      expect((await getBookmark(user, kind.id)).status).toBe(404);
    });

    test('answers 404 when there is no bookmark to remove', async () => {
      const user = await createUser();
      await putBookmark(user, kind.id);
      await deleteBookmark(user, kind.id);
      const res = await deleteBookmark(user, kind.id);
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: { message: kind.notBookmarked } });
    });

    test('answers 400 for an id of the wrong kind', async () => {
      const user = await createUser();
      const res = await deleteBookmark(user, kind.invalidId);
      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain(kind.invalid);
    });
  });

  describe('GET the list', () => {
    test('answers an empty page for a user without bookmarks', async () => {
      const user = await createUser();
      const res = await listBookmarks(user);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ items: [], page: 1, pageSize: 20, prev: null, next: null });
    });

    test('lists only my own bookmarks, ordered by name, page by page', async () => {
      const user = await createUser();
      const someoneElse = await createUser();
      await putBookmark(user, kind.id);
      await putBookmark(user, kind.otherId);
      await putBookmark(someoneElse, kind.id);

      const firstPage = await listBookmarks(user, '?pageSize=1');
      expect(firstPage.status).toBe(200);
      expect(firstPage.body).toEqual({
        items: [bookmarkOf(user, kind.otherId, kind.otherName)],
        page: 1,
        pageSize: 1,
        prev: null,
        next: `${bookmarksPath(user)}?pageSize=1&page=2`,
      });

      const secondPage = await request(app)
        .get(firstPage.body.next)
        .set('Authorization', user.authorization);
      expect(secondPage.status).toBe(200);
      expect(secondPage.body).toEqual({
        items: [bookmarkOf(user, kind.id, kind.name)],
        page: 2,
        pageSize: 1,
        prev: `${bookmarksPath(user)}?pageSize=1&page=1`,
        next: null,
      });
    });

    test('answers 400 for an invalid page', async () => {
      const user = await createUser();
      expect((await listBookmarks(user, '?page=0')).status).toBe(400);
    });
  });

  describe('who may use the endpoints', () => {
    let owner: TestUser;
    let intruder: TestUser;

    beforeAll(async () => {
      owner = await createUser();
      intruder = await createUser();
      await putBookmark(owner, kind.id);
    });

    // Every route of the resource, as [method, path of the owner's data]. The PUT and
    // DELETE use the id the owner has bookmarked, so a wrongly allowed one would show.
    const routes = (): ['get' | 'put' | 'delete', string][] => [
      ['get', bookmarksPath(owner)],
      ['get', bookmarksPath(owner, kind.id)],
      ['put', bookmarksPath(owner, kind.otherId)],
      ['delete', bookmarksPath(owner, kind.id)],
    ];

    test('answers 401 without a token on every route', async () => {
      for (const [method, path] of routes()) {
        const res = await request(app)[method](path);
        expect(res.status, `${method} ${path}`).toBe(401);
        expect(res.headers['www-authenticate']).toBe('Bearer');
      }
    });

    test("answers 403 for another user's bookmarks on every route, and changes nothing", async () => {
      for (const [method, path] of routes()) {
        const res = await request(app)[method](path).set('Authorization', intruder.authorization);
        expect(res.status, `${method} ${path}`).toBe(403);
      }
      expect((await listBookmarks(owner)).body.items).toEqual([
        bookmarkOf(owner, kind.id, kind.name),
      ]);
      expect((await listBookmarks(intruder)).body.items).toEqual([]);
    });

    test('answers 401 on every route when the user was deleted after logging in', async () => {
      const gone = await createUser();
      await putBookmark(gone, kind.id);
      await pool.query('DELETE FROM app_user WHERE userid = $1', [gone.id]);
      const answers = {
        'GET list': await listBookmarks(gone),
        'GET one': await getBookmark(gone, kind.id),
        PUT: await putBookmark(gone, kind.otherId),
        DELETE: await deleteBookmark(gone, kind.id),
      };
      for (const [route, res] of Object.entries(answers)) {
        expect(res.status, route).toBe(401);
        expect(res.body).toEqual({ error: { message: 'User no longer exists' } });
      }
    });
  });
});
