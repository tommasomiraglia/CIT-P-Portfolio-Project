// Logged-in test users for API tests. Each test file makes its own TestUsers, which gives
// every user it creates a name starting with a prefix unique to that file and run, and
// deletes them all in cleanUp() (ON DELETE CASCADE removes their bookmarks, history, ...).
//
//   const users = new TestUsers('search');
//   afterAll(() => users.cleanUp());
//   const alice = await users.create();
//   await request(app).get(`/api/users/${alice.id}`).set('Authorization', alice.authorization);
import request from 'supertest';
import { app } from '../../src/app.js';
import { pool } from '../../src/db/pool.js';

export interface TestUser {
  id: number;
  username: string;
  token: string;
  // The value for the Authorization header: "Bearer <token>".
  authorization: string;
}

export class TestUsers {
  readonly prefix: string;
  private count = 0;

  constructor(name: string) {
    this.prefix = `t${Date.now().toString(36)}-${name}`;
  }

  // Registers and logs in through the API, the same way the frontend will.
  async create(): Promise<TestUser> {
    this.count += 1;
    const username = `${this.prefix}-${this.count}`;
    const password = 'test password 123';
    const registered = await request(app)
      .post('/api/users')
      .send({ username, email: `${username}@example.com`, password });
    if (registered.status !== 201) {
      throw new Error(`Could not register ${username}: ${JSON.stringify(registered.body)}`);
    }
    const login = await request(app).post('/api/auth/login').send({ username, password });
    const token: string = login.body.token;
    return { id: registered.body.id, username, token, authorization: `Bearer ${token}` };
  }

  async cleanUp(): Promise<void> {
    await pool.query("DELETE FROM app_user WHERE username LIKE $1 || '%'", [this.prefix]);
  }
}
