// Unit tests for the user row-to-DTO mapping. No database needed (2-E.1).
import { describe, expect, test } from 'vitest';
import { toUserDto } from '../src/mappers/user.mapper.js';
import type { UserCredentialsRow } from '../src/types/user.js';

describe('toUserDto', () => {
  const row: UserCredentialsRow = {
    userid: 7,
    username: 'tommaso',
    email: 'tommaso@example.com',
    phonenumber: null,
    password: '$argon2id$v=19$m=65536,t=3,p=4$secret',
  };

  test('renames columns to camelCase and adds the resource URL', () => {
    expect(toUserDto(row)).toEqual({
      url: '/api/users/7',
      id: 7,
      username: 'tommaso',
      email: 'tommaso@example.com',
      phoneNumber: null,
    });
  });

  test('never copies the password hash, even from a row that has one', () => {
    expect(JSON.stringify(toUserDto(row))).not.toContain('argon2');
  });
});
