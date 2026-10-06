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

Run e2e tests only as the whole suite: `bun run test`. The suite shares one database and one user,
so each file depends on the files before it. One file alone starts on an empty database and stops at
the first-run wizard, with an error about a duplicate "Password" field. That error is not a selector fault.
Shared e2e helpers live in `e2e/helpers.ts`; import from there before you write a local copy.
Playwright runs the e2e files in path order, so name a new file for the place it must take in that order.
You can run a unit test file alone: `bun run test:unit -- --run <file>`.
Install the test browser once per machine: `bunx playwright install chromium`.

## Prototyping

Disable the auth guard in a prototype, unless the prototype tests the authentication pages.

## Agent skills

- Issues: GitHub Issues on `edrobertsrayne/planner` via `gh`. See `docs/agents/issue-tracker.md`.
- Triage labels: each label string equals its role name. See `docs/agents/triage-labels.md`.
- Domain: single context, `CONTEXT.md` and `docs/adr/`. See `docs/agents/domain.md`.
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
- Use the terms in `CONTEXT.md`. Do not use the synonyms that it lists to avoid.
