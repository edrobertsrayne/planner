# planner

An electronic teacher planner. Self-hosted, single-user, UK state secondary school. Package manager: bun.

## Favour the simple implementation

This planner has one user and one school year. Build the simplest thing that meets the stated need.

- Build for one user, one year, and the callers that exist.
- Prefer no code to code. A rule that costs a query, a lookup or an ordering constraint must earn it.
- Validate only what the app's own forms can send wrong. Read the fields you need; ignore the rest.
- Enforce a rule at every entry point, or at none.

When you find a simpler approach than the one agreed, say so before you build it.

## Tests

Run every check with `bun run test`. You can run one e2e file alone: `bun run test:e2e -- e2e/the-backup.e2e.ts`.
Each e2e file starts with `test.beforeAll(() => resetTo('standard'))`, or `resetTo('empty')` for the first-run wizard.
`resetTo` in `e2e/helpers.ts` clears the e2e database and writes a known state. No file depends on another file.
Put this call first in each new e2e file. If a file needs more data, make that data in the file.
Shared e2e helpers live in `e2e/helpers.ts`; import from there before you write a local copy.
You can run a unit test file alone: `bun run test:unit -- --run <file>`.
Install the test browser once per machine: `bunx playwright install chromium`.
A fresh worktree has no `node_modules`. Run `bun install` there before any check or test.

## Prototyping

Disable the auth guard in a prototype, unless the prototype tests the authentication pages.
Before you ask the teacher about a prototype, serve it and open it in the teacher's browser (`xdg-open <url>`).
Check first that the URL reaches your own server and that the login works.

## Agent skills

- Issues: GitHub Issues on `edrobertsrayne/planner` via `gh`. See `docs/agents/issue-tracker.md`.
- Triage labels: each label string equals its role name. See `docs/agents/triage-labels.md`.
- Domain: single context, `GLOSSARY.md` and `docs/adr/`. See `docs/agents/domain.md`.
- Before you write a migration, read `docs/agents/migrations.md`.
- Backlog: add ideas you put out of scope to `docs/backlog.md`. Read it before you propose a feature.

## Attach files to issues and PRs

Use `gh issue|pr create|edit|comment --attach <file>` to upload a local image or video.

- Set alt text with `--attach 'path/to/image.png#Alt text'`. Videos have no alt text.
- To place a file inside the body, write `![alt](path/to/image.png)` and attach the same path.
  `gh` replaces the local path with the uploaded URL.
  A video reference must be the only content in its paragraph.
- `gh` appends each attached file that the body does not reference.

Example: `gh pr create --title "..." --body-file body.md --attach screenshots/home.png`

## Communication style

- Give brief context before the main point.
- Write in ASD-STE100 Simplified Technical English: short sentences, one instruction per sentence, active voice, approved words only.
- Use the terms in `GLOSSARY.md`. Do not use the synonyms that it lists to avoid.
