//Saves search history, shared by the search services.
import { pool } from '../db/pool.js';
import { addSearchHistory, UnknownUserError } from '../repositories/search-history.repository.js';
import { UnauthorizedError } from '../middleware/errors.js';

export async function saveSearch(userId: number, query: string): Promise<void> {
  try {
    await addSearchHistory(pool, userId, query);
  } catch (error) {
    if (error instanceof UnknownUserError) {
      throw new UnauthorizedError('User no longer exists');
    }
    throw error;
  }
}