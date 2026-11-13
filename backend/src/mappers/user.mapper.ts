// Converts a user row into the UserDto the API sends.
import type { UserDto, UserRow } from '../types/user.js';

export function userUrl(userId: number): string {
  return `/api/users/${userId}`;
}

// Picks each field by name instead of spreading the row, so a UserCredentialsRow
// passed here can never leak its password hash into the response.
export function toUserDto(row: UserRow): UserDto {
  return {
    url: userUrl(row.userid),
    id: row.userid,
    username: row.username,
    email: row.email,
    phoneNumber: row.phonenumber,
  };
}
