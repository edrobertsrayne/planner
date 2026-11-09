# Planner

An electronic teacher planner. Self-hosted, single-user, built for one UK state secondary school
teacher.

It holds what is _planned_ to be taught (Courses, Topics, Lessons), lays that plan onto the real
school calendar (Terms, a two-week Timetable, Blocked Days), and keeps it correct when teaching does
not go to plan: a lost lesson pushes the rest of a Class's Sequence to the right, and nothing is
renumbered by hand.

The planner never stores anything about individual pupils. A Class is a label, a size and a
Timetable ([ADR-0001](docs/adr/0001-no-pupil-identifiable-data.md)).

## What it does

| Screen   | Purpose                                                                                   |
| -------- | ----------------------------------------------------------------------------------------- |
| Agenda   | The upcoming Sessions across every Class, by day. Tick Lessons ready; block days or Slots |
| Calendar | One Teaching Week as a grid of Periods against days; also where the Terms are set up      |
| Classes  | Each Class's Timetable, Rooms and Sequence of Lessons                                     |
| Events   | Recurring commitments that are not Lessons (meetings, clubs, interventions)               |
| Courses  | Courses, Topics and the Lesson editor: Markdown plans, Links, Tags, Attachments           |
| Planning | Which Lessons are drafted, planned and ready, across Classes                              |
| Settings | Change password, API key, Backup                                                          |

Also:

- **Planning API.** An agent with the API key can create and edit Courses, Topics, Lessons, Links
  and Attachments, import a whole Topic in one request, and read and replace the Terms and Blocked
  Days. See [docs/api.md](docs/api.md).
- **Backup and Restore.** One button downloads the database and every Attachment as a tar file;
  the setup wizard restores one into an empty instance.
- **Markdown end to end.** Lesson plans and notes are Markdown with KaTeX maths
  ([ADR-0023](docs/adr/0023-lesson-plans-are-markdown-end-to-end.md)).
- **Phone, tablet and laptop layouts.** The Agenda is the phone's main screen.

The vocabulary (Lesson versus Session, Sequence, Placement, Cover, and so on) is defined in
[GLOSSARY.md](GLOSSARY.md). Read it before reading the code.

## Stack

SvelteKit 2 and Svelte 5 (runes), Tailwind 4 with shadcn-svelte components, Node 26, SQLite through
Drizzle and `better-sqlite3`, Better Auth for the single login, Tiptap for the Markdown editor.
Tests are Vitest (unit and browser components) and Playwright (end to end).

## Quick start

Needs Node 26 (`mise.toml` pins it) and npm.

```sh
npm ci
cp .env.example .env
```

Edit `.env`. For local development:

```sh
DATABASE_URL=local.db
ORIGIN=http://localhost:5173
BETTER_AUTH_URL=http://localhost:5173
BETTER_AUTH_SECRET=<any 32+ characters>
```

`ORIGIN` and `BETTER_AUTH_URL` must match exactly or the server refuses to start. Then:

```sh
npm run dev
```

Open <http://localhost:5173>. The first request lands on the setup wizard, which creates the one
account (or restores a Backup). Migrations run on startup; there is no separate migrate step.

To try the app with realistic data, see the `demo-db` script in
[docs/development.md](docs/development.md#demo-database).

## Documentation

| Document                                               | Contents                                                          |
| ------------------------------------------------------ | ----------------------------------------------------------------- |
| [docs/api.md](docs/api.md)                             | Planning API reference: authentication, every endpoint, errors    |
| [docs/deployment.md](docs/deployment.md)               | Environment variables, build, hosting, volumes, backups, recovery |
| [docs/development.md](docs/development.md)             | Scripts, tests, migrations, CI, conventions                       |
| [docs/architecture.md](docs/architecture.md)           | Request pipeline, the planner seam, scheduling, data model, auth  |
| [GLOSSARY.md](GLOSSARY.md)                             | The domain language                                               |
| [docs/adr/](docs/adr/)                                 | Architecture decision records (why things are the way they are)   |
| [docs/spec/planning-api.md](docs/spec/planning-api.md) | The design specification the API was built from                   |
| [docs/backlog.md](docs/backlog.md)                     | Ideas not yet scoped                                              |
| [AGENTS.md](AGENTS.md)                                 | Working rules for coding agents                                   |

## Common commands

| Command                      | Does                                        |
| ---------------------------- | ------------------------------------------- |
| `npm run dev`                | Dev server on port 5173                     |
| `npm run build` / `start`    | Production build / run it (`build/`)        |
| `npm run check`              | `svelte-check` types                        |
| `npm run lint`               | Prettier, ESLint, markdownlint              |
| `npm run test:unit -- --run` | Vitest once                                 |
| `npm run test:e2e`           | Playwright against a freshly built server   |
| `npm run reset:credentials`  | Delete the account so the wizard runs again |

## Licence

No licence file is present in the repository.
