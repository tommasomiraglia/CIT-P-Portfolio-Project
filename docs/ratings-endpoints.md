# Rating endpoints: what was built and why

This file records the decisions taken while building task C (ratings), in the same form as `docs/api-design.md`: the decision, why, and what was rejected.
The rules a client sees are in `docs/api-design.md` 1.8 and 2.6; this file adds the reasoning and how the code does it.

## What was built

| Method and path | Success | Errors |
| --- | --- | --- |
| `GET /api/users/:userId/ratings` | `200` with one page of ratings | `400` invalid `page` or `pageSize` |
| `GET /api/users/:userId/ratings/:titleId` | `200` with the rating | `400` invalid title id, `404` not rated |
| `PUT /api/users/:userId/ratings/:titleId` | `200` with the rating | `400` invalid title id, rating or comment, `404` unknown title |
| `DELETE /api/users/:userId/ratings/:titleId` | `204` with no body | `400` invalid title id, `404` not rated |

All four also answer `401` without a valid token, `403` for another user's id and `400` for a user id that is not a positive integer.
Those three come from `authenticate` and `authorizeSelf`, which already guard everything under `/api/users/:userId`.

A rating looks like this:

```json
{
  "url": "/api/users/7/ratings/tt0052520",
  "title": { "url": "/api/titles/tt0052520", "name": "The Twilight Zone" },
  "rating": 9,
  "comment": "Still great."
}
```

## Where the code is

One file per layer, as CONTRIBUTING.md asks:

| File in `backend/src/` | Does |
| --- | --- |
| `routes/rating.routes.ts` | The four routes. Mounted on `/ratings` inside `ownUserRouter` in `routes/user.routes.ts`. |
| `controllers/rating.controller.ts` | Validates the title id, the body and the paging; sends the JSON. |
| `services/rating.service.ts` | The transaction, the `404`s and the `401` for a deleted user. |
| `repositories/rating.repository.ts` | Calls `get_rating_history`, `rate`, `set_rating_comment` and `unrate`, and reads one rating. |
| `mappers/rating.mapper.ts`, `types/rating.ts` | `RatingRow` to `RatingDto`. |

Small changes to shared files:

- `lib/ids.ts` has a new `parseTitleId`. The check was a private constant in `title.controller.ts`; ratings need the same check, and bookmarks (task B) will too.
- `mappers/title.mapper.ts` exports `titleUrl`, as `user.mapper.ts` already exports `userUrl`, so the URL of a title is built in one place.
- `repositories/user.repository.ts` has a new `lockUser` (decision 6).

## Decisions

### 1. The router is mounted inside `ownUserRouter`

**How:** `ownUserRouter.use('/ratings', ratingRouter)`.

**Why:** `authenticate` and `authorizeSelf` are attached to `ownUserRouter` once, so the rating routes cannot forget them.
The `401` and `403` required by the task needed no new code, only tests.
A router of its own keeps "one router per resource" (2-D.2).

### 2. A title is referenced as `{ url, name }`

**Why:** `docs/api-design.md` 2.4 decided that a reference to another resource is an object with its `url` and a label called `name`, and the rating follows it.

**Note:** the task cards for A, B and C write `{ url, title }`.
We keep `name`: the design document is the rule, and the task cards are the ones that differ.

### 3. `PUT` replaces the whole rating, comment included

**How:** `{ "rating": 4 }` on a rating that had a comment stores the rating 4 with `comment: null`.

**Why:** `PUT` means "this is the resource now".
The rating form sends both fields at once, so nothing is lost by accident.

**Rejected:** keeping the old comment when the field is missing.
Then a client could not tell "leave it" from "remove it" without a special value, and that is what `PATCH` is for.

### 4. `PUT` answers `200`, also for a first rating

**Why:** `docs/api-design.md` 1.6 already decided this for everything the client addresses itself (bookmark, rating, genre).
The body is the stored rating, read back inside the same transaction, so it is exactly what a `GET` returns.

**Rejected:** `201` for a first rating. It is also correct HTTP, but the client would have to handle two success codes and learns nothing from the difference.

### 5. Rating and comment are saved in one transaction (2-D.4)

**How:** `saveRating` in `rating.service.ts` calls `withTransaction` and passes its client to `rateTitle`, `setRatingComment` and `findRating`.
If anything throws, `withTransaction` sends `ROLLBACK`.

**Why:** `rate` and `set_rating_comment` are two database calls.
Without the transaction, a failure between them would leave a new rating without its comment, or a changed rating that still shows the comment written for the old one.
The rollback also undoes what `rate` did to `title_ratings` and what the trigger did to `name_ratings`.

If `set_rating_comment` returns `false` (no rating to attach to), the service throws, which rolls back too.
It cannot happen in normal use, but silently answering `200` with a lost comment would be worse than a `500`.

**Rejected:** one new database function `rate_with_comment`.
It would also be atomic, but 2-D.4 asks us to show transaction handling in the backend, and everyone would have to rebuild their database.

### 6. The user's row is locked while a rating is written

**How:** `lockUser` runs `SELECT 1 FROM app_user WHERE userid = $1 FOR NO KEY UPDATE` as the first query of the transaction, in both `PUT` and `DELETE`.

**Why:** `rate` first reads "has this user rated this title?" and then updates the average.
Two requests from the same user at the same moment (a double click on the rating button) both read "no", both add a vote, and the second then fails on the primary key of `rating_history` with a `500`.
With the lock, the second request waits for the first and then sees its rating.
A test sends five identical `PUT`s at once and checks five `200`s and one vote.

The same query answers "does this user still exist?".
A user deleted after logging in still has a valid token (`docs/api-design.md` 4.3); the lock finds no row and the service answers `401`, as the other endpoints do.

`FOR NO KEY UPDATE` instead of `FOR UPDATE`: it does not block inserts that reference the user, so the same user's bookmark or search-history request never waits for a rating.

**Rejected:**

- Catching the primary key error and trying again: more code, and it hides the cause.
- Changing `rate` to use `INSERT ... ON CONFLICT`: the right fix in the long run, but it changes a Subproject 1 function for a rare case.

### 7. Reading one rating uses SQL in the repository, not a new database function

**Why:** there is no database function for one rating, and `get_rating_history` can only page through all of them.
A four-line `SELECT` in `rating.repository.ts` needs no database change, so nobody has to rerun `D1_functionality.sql`.
`title.repository.ts` and `findCredentialsByUsername` already read tables directly for the same reason.
The query returns the same columns as `get_rating_history`, so both share `RatingRow` and the mapper.

### 8. Unknown title: checked before the transaction

**How:** `saveRating` calls `findTitleById` first and throws `404 Title tt… not found`.

**Why:** without the check, `rate` fails with a foreign key error, which would become a `500`.
The check can run outside the transaction because titles are read-only: a title cannot disappear between the check and the rating.

For `GET` and `DELETE` no such check is needed: a title that does not exist is simply a title the user has not rated, and the answer is the same `404`.

### 9. Validation of the body

| Rule | Why |
| --- | --- |
| `rating` must be a JSON whole number from 1 to 10 | The task asks for `400` outside 1-10. `"8"` and `7.5` are rejected too: accepting them would mean guessing what the client meant, and the database would round 7.5. The database checks the range again (`rate` and a `CHECK` constraint), so a bug in the API cannot store a wrong value. |
| `comment` is optional, `null` or text | A rating without a comment is the normal case (story R2 is separate from R1). |
| `comment` is trimmed, and empty means `null` | `docs/api-design.md` 2.2: a missing value is always `null`, never `""`. |
| `comment` at most 2000 characters | The column is `TEXT` with no limit; without one, a client could store megabytes. 2000 is a long paragraph. The number is a judgement, easy to change in `rating.controller.ts`. |
| A comment with the character `U+0000` is a `400` | PostgreSQL cannot store it in text, so it would be a `500` otherwise. |

Checks run in this order: token (`401`), user id (`400`, `403`), title id (`400`), body (`400`), title exists (`404`).
Cheap checks come first, and nothing touches the database before the request is known to be well-formed.

### 10. The list is ordered by title and has no "rated at" date

**Why:** that is what `get_rating_history` returns, and `rating_history` has no time column.
"Newest first" would need a new column and a change to the function; it can be added if the frontend needs it.

## Limitations

- `GET` of the list or of one rating for a user deleted after logging in answers an empty page or `404`, not `401`.
  Both are true statements about that user's ratings, and checking the user on every read would cost a query each time.
  `PUT` and `DELETE` do answer `401`.
- `GET /api/titles/:id` does not show the average rating yet (task F), so the tests read `title_ratings` directly to see the average change.
- Averages are stored with one decimal (`NUMERIC(5,1)`), so on a title with many votes, adding and removing a vote can leave the average 0.1 off.
  That is how `rate` and `unrate` from Subproject 1 work, not something the API adds.

## Tests

| File in `backend/test/` | Checks |
| --- | --- |
| `ratings.api.test.ts` | Every endpoint over HTTP: the success case and each error status. |
| `ratings-transaction.api.test.ts` | The rollback when saving the comment fails. |
| `rating.mapper.test.ts` | The JSON shape, without the database. |
| `helpers/test-ratings.ts` | Finds unrated titles, reads a title's average, removes test ratings. |

The two "done when" tests of the task:

- **The average changes after `PUT` and `DELETE`** (`ratings.api.test.ts`, "the title's average rating").
  On a title nobody has rated: Alice rates 10 (average 10, 1 vote), Bob rates 5 (7.5, 2 votes), Bob changes to 7 (8.5, 2 votes), Bob deletes (10, 1 vote), Alice deletes (no rating left).
- **The transaction rolls back when the comment fails** (`ratings-transaction.api.test.ts`).
  A valid request cannot make `set_rating_comment` fail, because everything the database would refuse is already a `400`.
  So the test wraps the repository function `setRatingComment` with `vi.mock`: it calls the real function unless a test tells it to fail once.
  The rest is real: the HTTP request, `rate`, the transaction and the database.
  It checks that a new rating is not stored and the average is unchanged, and that a changed rating keeps its old value, comment and average.

### How the tests leave the database as it was

A rating changes `title_ratings`, which is IMDB data.
Deleting the test user removes their `rating_history` rows (`ON DELETE CASCADE`) but would leave their votes in the averages.

1. The tests only rate titles that have no rating at all.
   The average then consists of test votes only, the arithmetic is exact, and `unrate` deletes the `title_ratings` row with the last vote.
2. `afterAll` calls `unrate` for every rating of the test users before deleting them, also when a test failed halfway.
3. `afterAll` then checks that the titles are unrated again.

The two test files run at the same time, so they take different unrated titles (offset 0 and offset 5).
