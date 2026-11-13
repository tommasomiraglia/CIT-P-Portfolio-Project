# CIT/P Portfolio Project

A movie application on IMDB data: a PostgreSQL database (`database/`), a REST API (`backend/`), and later a React frontend.
The assignment is in `docs/project-description.pdf`.
The rules for working on the code are in [CONTRIBUTING.md](CONTRIBUTING.md).

## Project structure

```text
database/           Subproject 1: SQL scripts that build the database
  CHANGES.md        What we changed in Subproject 1 for the API, and why
backend/            Subproject 2: the REST API (TypeScript, Express)
  src/
    routes/         URL -> controller, one router per resource
    controllers/    Validate the request, call the service, send the JSON
    services/       Business rules
    repositories/   All SQL
    mappers/        Database row -> JSON the API sends
    types/          Row and API types of each resource
    middleware/     Error handling and other code that runs for every request
    config/         Reads backend/.env
    db/             The shared connection pool
    scripts/        Developer tools (db-check)
  test/             Vitest tests
docs/               Assignment and reports
  api-design.md     Decisions on URLs, JSON, paging and login
  user-stories.md   What the application lets people do, and the endpoints each story needs
  report/           Draft sections of the Subproject 2 report
```

A request goes down the layers in this order: routes, controllers, services, repositories.
The repository's rows come back up through the mapper.

## Requirements

- PostgreSQL with `psql`
- Node.js 24 or later
- `imdb.backup`, `omdb_data.backup` and `wi.backup` in `database/` (not in git: too large)

## 1. Build the database

Create an empty database, then run from the repository root, in this order:

```powershell
psql -h localhost -U postgres -d imdb -f .\database\imdb.backup
psql -h localhost -U postgres -d imdb -f .\database\omdb_data.backup
psql -h localhost -U postgres -d imdb -f .\database\wi.backup
psql -h localhost -U postgres -d imdb -f .\database\B2_build_movie_db.sql
psql -h localhost -U postgres -d imdb -f .\database\C2_build_framework_db.sql
psql -h localhost -U postgres -d imdb -f .\database\D1_functionality.sql
psql -h localhost -U postgres -d imdb -f .\database\D2_indexes.sql
```

B2 drops the raw tables, so it only works on a freshly loaded database.
When someone changes one of these scripts, rebuild your database from scratch in the same order.
What changed since Subproject 1 is in `database/CHANGES.md`.

`database/F1_test.sql` tests the functions.
It runs in one transaction that it rolls back, so it leaves no rows behind, and it stops with `FAIL: ...` when a check fails.
To regenerate its output, use `cmd /c` so the file stays UTF-8 (PowerShell's `>` writes UTF-16):

```powershell
cmd /c "psql -h localhost -U postgres -d imdb -a -f database\F1_test.sql > database\F1_test_output.txt 2>&1"
```

## 2. Set up the backend

```powershell
cd backend
npm install
copy .env.example .env    # then put your database password in .env
```

`.env` also needs a `JWT_SECRET`, the key that signs login tokens.
Generate your own, and never share or commit it:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Paste the output after `JWT_SECRET=` in `.env`.
The API refuses to start without it.

`PORT` in `.env` sets the port of the API. It is optional and defaults to 3000.
`CORS_ORIGINS` lists the web pages allowed to call the API from a browser, separated by commas.
It is optional and defaults to `http://localhost:5173`, where the frontend's dev server runs.

In VS Code, install the extensions EditorConfig and Biome when VS Code suggests them.
Biome then formats TypeScript and JSON files every time you save.

## 3. Check that everything works

```powershell
cd backend
npm run db:check
```

It only reads from the database.
Expected output:

```text
Connected to database "imdb" as user "postgres"
  OK      table title_basic
  OK      table app_user
  OK      function string_search
Database check passed.
```

| If you see | Fix |
| --- | --- |
| `Missing required environment variable(s): ...` | Fill in those values in `backend/.env` |
| `password authentication failed` | Wrong `DB_PASSWORD` in `backend/.env` |
| `ECONNREFUSED` | PostgreSQL is not running, or `DB_HOST`/`DB_PORT` is wrong |
| `database "..." does not exist` | Wrong `DB_NAME`, or step 1 was not done |
| `MISSING table ...` / `MISSING function ...` | A script from step 1 was not run |

## 4. Run the API

All commands run from `backend/`.

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts the API in watch mode: it restarts on every change in `src/`. Use this while developing. |
| `npm run build` | Compiles TypeScript from `src/` into `dist/`. Must pass before pushing. |
| `npm start` | Runs the compiled API from `dist/`. Run `npm run build` first. |
| `npm test` | Type-checks `src/` and `test/`, then runs the tests in `test/` with Vitest. |
| `npm run lint` | Checks formatting, import order and lint rules with Biome. Must pass before pushing. |
| `npm run lint:fix` | Fixes what Biome can fix by itself. |
| `npm run db:check` | Checks the database connection (see step 3). |

Stop the server with Ctrl+C.
It finishes the requests in progress and closes the database connections before exiting.

The tests use the database configured in `backend/.env`, so step 1 must be done and PostgreSQL must be running.
Tests that write delete what they created, so the database stays as it was.
Files ending in `.api.test.ts`, and `api.test.ts`, send real HTTP requests to the API; the others test one part on its own.

## Endpoints

| Method and path | Response |
| --- | --- |
| `GET /api/health` | `200 {"status":"ok"}`, or `503` if the database does not answer |
| `GET /api/titles/:id` | `200` with the title, `400` if `:id` is not a title id like `tt0052520`, `404` if no title has that id |
| `GET /api/titles?search=…` | `200` with one page of matching titles (`page`, `pageSize`), `400` for a missing or invalid parameter; saved to the history when a token is sent |
| `POST /api/users` | Registers a user: `201` with the user and a `Location` header, `400` for an invalid field, `409` if the username or email is taken |
| `POST /api/auth/login` | `200` with a token and the user, `401` for a wrong username or password |
| `GET /api/users/:userId` | Needs `Authorization: Bearer <token>` for that same user: `200` with the user, `401` without a valid token, `403` for another user |

Example:

```powershell
curl.exe http://localhost:3000/api/titles/tt0052520    # plain "curl" is a different command in PowerShell
```

```json
{
  "url": "/api/titles/tt0052520",
  "id": "tt0052520",
  "title": "The Twilight Zone",
  "type": "tvSeries",
  "isAdult": false,
  "startYear": 1959,
  "endYear": 1964,
  "runtimeMinutes": 50,
  "plot": "The Twilight Zone is a place that exists ...",
  "posterUrl": "https://m.media-amazon.com/images/M/..."
}
```

Missing values are always `null`.

Every error has the same shape, with the matching HTTP status:

```json
{ "error": { "message": "Title tt9999999 not found" } }
```

Unexpected errors return `500` with a generic message.
The details are only written to the server log.
