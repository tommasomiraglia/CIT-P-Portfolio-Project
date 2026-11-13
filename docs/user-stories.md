# User stories

**Draft for the group to revise.**
This file answers requirement 2-A.5: it restates the application design of Subproject 1 (report section 2) as user stories, and derives from them the operations the API must offer beyond those 2-A.1 requires.

Each story names the endpoints of `docs/api-design.md` section 1.5 that it needs.
An endpoint marked **new** is not in that table yet: it is an operation derived from the stories.
The status column says what exists in `backend/` today.

## Who uses the application

- **Visitor**: anyone who opens the application without logging in.
  They can search and browse all movie data.
- **User**: a visitor who registered and logged in.
  They can also rate, bookmark, keep a search history and state preferences.

A user can do everything a visitor can.

## Searching

| Id | Story | Endpoints | Status |
| --- | --- | --- | --- |
| S1 | As a visitor, I want to search titles by a word from their name or plot, so that I can find a movie without knowing its exact title. | `GET /api/titles?search=` | Built |
| S2 | As a visitor, I want to search by title, plot, character and actor at the same time, so that I can find a movie I only half remember ("the one where Ledger plays the Joker"). | `GET /api/titles?title=&plot=&characters=&names=` | To build |
| S3 | As a visitor, I want to search for people by name, so that I can open the page of an actor or director. | `GET /api/people?name=` | To build |
| S4 | As a visitor, I want to search with several keywords and choose whether titles must contain all of them, any of them, or be ranked by how well they match, so that I can widen or narrow my results. | `GET /api/titles?words=&match=exact\|any\|ranked` | To build |
| S5 | As a visitor, I want to see which words often appear together with my keywords, so that I can find better words to search with. | `GET /api/words?words=` | To build |
| S6 | As a visitor, I want long result lists split into pages that I can move through, so that the application stays fast and I am not flooded with results. | `?page=&pageSize=` on every list | Built (helper and S1) |

## Titles and people

| Id | Story | Endpoints | Status |
| --- | --- | --- | --- |
| T1 | As a visitor, I want a title page with poster, plot, year, runtime, genres and rating, so that I can decide whether to watch it. | `GET /api/titles/:id` | Built, but without genres and rating (see "Gaps" below) |
| T2 | As a visitor, I want to see the most popular actors of a title, so that I know who is in it. | `GET /api/titles/:id/actors` | To build |
| T3 | As a visitor, I want to see titles similar to the one I am looking at, so that I can find something else I might like. | `GET /api/titles/:id/similar` | To build |
| T4 | As a visitor, I want to see the alternative titles of a title, so that I can recognise a movie by the name it has in my country. | **new** `GET /api/titles/:id/alternative-titles` | Not designed |
| T5 | As a visitor, I want to see the episodes of a series, so that I can browse it season by season. | **new** `GET /api/titles/:id/episodes` | Not designed |
| P1 | As a visitor, I want a person page with their professions, rating and the titles they are known for, so that I can see who they are. | `GET /api/people/:id` | To build |
| P2 | As a visitor, I want to see the actors a person has worked with most often, so that I can discover related people. | `GET /api/people/:id/co-players` | To build |
| P3 | As a visitor, I want to see the words most typical of a person's titles, so that I get a quick idea of what their work is about. | `GET /api/people/:id/words` | To build |

## Account

| Id | Story | Endpoints | Status |
| --- | --- | --- | --- |
| A1 | As a visitor, I want to register with a username, email and password, so that I can save ratings, bookmarks and searches. | `POST /api/users` | Built |
| A2 | As a user, I want to log in, so that the application knows my data is mine. | `POST /api/auth/login` | Built |
| A3 | As a user, I want to log out, so that nobody else on this computer can use my account. | None: the frontend deletes its token (api-design.md 4.3) | Nothing to build |
| A4 | As a user, I want to see and change my profile, so that my email and phone number stay up to date. | `GET`, `PATCH /api/users/:userId` | `GET` built, `PATCH` to build |
| A5 | As a user, I want to delete my account and all my data, so that I can leave the application. | `DELETE /api/users/:userId` | To build |

## Ratings

| Id | Story | Endpoints | Status |
| --- | --- | --- | --- |
| R1 | As a user, I want to rate a title from 1 to 10 and change my mind later, so that my opinion counts in its rating. | `PUT /api/users/:userId/ratings/:titleId` | To build |
| R2 | As a user, I want to add a comment to my rating, so that I remember why I gave it. | Same `PUT`, with the comment in the body, in one transaction | To build |
| R3 | As a user, I want to see my own rating on a title page, so that I know whether I already rated it. | **new** `GET /api/users/:userId/ratings/:titleId` | Not designed |
| R4 | As a user, I want a list of everything I have rated, so that I can look back at my opinions. | `GET /api/users/:userId/ratings` | To build |
| R5 | As a user, I want to remove a rating, so that a mistaken rating does not count. | `DELETE /api/users/:userId/ratings/:titleId` | To build |

## Bookmarks

| Id | Story | Endpoints | Status |
| --- | --- | --- | --- |
| B1 | As a user, I want to bookmark titles and people, so that I can find them again quickly. | `PUT /api/users/:userId/bookmarks/titles/:titleId`, `.../people/:personId` | To build |
| B2 | As a user, I want a list of my bookmarks, so that I can open them later. | `GET .../bookmarks/titles`, `GET .../bookmarks/people` | To build |
| B3 | As a user, I want to see on a title or person page whether I bookmarked it, so that the bookmark button shows the right state. | **new** `GET .../bookmarks/titles/:titleId`, `.../people/:personId` (`200` or `404`) | Not designed |
| B4 | As a user, I want to remove a bookmark, so that my list only holds what I still care about. | `DELETE .../bookmarks/titles/:titleId`, `.../people/:personId` | To build |

## Search history and preferences

| Id | Story | Endpoints | Status |
| --- | --- | --- | --- |
| H1 | As a user, I want my searches saved automatically, so that I do not have to remember them. | Done by the searches when a token is sent | Built for S1 |
| H2 | As a user, I want to see my past searches, newest first, and run one again with one click, so that I can return to earlier results. | `GET /api/users/:userId/search-history` | To build |
| H3 | As a user, I want to delete one search or my whole history, so that I control what is kept about me. | `DELETE .../search-history/:entryId`, `DELETE .../search-history` | To build |
| G1 | As a user, I want to choose my favourite genres from the list of all genres, so that the application knows what I like. | **new** `GET /api/genres`, and `PUT`, `DELETE /api/users/:userId/genres/:genreId` | `GET /api/genres` not designed, the rest to build |
| G2 | As a user, I want to see my favourite genres, so that I can check and change them. | `GET /api/users/:userId/genres` | To build |
| L1 | As a user, I want to set my preferred language and region, so that alternative titles in my language can be shown first. | Not in the API (api-design.md 4.5 leaves `langid` and `regionid` out) | Group decision, see below |

## Operations beyond 2-A.1

These come from the stories, not from the required functionality.
Each is justified by the stories that need it.

| Operation | Needed by | Why it is worth adding |
| --- | --- | --- |
| Genres and rating in `GET /api/titles/:id` | T1 | The title page of the Subproject 1 design shows them, and both are small and bounded, so they can be embedded (api-design.md 2.4). |
| `GET /api/titles/:id/alternative-titles` | T4, L1 | The Subproject 1 design lists alternative titles on the title page; a title can have dozens, so it is a paged sub-resource rather than an embedded list. |
| `GET /api/titles/:id/episodes` | T5 | Series are titles too; without this a series page has no way to reach its episodes. The index on `title_episode(parentconst)` from Subproject 1 already serves this query. |
| `GET /api/genres` | G1 | The frontend needs the list of genres to offer them as choices. |
| `GET /api/users/:userId/ratings/:titleId` | R3 | Without it, the title page would have to page through the whole rating list to find one rating. |
| `GET .../bookmarks/titles/:titleId` and `.../people/:personId` | B3 | Same reason as R3, for the bookmark button. |

`GET /api/users/:userId` (A4) and `POST /api/auth/login` (A2) are also beyond the list of database functions, but they are already in the endpoint table.

## Gaps and decisions for the group

1. **The title page lacks genres and rating (T1).**
   `GET /api/titles/:id` returns neither yet, though the Subproject 1 design shows both.
2. **Search results are sorted alphabetically, not by relevance (S1).**
   `string_search` orders by title, so searching "twilight zone" lists episodes such as "A Season to Wither" before the series "The Twilight Zone" itself.
   Ordering title matches before plot matches, or by number of votes, would put the expected result first; it is a change to `D1_functionality.sql`.
3. **Reopening past results (H2).**
   The Subproject 1 design links a history entry to the titles and people it found (`history_title_basic`, `history_name_basic`), so past results can be reopened.
   The API only saves the search text.
   The simpler choice is to give each history entry a `url` that runs the search again; the alternative is to save every result, which costs one insert per result on every search.
4. **Language and region preferences (L1).**
   Either add `GET /api/languages` and `GET /api/regions` and accept `langId` and `regionId` in the user, or drop the story.
   It only pays off together with T4.
5. **Which "new" operations to build at all.**
   T4, T5, R3, B3 and `GET /api/genres` are each small, but every one is more code, tests and report.
   R3, B3 and `GET /api/genres` matter most, because the frontend cannot show a correct title page or preferences screen without them.
