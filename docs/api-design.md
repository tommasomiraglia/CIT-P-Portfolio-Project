# API design decisions

The decisions we took for the REST API, and why.
Code that adds or changes an endpoint follows this file.
To change a decision, change it here first and tell the group.

Each decision names the requirement from `docs/project-description.pdf` it answers, so this file also feeds sections 2-B and 2-C of the report.

## 1. URLs

### 1.1 Resource-oriented URLs

URLs name resources (nouns) and HTTP methods are the actions: `DELETE /api/users/7/bookmarks/titles/tt0052520`, never `POST /api/removeBookmark`.
Collections use plural nouns, and multi-word names use kebab-case (`search-history`, `co-players`).
Everything is under `/api`.

**Why:** 2-B.1 asks for URIs, methods and status codes per resource, which only makes sense with resource-oriented URLs.
It also lets the routing mirror the resource model (2-D.2): one router per resource.

### 1.2 A user's own data lives under `/api/users/:userId`

Bookmarks, ratings, search history and genre preferences are sub-resources of the user who owns them.
We do not use `/api/me/...`.

**Why:** every URI then names exactly one resource, the same for every caller, which 2-A.2 relies on.
The price is an authorization check (the logged-in user must be `:userId`, see 4.4), and 2-D.6 asks us to show exactly that kind of check as middleware.

**Rejected:** `/api/me/...` is shorter, but the same URI would mean different data for different users.

### 1.3 Relationships

- Something that belongs to one resource is a sub-resource: `/api/titles/:id/similar`, `/api/people/:id/co-players`.
- Filtering and searching a collection uses query parameters: `/api/titles?search=star`.

### 1.4 IMDB data is read-only

Titles, people and words only support `GET` (2-A.1).
Framework data (users, bookmarks, ratings, history, genre preferences) supports create, read, update and delete.

### 1.5 Endpoint list

Ids are validated before use (2-D.2): titles match `tt` plus 7 or 8 digits, people `nm` plus 7 or 8 digits, other ids are positive integers.
"Auth" says what the caller needs: nothing, a valid token (optional or required), or a token for the same user as `:userId`.

| Method and path | Database function | Auth |
| --- | --- | --- |
| `GET /api/titles?search=…` | `string_search` | Optional: a logged-in search is saved to the history |
| `GET /api/titles?title=…&plot=…&characters=…&names=…` | `structured_string_search` | Optional, as above |
| `GET /api/titles?words=a,b&match=exact\|any\|ranked` | `exact_match_search`, `any_match_search`, `weights_search` | None |
| `GET /api/titles/:id` | - | None |
| `GET /api/titles/:id/similar` | `similarity_search` | None |
| `GET /api/titles/:id/actors` | `popular_actors_in_movie` | None |
| `GET /api/people?name=…` | `search_names` | Optional, as above |
| `GET /api/people/:id` | - | None |
| `GET /api/people/:id/co-players` | `co_players` | None |
| `GET /api/people/:id/words` | `person_words` | None |
| `GET /api/words?words=a,b` | `words_query` | None |
| `POST /api/users` | `create_user` | None (registration) |
| `POST /api/auth/login` | - | None |
| `GET`, `PATCH`, `DELETE /api/users/:userId` | `get_user`, `update_user`, `delete_user` | Same user |
| `GET /api/users/:userId/bookmarks/titles` | `get_bookmarked_titles` | Same user |
| `PUT`, `DELETE /api/users/:userId/bookmarks/titles/:titleId` | `bookmark_title`, `remove_bookmark_title` | Same user |
| `GET /api/users/:userId/bookmarks/people` | `get_bookmarked_persons` | Same user |
| `PUT`, `DELETE /api/users/:userId/bookmarks/people/:personId` | `bookmark_person`, `remove_bookmark_person` | Same user |
| `GET /api/users/:userId/ratings` | `get_rating_history` | Same user |
| `PUT`, `DELETE /api/users/:userId/ratings/:titleId` | `rate` and `set_rating_comment`, `unrate` | Same user |
| `GET`, `DELETE /api/users/:userId/search-history` | `get_search_history`, `clear_search_history` | Same user |
| `DELETE /api/users/:userId/search-history/:entryId` | `delete_search_history_entry` | Same user |
| `GET /api/users/:userId/genres` | `get_genre_preferences` | Same user |
| `PUT`, `DELETE /api/users/:userId/genres/:genreId` | `add_genre_preference`, `remove_genre_preference` | Same user |

Combining `search`, the structured parameters and `words` in one request is a `400`.

### 1.6 Methods and status codes

| Case | Method | Success |
| --- | --- | --- |
| Read | `GET` | `200` |
| Create with a server-chosen id (register) | `POST` | `201` with a `Location` header and the new resource |
| Add something whose URI the client already knows (bookmark, rating, genre) | `PUT` | `200` with the resource, also when it already existed |
| Partial update (user profile) | `PATCH` | `200` with the updated resource |
| Delete | `DELETE` | `204` with no body |

`PUT` is idempotent: sending it twice has the same effect as once, so a client that retries never gets an error for a bookmark that already exists.
`DELETE` of something that does not exist is a `404`.

Errors: `400` invalid parameter or body, `401` missing or invalid token, `403` token for a different user, `404` unknown resource or route, `409` username or email already taken, `500` unexpected failure.

### 1.7 Title search: `GET /api/titles?search=`

- `search` is required here, trimmed, and 1 to 200 characters; anything else is a `400`.
  The structured and word searches of 1.5 will add their own parameters to the same collection.
- It matches titles whose title or plot contains the text, ignoring case.
- A logged-in search (a valid token is sent) is saved to the user's history, an anonymous one is not.
  Only the request for page 1 is saved: following `next` is still the same search.
- A token that is sent but invalid is a `401`, also here (4.4).

## 2. JSON representations

### 2.1 Plain JSON with `url` fields

Responses are plain JSON objects, not HAL or JSON:API.
Every resource, and every element of a list, has a `url` field with its URI (2-A.2), as `TitleDto` already does.
URIs are relative to the server (`/api/titles/tt0052520`), so they work behind any host name.

**Why:** HAL and JSON:API standardise links, but they make every response bigger and the frontend has to understand the format.
A `url` field per resource meets 2-A.2 with the least to learn and document.

### 2.2 Field conventions

- Field names are camelCase.
- A missing value is always `null`, never `"N/A"` or `""`, and the field is never left out.
- Dates and times are ISO 8601 strings in UTC: `"2026-11-11T14:30:00Z"`.
- `password` and its hash never appear in a response.

### 2.3 Single resources are sent bare

`GET /api/titles/:id` returns the title object itself, with no `{ "data": … }` wrapper.
Lists use the page envelope from section 3.

### 2.4 Related resources

- A reference to another resource is an object with its `url` and a label to display, never a bare id: `"title": { "url": "/api/titles/tt0052520", "name": "The Twilight Zone" }`.
- Small, bounded lists are embedded, for example a title's genres: `"genres": ["Drama", "Fantasy"]`.
- Lists that can grow are not embedded: the resource links to them instead, for example `"actorsUrl": "/api/titles/tt0052520/actors"`.
  Otherwise one response could contain an unpaged list, which 2-A.3 and 2-A.4 forbid.

### 2.5 Errors

Every error has the same shape, with the matching HTTP status (2-B.2, 2-D.5):

```json
{ "error": { "message": "Title tt9999999 not found" } }
```

Messages never contain SQL, table names or stack traces (2-A.4).

### 2.6 Representations

**Title in a list** (the items of `GET /api/titles?search=`):

| Field | Type | Meaning |
| --- | --- | --- |
| `url` | string | URI of the title, `/api/titles/:id` |
| `id` | string | IMDB id, for example `tt0052520` |
| `title` | string | Primary title |

The client follows `url` for the full title.

**User**: see 4.5.

## 3. Paging

### 3.1 Page number and page size

Every list takes `?page=` and `?pageSize=` (2-A.3).
The repository calls the database function with `p_limit = pageSize + 1` and `p_offset = (page - 1) * pageSize`.

| Parameter | Rule |
| --- | --- |
| `page` | Integer, 1 or more. Missing means 1. |
| `pageSize` | Integer, 1 or more. Missing means 20. |
| `pageSize` above 100 | The default, 20, is applied. |
| `page` so large that the offset no longer fits in the functions' `INTEGER` `p_offset` | `400` |
| Anything else (`page=0`, `pageSize=abc`) | `400` |

**Why page numbers and not cursors:** every database function already takes `p_limit` and `p_offset`, and page numbers let the frontend jump to any page.
Cursor paging (`?after=…`) is faster on very deep pages, but it needs a stable sort key in every function and cannot jump to page 5, so it is not worth rewriting the functions for.

**Why the default above the maximum:** 2-A.3 says that when "the requested size exceeds the maximum, a default is applied".
We follow it literally.
The response always states the `pageSize` actually used, so the client can see what happened.

### 3.2 Page envelope

```json
{
  "items": [
    { "url": "/api/titles/tt0052520", "title": "The Twilight Zone" }
  ],
  "page": 2,
  "pageSize": 20,
  "prev": "/api/titles?search=zone&page=1&pageSize=20",
  "next": "/api/titles?search=zone&page=3&pageSize=20"
}
```

- `prev` and `next` are full links that keep every other query parameter of the request.
- `prev` is `null` on page 1, `next` is `null` on the last page.
- A page past the end returns `200` with empty `items`, `next: null`, and `prev` pointing to the page before it.

### 3.3 No total count

We fetch one row more than `pageSize`.
If that extra row comes back, there is a next page; it is dropped before sending.
We do not return a `total`.

**Why:** it needs no change to the database functions and no second query.
A `total` would let the frontend show "page 2 of 14", but every function would need a `COUNT(*) OVER()` column, and on a broad text search that count means finding every match instead of stopping after one page.
If Subproject 3 turns out to need it, we add it to the functions that need it.

## 4. Authentication

### 4.1 Passwords are hashed with Argon2id

The service layer hashes the password with Argon2id (npm package `argon2`, default parameters) before calling `create_user` or `update_user`, and verifies it at login.
The database only ever sees the hash (2-A.4).

**Why:** Argon2id is the first choice in the OWASP password storage guidance.
It adds a random salt itself, and it is deliberately slow and memory-hungry, which makes guessing passwords expensive.
bcrypt is also acceptable, but it silently ignores everything after 72 bytes of a password.

### 4.2 JWT bearer tokens

1. The client sends `POST /api/auth/login` with `{ "username": "…", "password": "…" }`.
2. The server checks the password and answers `200 { "token": "…", "user": { "url": "/api/users/7", … } }`.
3. The client sends the token on every request in the header `Authorization: Bearer <token>`.

The token is a JWT (JSON Web Token): a small JSON payload, `{ "sub": "7", "exp": … }`, signed with HS256 and a secret from `JWT_SECRET` in `backend/.env`.
The server can check the signature and the expiry without storing anything.
We use the npm package `jose` to sign and verify tokens.

A wrong username and a wrong password give the same `401` and the same message, so the API never tells an attacker which usernames exist.

**Why JWT (2-C.6):** the identity travels with each request and the server keeps no session, which is what "RESTful services are stateless" asks for.
A header also works across origins without cookies, which keeps the CORS setup for Subproject 3 simple (2-D.7).

**Rejected:**

- Server sessions with a cookie make logout easy, but the server keeps state, and cross-origin cookies need `SameSite=None`, `Secure` and CSRF protection.
- HTTP Basic authentication is stateless too, but it sends the password with every request.

### 4.3 Token lifetime: 1 hour, no refresh tokens

The token expires 1 hour after login, and the user then logs in again.

**Limitations, for the report:**

- A token cannot be revoked before it expires.
  Logging out only deletes it on the client, and a stolen token works until it expires; the short lifetime limits that window.
- Deleting a user does not invalidate their token, so every operation that loads the user must handle "user no longer exists" with a `401`.
- If the frontend stores the token where JavaScript can read it, an XSS bug in the frontend can steal it.

### 4.4 Two middlewares

Verifying identity and deciding what the caller may do are separate middlewares (2-D.6):

- `authenticate` reads the `Authorization` header, verifies the token and sets `req.user`.
  It answers `401` when the header is missing or the token is invalid or expired.
  An optional variant sets `req.user` when a valid token is present and lets anonymous requests through, for the searches that save history.
- `authorizeSelf` runs after `authenticate` on every `/api/users/:userId/...` route except registration.
  It answers `400` when `:userId` is not a positive integer, and `403` when `req.user` is not `:userId`.

The optional variant still answers `401` for a token that is present but invalid or expired.
Ignoring it would quietly turn a logged-in search into an anonymous one, and the client would never learn that its token had expired.

Every `401` carries the header `WWW-Authenticate: Bearer`, as the HTTP standard asks, so a client can see which kind of credentials the API expects.

### 4.5 Registration and the user resource

`POST /api/users` takes a JSON body:

| Field | Rule |
| --- | --- |
| `username` | Required. 3 to 30 characters: letters, digits, `_`, `.` and `-`. |
| `email` | Required. At most 254 characters, one `@` with text on both sides and no spaces. Stored in lowercase. |
| `password` | Required. 8 to 128 characters, with no rules about which characters. |
| `phoneNumber` | Optional, `null` when missing. At most 30 characters: digits, spaces, `+`, `-`, `(` and `)`. |

Other fields are ignored.
A missing or invalid field is a `400` whose message names the field.
A username or email that is already taken is a `409` that says which one.

The answer is `201`, with the header `Location: /api/users/7` and the user:

```json
{ "url": "/api/users/7", "id": 7, "username": "tommaso", "email": "tommaso@example.com", "phoneNumber": null }
```

`GET /api/users/:userId` and the `user` field of the login answer use the same representation.
`langid` and `regionid` from the database are not part of it yet: there are no language or region resources for them to link to (2.4).

**Why these rules:**

- The password rules follow NIST SP 800-63B, the US government's guidance on passwords: a minimum length matters more than rules such as "one digit and one symbol", which mostly make people choose predictable passwords.
  The maximum keeps a client from sending a megabyte to hash.
- Emails are stored in lowercase so that `Tom@example.com` and `tom@example.com` cannot become two accounts.
  Usernames keep their case, as the `UNIQUE` constraint in the database does, so `Tom` and `tom` are different users.

**Logging in as a user who does not exist** takes as long as a wrong password: the server checks the password against a dummy hash.
Otherwise the faster answer would tell an attacker that the username does not exist, which the identical message (4.2) is meant to hide.

**A user deleted after logging in** still has a valid token (4.3).
`GET /api/users/:userId` then answers `401`, not `404`: the token no longer identifies anyone.

## 5. Cross-origin requests (CORS)

The frontend of Subproject 3 is served from a different origin than the API (2-D.7), so the browser only lets it read API responses if the API allows that origin.
The policy is in `backend/src/middleware/cors.ts`:

| Setting | Value | Why |
| --- | --- | --- |
| Allowed origins | `CORS_ORIGINS` in `backend/.env`, default `http://localhost:5173` (Vite's dev server) | Only our frontend, not `*`. A new deployment adds its origin to the setting without a code change. |
| Methods | `GET`, `POST`, `PUT`, `PATCH`, `DELETE` | The methods of section 1.6. |
| Request headers | `Content-Type`, `Authorization` | JSON bodies and the bearer token (4.2). |
| Exposed response headers | `Location` | The frontend must read the URI of a resource created with `POST`. |
| Credentials | Off | The token travels in a header, not a cookie. |
| Preflight cache | 1 hour | The browser does not repeat the `OPTIONS` request before every call. |

The CORS middleware runs first, so error responses carry the headers too and the frontend can read their message.

**Limitation:** CORS only restricts browsers.
Any other client can still call the API, so it is not a security boundary; authentication (section 4) is.
