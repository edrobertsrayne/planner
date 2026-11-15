# Development

Working rules for coding agents are in [AGENTS.md](../AGENTS.md); this file covers what a person
needs to build, test and change the planner. Domain terms are in [GLOSSARY.md](../GLOSSARY.md), and
the reasons behind design choices are in [docs/adr/](adr/). Read both before changing the model.

## Setup

```sh
mise install          # optional: installs Node 26 from mise.toml
npm ci
cp .env.example .env
```

Fill in `.env` for local use:

```sh
DATABASE_URL=dev.db
ORIGIN=http://localhost:5173
BETTER_AUTH_URL=http://localhost:5173
BETTER_AUTH_SECRET=<any 32+ characters>
```

Auth fails silently on any port other than the one `ORIGIN` names, so run the dev server on 5173
(`npm run dev -- --port 5173 --strictPort`). `.env` is git-ignored, as are `*.db` files and the
`attachments/` folder beside the database.

The git hooks install on `npm install` (`prepare` runs `husky`).

## Scripts

| Script                      | Does                                                                      |
| --------------------------- | ------------------------------------------------------------------------- |
| `npm run dev`               | Vite dev server                                                           |
| `npm run build`             | Production build to `build/` (adapter-node)                               |
| `npm run preview`           | Vite preview of the build                                                 |
| `npm start`                 | Run `build/` with `.env`; see [deployment](deployment.md)                 |
| `npm run check`             | `svelte-kit sync` then `svelte-check`                                     |
| `npm run lint`              | Prettier `--check`, ESLint with zero warnings, markdownlint               |
| `npm run format`            | Prettier `--write`                                                        |
| `npm run test:unit`         | Vitest in watch mode; add `-- --run` for one pass                         |
| `npm run test:e2e`          | Playwright                                                                |
| `npm test`                  | Unit (once) then e2e                                                      |
| `npm run db:generate`       | Generate a migration from `schema.ts`                                     |
| `npm run db:push`           | Push the schema straight to the database (dev only; no migration written) |
| `npm run db:migrate`        | Apply migrations with drizzle-kit (the app also does this on startup)     |
| `npm run db:studio`         | Drizzle Studio                                                            |
| `npm run auth:schema`       | Regenerate `src/lib/server/db/auth.schema.ts` from the Better Auth config |
| `npm run reset:credentials` | Delete the account so the setup wizard runs again                         |

`drizzle.config.ts` requires `DATABASE_URL`.

## Layout

```text
src/
  hooks.server.ts            request pipeline (see architecture.md)
  lib/
    server/planner/          the planner seam: every domain rule and write
    server/db/               Drizzle schema, client, Better Auth schema
    server/backup/           Backup and Restore (tar streaming)
    server/                  api-key, api-helpers, guard, zone, auth, setup, feedback …
    calendar/                Term and Teaching Week generation
    client/                  browser-only helpers (drag, save, confirm)
    components/              app components; components/ui is shadcn-svelte
  routes/
    (app)/                   the six screens, Lessons, Settings
    api/                     the Planning API
    login/ setup/ session/ backup/ attachments/ logout/
drizzle/                     migrations, one folder each with migration.sql and snapshot.json
e2e/                         Playwright specs (*.e2e.ts); the-planning-api/ drives the API
scripts/                     reset-credentials, demo-db, e2e-fixtures
docs/                        this documentation, ADRs, the API spec, research, backlog
```

## Tests

The project is test-driven: write a failing test, make it pass with the least code, then refactor.
Test each behaviour at the lowest level that can see it.

| Level      | Files                     | Runs in                                     | Use for                                                       |
| ---------- | ------------------------- | ------------------------------------------- | ------------------------------------------------------------- |
| Unit       | `src/**/*.test.ts`        | Node (Vitest `server` project)              | Seam functions, pure helpers, hooks logic                     |
| Component  | `src/**/*.svelte.test.ts` | Headless Chromium (Vitest `client` project) | Svelte components                                             |
| End to end | `e2e/*.e2e.ts`            | Playwright, built server                    | Routing, reload, auth, writes, files, touch, app-shell layout |

Test behaviour, not implementation: drive the interface a user sees (page, form action, seam
function), and take the expected value from the requirement. Vitest runs with
`expect.requireAssertions`, so a test with no assertion fails.

Unit tests need no `.env`: `vite.config.ts` supplies `DATABASE_URL=:memory:` and test values for
`ORIGIN`, `BETTER_AUTH_URL` and `BETTER_AUTH_SECRET` when `VITEST` is set.

### End to end

Playwright builds the app and serves it with `npm run build && npm run start` on port 4173, against
a scratch database `e2e.db` (deleted before every run) and a fixed clock, `PLANNER_NOW`
(`2026-11-04`, from `e2e/helpers.ts`), so nothing depends on the real date. It runs one worker, since
there is one server and one database; each spec file resets the database first, so any file runs
alone. A failed test leaves a trace in `test-results/`.

```sh
npx playwright test e2e/the-calendar-layout.e2e.ts -g "name of the test"
npx playwright show-trace test-results/<test>/trace.zip
```

`playwright.config.ts` uses `/usr/bin/chromium` if present; otherwise install a browser with
`npx playwright install chromium`. The full suite takes several minutes in CI, so when changing a
default or visible behaviour, search `e2e/` as well as the unit tests for the old behaviour, and run
the affected spec before pushing.

The API suite is in `e2e/the-planning-api/` and runs over real HTTP:

```sh
npm run test:e2e -- e2e/the-planning-api
```

### Demo database

`scripts/demo-db.ts` builds a realistic database through the planner seam: three Classes, two
Courses, Lessons with Markdown and maths, taught Sessions from the last two weeks, untaught Lessons
ahead and a Teaching note. Use it for prototypes, screenshots and manual smoke tests.

```sh
npx tsx scripts/demo-db.ts seed /tmp/demo.db        # the file must not exist
DATABASE_URL=/tmp/demo.db npm run dev -- --port 5173 --strictPort
npx tsx scripts/demo-db.ts user http://localhost:5173
```

The last command creates the login through `/setup`, using the e2e credentials
(`teacher@example.com` / `a-very-long-password`). Keep your own `dev.db` out of it.

## Migrations

Every schema change ships as a generated migration, and history is append-only
([ADR-0003](adr/0003-migrations-from-the-first-commit.md)). Never edit or squash an applied one.

1. Change `src/lib/server/db/schema.ts`.
2. `DATABASE_URL=dev.db npm run db:generate`.
3. **Read the generated `migration.sql`.** drizzle-kit rebuilds a table (create, copy, drop, rename)
   for constraint changes. That is safe here, but usually unnecessary: replace it with a plain
   `ALTER TABLE` where one does the job.
4. Keep the `snapshot.json` that drizzle-kit writes beside the SQL. Without it the next generate
   tries to recreate tables that exist. Afterwards, `npm run db:generate` must report no changes.

The app applies pending migrations on startup (`runMigrations` in `src/lib/server/db/index.ts`),
each in its own transaction with foreign keys off and a `PRAGMA foreign_key_check` before commit. A
rebuild of a referenced table therefore keeps its children, and a migration that leaves an orphan
row is refused and not recorded. Do not write `PRAGMA foreign_keys` in a migration file; inside a
transaction it does nothing. A folder with no `migration.sql` (the baseline snapshot) is ignored.

SQLite facts that are easy to get wrong. Verify against the bundled SQLite with a throwaway
`:memory:` script before designing around a limit, because most written guidance predates these:

- `ALTER TABLE … ADD COLUMN … CHECK (…)` works on populated, referenced tables with no rebuild.
- `ALTER TABLE … ALTER COLUMN … DROP NOT NULL` works with foreign keys on.
- `DROP CONSTRAINT` and `ADD CONSTRAINT` work, but need a **named** constraint, so name every
  `check()`.
- Adding a column with `REFERENCES` and a non-NULL default is rejected: add it nullable.
- `text('col', { enum: […] })` is a TypeScript type only. Add `check()` for a database guard.

A migration may be hand-edited, including one-off backfills; see
`drizzle/20260823000000_class_tone/` for the pattern (the `ALTER TABLE`, then the `UPDATE`, with a
comment saying what the backfill mirrors in application code).

Better Auth's tables are generated: after changing the auth config, run `npm run auth:schema`.

## Conventions

- **Use the glossary's words**, never the synonyms it lists under _Avoid_. User-visible text,
  identifiers, tests and commits all follow it.
- **The seam owns every value rule** ([ADR-0025](adr/0025-the-seam-owns-every-value-rule.md)).
  Form actions, the API and the Session routes parse input into typed values at the door, call a
  function in `src/lib/server/planner/`, and map `Refused` to a status. Do not repeat a rule in a
  door.
- **Subtract before you add.** Remove dead code and stale tests first. Make the smallest diff that
  solves the problem and put each decision in one place.
- **Fix bugs where the wrong state starts**, after reproducing them. A guard that hides a fault is
  not a fix.
- **No pupil data**, ever ([ADR-0001](adr/0001-no-pupil-identifiable-data.md)).
- **Svelte 5 runes** only; the Vite config forces runes mode outside `node_modules`.
- **UI** is shadcn-svelte on the project's own tokens (`src/routes/layout.css`,
  [ADR-0012](adr/0012-shadcn-svelte-on-our-own-tokens.md)). Add components with `shadcn-svelte`;
  they land in `src/lib/components/ui/`.
- **Formatting**: Prettier with tabs, single quotes, 100 columns, and the Svelte and Tailwind
  plugins. `GLOSSARY.md` is additionally wrapped at 100 columns by markdownlint.
- **Ideas out of scope** go in [docs/backlog.md](backlog.md) (dated, newest first). Read it before
  proposing a feature.
- **Decisions** that change the model or the architecture get an ADR in `docs/adr/`, numbered in
  sequence. Amend an ADR with a dated note instead of rewriting history, and update the glossary
  when a term changes.
- **Issues** are tracked in GitHub Issues.

## Git hooks and CI

- `pre-commit`: `lint-staged` formats and lints the staged files (Prettier, ESLint with zero
  warnings, markdownlint for `GLOSSARY.md`).
- `pre-push`: `npm run check`.
- CI (`.github/workflows/ci.yml`) runs on pushes and pull requests to `main`, in order: lint
  (`npm audit --omit=dev --audit-level=high`, `npm run lint`, `npm run check`), then the full test
  suite with Playwright. A failure stops the later jobs. Failed e2e runs upload their traces as an artifact for seven days.
- A second workflow runs an opencode agent when a comment contains `/oc` or `/opencode`.

## Pull requests

Describe the change with a diagram, and add before and after screenshots for any UI change. Past
examples of the screenshots are under `docs/pr-assets/<change>/`; a seeded [demo database](#demo-database)
gives both shots the same data.
