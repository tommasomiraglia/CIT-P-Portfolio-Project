// HTTP handlers for /api/users: validate the request, call the service, send the JSON.
import type { Request, Response } from 'express';
import { parseIntegerId } from '../lib/ids.js';
import { readJsonObject, requireString } from '../lib/request-body.js';
import { BadRequestError } from '../middleware/errors.js';
import { getOwnUser, registerUser } from '../services/user.service.js';
import type { RegistrationInput } from '../types/user.js';

// The rules of docs/api-design.md 4.5.
const USERNAME = /^[A-Za-z0-9_.-]{3,30}$/;
const EMAIL = /^[^\s@]+@[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;
const PHONE_NUMBER = /^[0-9 +()-]{1,30}$/;

function parseRegistration(body: Record<string, unknown>): RegistrationInput {
  const username = requireString(body, 'username');
  if (!USERNAME.test(username)) {
    throw new BadRequestError(
      '"username" must be 3 to 30 characters: letters, digits, "_", "." or "-"',
    );
  }
  const email = requireString(body, 'email');
  if (email.length > MAX_EMAIL_LENGTH || !EMAIL.test(email)) {
    throw new BadRequestError('"email" must be an email address like name@example.com');
  }
  const password = requireString(body, 'password');
  // Counted in characters, not UTF-16 units, so an emoji counts once.
  const passwordLength = [...password].length;
  if (passwordLength < MIN_PASSWORD_LENGTH || passwordLength > MAX_PASSWORD_LENGTH) {
    throw new BadRequestError(
      `"password" must be ${MIN_PASSWORD_LENGTH} to ${MAX_PASSWORD_LENGTH} characters long`,
    );
  }
  const phoneNumber = body.phoneNumber ?? null;
  if (
    phoneNumber !== null &&
    (typeof phoneNumber !== 'string' || !PHONE_NUMBER.test(phoneNumber))
  ) {
    throw new BadRequestError(
      '"phoneNumber" must be null or up to 30 digits, spaces, "+", "-", "(" and ")"',
    );
  }
  return { username, email: email.toLowerCase(), password, phoneNumber };
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
