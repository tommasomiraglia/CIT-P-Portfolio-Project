# Contributing

The rules we all follow.
To change one, agree on it as a group and update this file.

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
- **Secrets only in `backend/.env`**, never in git. New settings go in `.env.example` and `src/config/index.ts` too.

## Git

- Never work on `main`: one branch per task.
- Small commits, one topic each.
- Merge through a pull request reviewed by another group member.
- Before pushing, from `backend/`: `npm run lint`, `npm run build` and `npm test` must pass.
  `npm run lint:fix` fixes most lint and formatting problems by itself.
