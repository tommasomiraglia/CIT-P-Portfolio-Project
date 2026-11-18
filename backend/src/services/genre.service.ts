// Business rules for the genre catalogue and a user's favourite genres.
import { pool } from '../db/pool.js';
import { takePage } from '../lib/paging.js';
import { toGenreDto } from '../mappers/genre.mapper.js';
import { NotFoundError, UnauthorizedError } from '../middleware/errors.js';
import {
  addGenrePreference,
  findGenreById,
  findGenrePreference,
  listGenrePreferences,
  listGenres,
  removeGenrePreference,
} from '../repositories/genre.repository.js';
import { userExists } from '../repositories/user.repository.js';
import type { GenreDto } from '../types/genre.js';
import type { PageRequest, PageSlice } from '../types/page.js';

export async function getGenres(pageRequest: PageRequest): Promise<PageSlice<GenreDto>> {
  const rows = await listGenres(pool, pageRequest);
  return takePage(rows, pageRequest, toGenreDto);
}

export async function getGenreById(genreId: number): Promise<GenreDto> {
  const row = await findGenreById(pool, genreId);
  if (!row) {
    throw new NotFoundError(`Genre ${genreId} not found`);
  }
  return toGenreDto(row);
}

export async function getOwnGenrePreferences(
  userId: number,
  pageRequest: PageRequest,
): Promise<PageSlice<GenreDto>> {
  await ensureUserExists(userId);
  const rows = await listGenrePreferences(pool, userId, pageRequest);
  return takePage(rows, pageRequest, toGenreDto);
}

export async function getOwnGenrePreference(userId: number, genreId: number): Promise<GenreDto> {
  await ensureUserExists(userId);
  const row = await findGenrePreference(pool, userId, genreId);
  if (!row) {
    throw new NotFoundError(`Genre ${genreId} is not one of your favourite genres`);
  }
  return toGenreDto(row);
}

// PUT: 200 with the genre, also when it already was a favourite (docs/api-design.md 1.6).
// The genre is checked first: genres never change, and add_genre_preference itself would
// only fail with a foreign key error, which says nothing clear.
export async function addOwnGenrePreference(userId: number, genreId: number): Promise<GenreDto> {
  await ensureUserExists(userId);
  const genre = await findGenreById(pool, genreId);
  if (!genre) {
    throw new NotFoundError(`Genre ${genreId} not found`);
  }
  await addGenrePreference(pool, userId, genreId);
  return toGenreDto(genre);
}

export async function removeOwnGenrePreference(userId: number, genreId: number): Promise<void> {
  await ensureUserExists(userId);
  if (!(await removeGenrePreference(pool, userId, genreId))) {
    throw new NotFoundError(`Genre ${genreId} is not one of your favourite genres`);
  }
}

// A user deleted after logging in still has a valid token (docs/api-design.md 4.3).
async function ensureUserExists(userId: number): Promise<void> {
  if (!(await userExists(pool, userId))) {
    throw new UnauthorizedError('User no longer exists');
  }
}
