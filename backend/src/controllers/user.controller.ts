// HTTP handlers for /api/users: validate the request, call the service, send the JSON.
import type { Request, Response } from 'express';
import { parseIntegerId } from '../lib/ids.js';
import { buildPage, parsePageRequest } from '../lib/paging.js';
import { readJsonObject, requireString } from '../lib/request-body.js';
import { BadRequestError } from '../middleware/errors.js';
import {
  addOwnGenrePreference,
  getOwnGenrePreference,
  getOwnGenrePreferences,
  removeOwnGenrePreference,
} from '../services/genre.service.js';
import {
  getSearchHistory,
  removeAllSearchHistory,
  removeSearchHistoryEntry,
} from '../services/search-history.service.js';
import { getOwnUser, registerUser, updateOwnUser } from '../services/user.service.js';
import type { ProfileChanges, RegistrationInput } from '../types/user.js';

// The rules of docs/api-design.md 4.5.
const USERNAME = /^[A-Za-z0-9_.-]{3,30}$/;
const EMAIL = /^[^\s@]+@[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;
const PHONE_NUMBER = /^[0-9 +()-]{1,30}$/;

// Each field is checked by one function, shared by registration and PATCH, so the two can
// never accept different values. They take unknown: in a PATCH the field may be any JSON.
function parseUsername(value: unknown): string {
  if (typeof value !== 'string' || !USERNAME.test(value)) {
    throw new BadRequestError(
      '"username" must be 3 to 30 characters: letters, digits, "_", "." or "-"',
    );
  }
  return value;
}

// Stored in lowercase, so that Tom@example.com and tom@example.com are one account (4.5).
function parseEmail(value: unknown): string {
  if (typeof value !== 'string' || value.length > MAX_EMAIL_LENGTH || !EMAIL.test(value)) {
    throw new BadRequestError('"email" must be an email address like name@example.com');
  }
  return value.toLowerCase();
}

function parsePhoneNumber(value: unknown): string | null {
  if (value === null) {
    return null;
  }
  if (typeof value !== 'string' || !PHONE_NUMBER.test(value)) {
    throw new BadRequestError(
      '"phoneNumber" must be null or up to 30 digits, spaces, "+", "-", "(" and ")"',
    );
  }
  return value;
}

function parsePassword(value: string): string {
  // Counted in characters, not UTF-16 units, so an emoji counts once.
  const passwordLength = [...value].length;
  if (passwordLength < MIN_PASSWORD_LENGTH || passwordLength > MAX_PASSWORD_LENGTH) {
    throw new BadRequestError(
      `"password" must be ${MIN_PASSWORD_LENGTH} to ${MAX_PASSWORD_LENGTH} characters long`,
    );
  }
  return value;
}

// requireString first, so that a missing field gets "is required" rather than a format rule.
function parseRegistration(body: Record<string, unknown>): RegistrationInput {
  return {
    username: parseUsername(requireString(body, 'username')),
    email: parseEmail(requireString(body, 'email')),
    password: parsePassword(requireString(body, 'password')),
    phoneNumber: parsePhoneNumber(body.phoneNumber ?? null),
  };
}

// A missing field is left as it is. "phoneNumber": null removes the number; username and
// email cannot be removed, so null is a 400 for them. The password is not changed here.
function parseProfileChanges(body: Record<string, unknown>): ProfileChanges {
  const changes: ProfileChanges = {};
  if (body.username !== undefined) {
    changes.username = parseUsername(body.username);
  }
  if (body.email !== undefined) {
    changes.email = parseEmail(body.email);
  }
  if (body.phoneNumber !== undefined) {
    changes.phoneNumber = parsePhoneNumber(body.phoneNumber);
  }
  if (Object.keys(changes).length === 0) {
    throw new BadRequestError('Send at least one of "username", "email" and "phoneNumber"');
  }
  return changes;
}

// POST /api/users: registration. 201 with a Location header pointing to the new user.
export async function createUser(req: Request, res: Response): Promise<void> {
  const user = await registerUser(parseRegistration(readJsonObject(req.body)));
  res.status(201).location(user.url).json(user);
}

// GET /api/users/:userId. authenticate and authorizeSelf already ran, so the id is
// valid and belongs to the caller.
export async function getUserById(req: Request<{ userId: string }>, res: Response): Promise<void> {
  res.json(await getOwnUser(parseIntegerId('user id', req.params.userId)));
}

// PATCH /api/users/:userId. Same guards as GET; answers with the user as GET shows it.
export async function patchUserById(
  req: Request<{ userId: string }>,
  res: Response,
): Promise<void> {
  const userId = parseIntegerId('user id', req.params.userId);
  res.json(await updateOwnUser(userId, parseProfileChanges(readJsonObject(req.body))));
}

const POSITIVE_BIGINT = /^[1-9]\d*$/;
const MAX_POSTGRES_BIGINT = 9_223_372_036_854_775_807n;

function parseHistoryEntryId(value: string): string {
  if (value.length > 19 || !POSITIVE_BIGINT.test(value) || BigInt(value) > MAX_POSTGRES_BIGINT) {
    throw new BadRequestError(
      `Invalid search history entry id "${value}": expected a positive integer`,
    );
  }
  return value;
}

export async function listSearchHistory(
  req: Request<{ userId: string }>,
  res: Response,
): Promise<void> {
  const userId = parseIntegerId('user id', req.params.userId);
  const pageRequest = parsePageRequest(req.query);
  const slice = await getSearchHistory(userId, pageRequest);
  res.json(buildPage(slice, pageRequest, req.originalUrl));
}

export async function deleteSearchHistoryEntry(
  req: Request<{ userId: string; entryId: string }>,
  res: Response,
): Promise<void> {
  await removeSearchHistoryEntry(
    parseIntegerId('user id', req.params.userId),
    parseHistoryEntryId(req.params.entryId),
  );
  res.status(204).end();
}

export async function deleteSearchHistory(
  req: Request<{ userId: string }>,
  res: Response,
): Promise<void> {
  await removeAllSearchHistory(parseIntegerId('user id', req.params.userId));
  res.status(204).end();
}

export async function listOwnGenres(
  req: Request<{ userId: string }>,
  res: Response,
): Promise<void> {
  const userId = parseIntegerId('user id', req.params.userId);
  const pageRequest = parsePageRequest(req.query);
  const slice = await getOwnGenrePreferences(userId, pageRequest);
  res.json(buildPage(slice, pageRequest, req.originalUrl));
}

export async function getOwnGenre(
  req: Request<{ userId: string; genreId: string }>,
  res: Response,
): Promise<void> {
  const userId = parseIntegerId('user id', req.params.userId);
  const genreId = parseIntegerId('genre id', req.params.genreId);
  res.json(await getOwnGenrePreference(userId, genreId));
}

export async function putOwnGenre(
  req: Request<{ userId: string; genreId: string }>,
  res: Response,
): Promise<void> {
  const userId = parseIntegerId('user id', req.params.userId);
  const genreId = parseIntegerId('genre id', req.params.genreId);
  res.json(await addOwnGenrePreference(userId, genreId));
}

export async function deleteOwnGenre(
  req: Request<{ userId: string; genreId: string }>,
  res: Response,
): Promise<void> {
  const userId = parseIntegerId('user id', req.params.userId);
  const genreId = parseIntegerId('genre id', req.params.genreId);
  await removeOwnGenrePreference(userId, genreId);
  res.status(204).end();
}
