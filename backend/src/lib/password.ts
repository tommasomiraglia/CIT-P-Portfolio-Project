// Password hashing with Argon2id (docs/api-design.md 4.1). The hash string stores the
// algorithm, its parameters and the random salt, so verify() needs nothing else.
import argon2 from 'argon2';

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}

export function verifyPassword(hash: string, password: string): Promise<boolean> {
  return argon2.verify(hash, password);
}

// Computed once at startup. Computing it on the first unknown username instead would make
// that one answer slower, which is exactly the difference the dummy check must hide.
const dummyHash = hashPassword('dummy password that no account uses');

// Spends the same time as checking a real password, and always fails. Login calls it
// for unknown usernames so the response time does not reveal which usernames exist (4.5).
export async function verifyAgainstDummyHash(password: string): Promise<false> {
  await argon2.verify(await dummyHash, password);
  return false;
}
