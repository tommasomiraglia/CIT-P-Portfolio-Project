// A user as the database returns it and as the API sends it (docs/api-design.md 4.5).

// One row of get_user(). It never contains the password.
export interface UserRow {
  userid: number;
  username: string;
  email: string;
  phonenumber: string | null;
}

// The row used to check a login. The password hash is only ever read for that purpose
// and is dropped by the mapper, so it cannot end up in a response.
export interface UserCredentialsRow extends UserRow {
  password: string;
}

// The body of POST /api/users after the controller validated it.
export interface RegistrationInput {
  username: string;
  email: string;
  password: string;
  phoneNumber: string | null;
}

// A registration that passed validation, with the password already hashed.
export interface NewUser {
  username: string;
  email: string;
  passwordHash: string;
  phoneNumber: string | null;
}

export interface UserDto {
  url: string;
  id: number;
  username: string;
  email: string;
  phoneNumber: string | null;
}

export interface LoginResultDto {
  token: string;
  user: UserDto;
}

// Who sent the request, as authenticate() finds it in the token.
export interface AuthenticatedUser {
  id: number;
}
