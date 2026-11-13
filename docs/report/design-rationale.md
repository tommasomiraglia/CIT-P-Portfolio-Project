<!--
Notes for the group, delete before handing in:
- This is section 2-B.3 of the Subproject 2 report. It points to sections 2-B.1 and 2-B.2 as "the resource model" and "the representations"; adjust the references once those sections exist in the report.
- Part 1 describes the design. Some endpoints are designed but not built yet (see docs/user-stories.md, "Status"). Before handing in, check that every claim still matches the code.
- 2-A.4 asks for a database role with minimal privileges. That is not part of the interface and is not done yet; the sentence about it below must be true by the hand-in.
-->

# Design rationale

This section explains how the interface meets the requirements of Section 2-A, and why we chose each design where another was possible.
The decisions themselves are recorded in `docs/api-design.md`, which the section numbers in brackets refer to.

## How the interface meets the requirements

### 2-A.1 Functionality

Every function of Subproject 1 that a client needs is reachable through one endpoint, listed with the function it calls in the endpoint table of 2-B.1 [1.5].
Searches, ratings, co-players, similar titles and word frequencies are endpoints on titles, people and words; user management, bookmarks, ratings and search history are sub-resources of a user.

IMDB data is read-only because the interface offers no way to change it: titles, people and words only have `GET` routes, and a `POST`, `PUT` or `DELETE` on them is answered `404` like any route that does not exist [1.4].

Framework data supports create, read, update and delete as far as each operation has a meaning:

| Resource | Create | Read | Update | Delete |
| --- | --- | --- | --- | --- |
| User | `POST /api/users` | `GET` | `PATCH` | `DELETE` |
| Rating | `PUT .../ratings/:titleId` | `GET` the list | `PUT` again | `DELETE` |
| Bookmark | `PUT .../bookmarks/titles/:titleId` | `GET` the list | - | `DELETE` |
| Genre preference | `PUT .../genres/:genreId` | `GET` the list | - | `DELETE` |
| Search history entry | Saved by a logged-in search | `GET` the list | - | `DELETE` one or all |

A bookmark and a genre preference hold no data besides the pair they connect, so there is nothing to update.
A history entry records what the user searched; changing it would make the history untrue, so it can only be deleted.

### 2-A.2 Self-descriptive responses

Every resource has a `url` field with its URI, and so does every element of every list [2.1].
A reference to another resource is an object with its `url` and a label to show, never a bare id [2.4]: `"title": { "url": "/api/titles/tt0052520", "name": "The Twilight Zone" }`.
A resource created with `POST` is returned with its URI in the `Location` header [1.6], and a page of a list links to the previous and next page [3.2].
A client therefore never builds a URI itself; it follows the ones it receives.

### 2-A.3 Paged listings

Every operation that returns a list takes `page` and `pageSize` and answers with the same page envelope [3.1, 3.2]:

```json
{ "items": [ … ], "page": 2, "pageSize": 20, "prev": "/api/titles?search=zone&page=1&pageSize=20", "next": "/api/titles?search=zone&page=3&pageSize=20" }
```

When `pageSize` is missing, or above the maximum of 100, the default of 20 is applied.
The response states the size actually used, so the client can see that the default replaced its request.
`prev` and `next` are `null` where there is no such page, and keep every other query parameter of the request, so following `next` continues the same search.

A list that can grow is never embedded in another resource; the resource links to it instead (`"actorsUrl": "/api/titles/tt0052520/actors"`), so no response contains an unpaged list [2.4].

### 2-A.4 Non-functional requirements

**No unbounded result set.**
Every list is paged with at most 100 items per page, and lists that can grow are never embedded (2-A.3).
Single resources only embed small, bounded lists, such as the genres of a title.
The work behind one request is bounded too: search texts are limited to 200 characters [1.7] and passwords to 128 [4.5].

**Passwords as salted hashes.**
The backend hashes every password with Argon2id before it reaches the database, and Argon2id adds a random salt to each hash [4.1].
No response contains the password or its hash: the database function that reads a user does not return it, and the one query that reads the hash, for login, never passes it on [2.2].

**No internal details in errors.**
Every error has the same shape, `{ "error": { "message": "…" } }` [2.5].
Expected errors (`400`, `401`, `403`, `404`, `409`) have messages written for the client.
Any other failure is a `500` with the message `Internal server error`; the stack trace and the SQL error are written only to the server log.

**Least privilege.**
This is a property of the deployment rather than of the interface: the backend connects with a database role that may only execute the functions and read the tables it uses, and cannot change the schema or the IMDB data.

### 2-A.5 Requirements we derived

The application design of Subproject 1 is restated as user stories in Section 2-A.5.
Most stories need only the required functionality.
The stories that need more led to these operations:

| Operation | Story | Why |
| --- | --- | --- |
| Genres and rating in a title | Title page | Shown on the title page; small and bounded, so embedded. |
| `GET /api/titles/:id/alternative-titles` | Alternative titles | A title can have dozens, so a paged sub-resource. |
| `GET /api/titles/:id/episodes` | Episodes of a series | Otherwise a series page cannot reach its episodes. |
| `GET /api/genres` | Choosing favourite genres | The client needs the list of genres to offer. |
| `GET /api/users/:userId/ratings/:titleId` | Own rating on a title page | Without it, the client must page through every rating to find one. |
| `GET .../bookmarks/titles/:titleId` | Bookmark button | Same reason, for the state of the bookmark button. |
| `GET /api/users/:userId`, `POST /api/auth/login` | Profile, login | No database function covers them; the interface needs them for 2-D.6. |

## Decisions where another design was possible

### Resource-oriented URLs, not operations in the URL

URLs name resources and the HTTP method is the action: `DELETE /api/users/7/bookmarks/titles/tt0052520`, not `POST /api/removeBookmark` [1.1].
This is what makes it possible to give, for each resource, its URIs, methods and status codes as 2-B.1 asks, and it lets the routing mirror the resource model, one router per resource (2-D.2).

### A user's data under `/api/users/:userId`, not `/api/me`

`/api/me/bookmarks` would be shorter, and the server knows the user from the token anyway.
But the same URI would then mean different data for different callers, and a URI should identify one resource (2-A.2) [1.2].
The price is an authorization check, that the token belongs to `:userId`, which 2-D.6 asks us to express as middleware in any case.

### `PUT` to add a bookmark, rating or genre

The client already knows the URI of a bookmark (`.../bookmarks/titles/tt0052520`), so it puts the resource there instead of posting to the collection [1.6].
`PUT` is idempotent: sending it twice has the same effect as once, so a client that retries after a network error never gets an error for a bookmark that already exists.
`POST` is kept for registration, where the server chooses the id and returns it in `Location`.

### Plain JSON with `url` fields, not HAL or JSON:API

HAL and JSON:API standardise links, but they wrap every resource in extra structure that the frontend must understand and the report must document [2.1].
One `url` field per resource meets 2-A.2 with the least to learn.

### Relative URIs

`url` fields hold `/api/titles/tt0052520`, not `http://localhost:3000/api/titles/tt0052520` [2.1].
They stay correct behind any host name or proxy, and the server never has to know the address it is reached at.

### Single resources sent bare, lists in an envelope

`GET /api/titles/:id` returns the title itself, with no `{ "data": … }` around it [2.3].
A wrapper would only be needed to carry something next to the resource; a single resource has nothing to carry, while a list carries its page links.

### Searches as query parameters on the collection

A title search is `GET /api/titles?search=star`, not `GET /api/searchTitles/star` [1.3].
The result is a filtered view of the titles collection, so it is addressed as that collection, and the structured and word searches add their own parameters to it.
Combining parameters of different searches in one request is a `400`, because each search is a different database function.

### Page numbers, not cursors

Every database function already took a limit and an offset, which map directly to a page number [3.1].
Page numbers also let the frontend jump to any page.
Cursor paging (`?after=…`) is faster on very deep pages, but it needs a stable sort key in every function and cannot jump to page 5.

### The default page size, not the maximum, above the maximum

When the client asks for 500 items per page, we apply the default of 20, not the maximum of 100, because 2-A.3 says so literally [3.1].
The response states the size used, so the client is not misled.

### No total count

We fetch one row more than the page holds: if it comes back, there is a next page [3.3].
A total would let the frontend show "page 2 of 14", but every database function would need a count over all matches, which on a broad text search means finding every match instead of stopping after one page.

### Saving a search to the history on the server

A logged-in search is saved by the server, on page 1 only [1.7].
The alternative is that the client posts each search to its history.
That would let a client forget it, or save every page it reads, and it would put a business rule in the frontend.
A `GET` should not change what it reads; saving the search changes only the caller's own history, which the client did not request but also cannot be harmed by.
We moved the saving out of the database functions themselves (`database/CHANGES.md`), so that a search can run without a user and each search is saved once.

### JWT bearer tokens, not sessions or Basic authentication

After login the client sends a signed token, a JWT, in the `Authorization` header of every request [4.2].
The server checks its signature and expiry without storing anything, which keeps the service stateless as RESTful services should be (2-C.6), and a header works across origins without cookies (2-D.7).
Server sessions would make logout immediate, but the server would keep state, and cross-origin cookies need extra protection against cross-site request forgery.
HTTP Basic authentication is stateless too, but sends the password with every request.
The price of tokens is that one cannot be revoked before it expires, which is why it expires after one hour [4.3].

### One answer for every failed login

A wrong username and a wrong password give the same `401` with the same message, so the interface never tells an attacker which usernames exist [4.2].
For the same reason, a login with an unknown username checks the password against a dummy hash, so it takes as long as a wrong password [4.5].
The cost is a less helpful message for a user who mistyped their username.

### `401`, not `404`, for a user deleted after logging in

A deleted user's token is still valid until it expires.
When such a token is used, the answer is `401`, because the token no longer identifies anyone; `404` would suggest a wrong URL to a client whose real problem is its login [4.5].

### An invalid token is rejected even where a token is optional

Searching does not need a login, but a search that sends an expired token is a `401`, not an anonymous search [4.4].
Otherwise the search would silently not be saved, and the client would never learn that its user has been logged out.

### `DELETE` of something that does not exist is a `404`

A `DELETE` could also answer `204` when there was nothing to delete, which makes it idempotent in its answer as well as in its effect.
We answer `404` so that a client deleting with a wrong id learns about its mistake [1.6].

### Registration rules

Passwords need 8 to 128 characters and nothing else, following the guidance of NIST SP 800-63B that length matters more than rules such as "one digit and one symbol", which mostly lead to predictable passwords [4.5].
Emails are stored in lowercase, so that `Tom@example.com` and `tom@example.com` cannot be two accounts.

### CORS for listed origins only

The frontend runs on another origin, so the interface allows cross-origin requests, but only from the origins set in the configuration, not from every origin (`*`) [5].
Credentials mode stays off, because the token is sent in a header, not a cookie.
CORS only restricts browsers; it does not replace authentication.
