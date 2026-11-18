// Business rules for the genre catalogue and a user's favourite genres.
import { pool } from '../db/pool.js';
import { takePage, toLimitOffset } from '../lib/paging.js';
import { NotFoundError, UnauthorizedError } from '../middleware/errors.js';
import {
  addGenrePreference,
  getGenre,
  getGenrePreference,
  listGenrePreferences,
  listGenres,
  removeGenrePreference,
} from '../repositories/genre.repository.js';
import { userExists } from '../repositories/user.repository.js';
import type { GenreDto } from '../types/genre.js';
import type { PageRequest, PageSlice } from '../types/page.js';

function toGenreDto(row: { genereid: number; name: string }): GenreDto {
  return {
    url: `/api/genres/${row.genereid}`,
    id: row.genereid,
    name: row.name,
  };
}

export async function getGenres(pageRequest: PageRequest): Promise<PageSlice<GenreDto>> {
  const { limit, offset } = toLimitOffset(pageRequest);
  const rows = await listGenres(pool, limit, offset);
  return takePage(rows, pageRequest, toGenreDto);
}

export async function getGenreById(genreId: number): Promise<GenreDto> {
  const row = await getGenre(pool, genreId);
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
  const { limit, offset } = toLimitOffset(pageRequest);
  const rows = await listGenrePreferences(pool, userId, limit, offset);
  return takePage(rows, pageRequest, toGenreDto);
}

export async function getOwnGenrePreference(userId: number, genreId: number): Promise<GenreDto> {
  await ensureUserExists(userId);
  const row = await getGenrePreference(pool, userId, genreId);
  if (!row) {
    throw new NotFoundError(`Genre preference ${genreId} not found`);
  }
  return toGenreDto(row);
}

export async function addOwnGenrePreference(userId: number, genreId: number): Promise<GenreDto> {
  await ensureUserExists(userId);
  const row = await addGenrePreference(pool, userId, genreId);
  if (!row) {
    throw new NotFoundError(`Genre ${genreId} not found`);
  }
  return toGenreDto(row);
}

export async function removeOwnGenrePreference(userId: number, genreId: number): Promise<void> {
  await ensureUserExists(userId);
  if (!(await removeGenrePreference(pool, userId, genreId))) {
    throw new NotFoundError(`Genre preference ${genreId} not found`);
  }
}

async function ensureUserExists(userId: number): Promise<void> {
  if (!(await userExists(pool, userId))) {
    throw new UnauthorizedError('User no longer exists');
  }
}
