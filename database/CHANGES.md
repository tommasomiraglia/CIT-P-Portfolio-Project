# Changes to Subproject 1 for Subproject 2

This file lists what we changed in the Subproject 1 database scripts while building the API, and why.
Most changes are in commit `23b6816` ("Major update"); the trigger fix and the new `F1_test.sql` came after it.
Use it as the source for the "Changes to Subproject 1" section of the Subproject 2 report.

## Why we changed anything

The Subproject 1 functions were written to be called by hand in `psql`.
The REST API calls them on every request, which exposed four problems:

1. **Side effects on reads.** The search functions wrote to `history` themselves, so a `GET` request changed data, every page of results was logged again, and searching required a user.
2. **No paging.** Most functions returned every row, but the API must return results page by page (2.A.3).
3. **Ambiguous identifiers.** Some functions found a person by name, but names are not unique; the API identifies a person by `nconst`.
4. **No feedback.** Functions returned `VOID`, so the API could not tell "created" from "already there" or "deleted" from "not found".

## C2_build_framework_db.sql

- `history` has a new surrogate key `historyid` (`BIGSERIAL`).
  The old key `(userid, time)` was not unique, because `now()` returns the same value for every statement in one transaction.
- `history.time` now defaults to `clock_timestamp()` (the real current time) and `value` is `NOT NULL`.
- `history_name_basic` and `history_title_basic` now reference `history(historyid)` instead of `(userid, time)`.

## B2_build_movie_db.sql

- `name_ratings` is computed from `DISTINCT (tconst, nconst)` pairs.
  `title_principals` repeats a person for the same title (for example actor and producer), so a title was counted several times in a person's rating.

## D1_functionality.sql

### Searches no longer write history

- `string_search`, `structured_string_search` and `search_names` no longer take `p_userid` and no longer insert into `history`.
- The new function `add_search_history(userid, value)` records a search; the backend calls it once per search, only for a signed-in user.
- `structured_string_search` now requires every non-empty field to match (`AND`), as 1.D.4 describes, and returns nothing when all four fields are empty.

### Paging and stable order

- Every function that returns a list now takes `p_limit` and `p_offset`.
- Every list is ordered with a tiebreaker on the id (`tconst`, `nconst` or `historyid`), so the same row never appears on two pages.
- Search results return `tconst` and `primarytitle` (instead of `id` and `title`), so a client can show a result list without one request per title.

### People are identified by `nconst`

- `co_players` takes `p_nconst` instead of a name.
- `search_by_exact_name` is renamed `person_words` (the name used in 1.D.10) and takes `p_nconst`.

### Return values for the API

- `delete_user`, `bookmark_title`, `remove_bookmark_title`, `bookmark_person` and `remove_bookmark_person` return `BOOLEAN` instead of `VOID`.
  The API uses this to answer `201`/`200` or `404`.

### New functions

| Function | Purpose |
|---|---|
| `get_user` | Reads one user, without the password. |
| `update_user` | Updates a user; a `NULL` argument leaves that field unchanged. |
| `add_search_history` | Records one search (see above). |
| `delete_search_history_entry` | Deletes one history entry of a user. |
| `clear_search_history` | Deletes all history of a user and returns how many entries were removed. |
| `unrate` | Removes a user's rating and updates the title's average. |
| `set_rating_comment` | Adds or changes the comment on an existing rating. |
| `add_genre_preference`, `remove_genre_preference`, `get_genre_preferences` | Manage a user's favourite genres. |

### Rating (`rate` and the name rating trigger)

- `rate` takes the title id as `VARCHAR(10)` instead of `CHAR(10)`, the type used everywhere else.
- `rate` rejects values outside 1-10.
- `rate` creates the `title_ratings` row when a title gets its first vote; before, that vote was silently lost.
- The trigger now fires after `INSERT`, `UPDATE` and `DELETE`, creates missing `name_ratings` rows, counts each title once per person (same formula as B2), and removes the name rating of a person with no rated titles left.
  `DELETE` is needed because `unrate` deletes the `title_ratings` row when it removes a title's last vote; without it, the people in that title kept a rating that still counted the removed vote.

### Better results

- `co_players` and `popular_actors_in_movie` consider only `actor` and `actress` roles and count each title or person once.
- `popular_actors_in_movie` also returns the number of votes behind each rating.
- `similarity_search` compares only titles of the same type (a movie with movies) and breaks ties by number of votes.
- `exact_match_search` counts distinct query words, so a repeated word no longer gives an empty result.
- `person_words` and `words_query` count only title and plot words, and return 10 words by default instead of 5.
- `words_query` leaves out the query words themselves.

### Other

- `wi.tconst` is converted from `CHAR(10)` to `VARCHAR(10)` if needed, so it matches `title_basic.tconst`.

## F1_test.sql

- `F1_test.sql` was a copy of the old `D1_functionality.sql`, so running it put the old function versions back.
  It now calls every D1 function with the new signatures, inside a transaction that is rolled back at the end.
- It checks the important behaviour itself and stops with `FAIL: ...` when it is wrong: searches must not write to history, `rate` must reject 11, and `name_ratings` must be correct after the first vote on a title and after that vote is removed.

## D2_indexes.sql

- The plain B-tree index on `name_basics(primaryname)` is replaced by trigram (`pg_trgm`) GIN indexes on `name_basics(primaryname)` and `title_basic(primarytitle)`.
  A B-tree index cannot help `ILIKE '%text%'`, a trigram index can.
- New index on `history(userid, time DESC)` for reading one user's history newest first.
- New indexes on `wi(word, tconst)`, `wi(tconst)` and `weights(word) INCLUDE (tconst, weight)` for the IR functions 1.D.10-1.D.14.
