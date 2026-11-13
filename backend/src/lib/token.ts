// Login tokens: JWTs signed with HS256 and JWT_SECRET (docs/api-design.md 4.2 and 4.3).
// A JWT is three base64url parts separated by dots: a header, a JSON payload such as
// { "sub": "7", "exp": 1789000000 }, and a signature over both. Only someone with the
// secret can produce a valid signature, so the server trusts the payload without storing it.
import { errors, jwtVerify, SignJWT } from 'jose';
import { config } from '../config/index.js';
import { UnauthorizedError } from '../middleware/errors.js';

export const TOKEN_LIFETIME = '1h';

const ALGORITHM = 'HS256';
const secretKey = new TextEncoder().encode(config.jwtSecret);
const USER_ID = /^[1-9]\d*$/;

export function signToken(userId: number): Promise<string> {
  return new SignJWT()
    .setProtectedHeader({ alg: ALGORITHM })
    .setSubject(String(userId))
    .setIssuedAt()
    .setExpirationTime(TOKEN_LIFETIME)
    .sign(secretKey);
}

// Returns the user id the token was issued for, or throws a 401.
export async function verifyToken(token: string): Promise<number> {
  try {
    // Accepting only HS256 matters: otherwise a forged token could name another algorithm,
    // such as "none", and skip the signature check.
    const { payload } = await jwtVerify(token, secretKey, { algorithms: [ALGORITHM] });
    if (payload.sub === undefined || !USER_ID.test(payload.sub)) {
      throw new UnauthorizedError('Invalid token');
    }
    return Number(payload.sub);
  } catch (error) {
    if (error instanceof errors.JWTExpired) {
      throw new UnauthorizedError('Token expired, log in again');
    }
    if (error instanceof errors.JOSEError || error instanceof UnauthorizedError) {
      throw new UnauthorizedError('Invalid token');
    }
    throw error;
  }
}
