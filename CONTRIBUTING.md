# Contributing

The rules we all follow.
To change one, update this file.

## Tools

| Tool | Status |
| --- | --- |
| TypeScript 7, strict mode | In place |
| node-postgres (`pg`), one shared pool | In place |
| `.editorconfig` (needs the VS Code extension EditorConfig) | In place |
| Biome (formatting and linting), VS Code format on save (needs the VS Code extension Biome) | In place |
| Express 5 | In place |
| Vitest and supertest (tests) | In place |

We use Biome instead of Prettier and ESLint because typescript-eslint does not support TypeScript 7 yet.
Biome does both jobs in one tool and does not depend on the TypeScript version.

Packages are pinned to exact, stable versions (`backend/.npmrc` does this for `npm install`), so everyone runs the same code.

## Backend layers

A request goes through the layers from top to bottom.
A layer may only call the layer directly below it, never one above.

| Folder in `backend/src/` | Does | Never does |
| --- | --- | --- |
| `routes/` | Maps a URL and HTTP method to a controller. One router per resource. | Logic of any kind |
| `controllers/` | Validates path and query parameters (400 when invalid), calls the service, sends the JSON. | SQL, business rules |
| `services/` | Business rules: for example "log the search when the user is logged in", "hash the password". Throws `NotFoundError` and the other errors in `middleware/errors.ts`. | Anything about HTTP (`req`, `res`) |
| `repositories/` | All SQL, through the shared pool. Returns raw rows. | Building the JSON the API sends |
| `mappers/` | Turns a database row into the object the API sends: camelCase names, a `url` field, `null` for missing values. | SQL |
| `types/` | The row type (`TitleRow`) and the API type (`TitleDto`) of each resource. | Code |

`middleware/` holds what runs for every request, such as the error handler.
`src/scripts/` holds developer tools such as `db-check.ts`, which are not part of the API.

## API design

URLs, JSON fields, paging and authentication follow [docs/api-design.md](docs/api-design.md).
A new endpoint that needs a different rule changes that file first.

## Code rules

- **Clear names**: `findTitleById`, not `getData`.
- **Comments explain why**, not what the code does.
- **Small functions** that do one job.
- **No `any`**: use a real type, or `unknown` and check it.
- **SQL only with parameters**, never by joining strings (prevents SQL injection, required by 2-D.3):

  ```ts
  pool.query('SELECT * FROM title_basic WHERE tconst = $1', [id]);   // yes
  pool.query(`SELECT * FROM title_basic WHERE tconst = '${id}'`);    // never
  ```

- **SQL only in `src/repositories/`**.
  The one exception is `src/scripts/`, whose developer tools are not part of the API.
- **Errors are thrown, not handled**: throw an error from `middleware/errors.ts` and let the error handler send it.
  Never write `try/catch` in a controller just to send an error response.
- **Error messages are shown to the client**, so they never contain SQL, table names or stack traces.
- **Secrets only in `backend/.env`**, never in git. New settings go in `.env.example` and `src/config/index.ts` too.

## Tests

Tests live in `backend/test/` and run with `npm test`.

- **Mappers and other code without the database**: a unit test, like `title.mapper.test.ts`.
- **Every endpoint**: at least one API test with supertest in `api.test.ts` or a new `<resource>.api.test.ts`.
  Test the success case and each error status the endpoint can return.
- **Tests that write to the database** run inside a transaction that is rolled back at the end, so they leave no rows behind and give the same result every run.

## Database changes

The API calls the functions in `database/D1_functionality.sql`, so changing one can break the backend.
When you change a function the API uses:

1. Update the repository that calls it, and run `npm test`.
2. Add a line to `database/CHANGES.md` saying what changed and why.
   That file becomes the "changes to Subproject 1" section of the report.
3. Tell the group, because everyone has to rerun the changed script on their own database.

## Git

- `main` is the shared branch where finished work comes together.
- Never work on `main` directly: one branch per task, created from `main`, for example `names-endpoints`.
- Small commits, one topic each.
- Before pushing, from `backend/`: `npm run lint`, `npm run build` and `npm test` must pass.
  `npm run lint:fix` fixes most lint and formatting problems by itself.
- When the task is done, merge `main` into your branch first and run the checks again, then merge your branch into `main` and push.
