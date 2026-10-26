# planner

An electronic teacher planner. Self-hosted, single-user, UK state secondary school.
Package manager: bun.

## Favour the simple implementation

This planner has one user and one school year. Build the simplest thing that meets the stated need.

- Build for one user, one year, and the callers that exist.
- Prefer no code to code. A rule that costs a query, a lookup or an ordering constraint must earn it.
- Validate only what the app's own forms can send wrong. Read the fields you need; ignore the rest.
- Enforce a rule at every entry point, or at none.

When you find a simpler approach than the one agreed, say so before you build it.

## Coding standards

Follow `CODING_STANDARDS.md` for all code.

## Tests

Test-driven: write a failing test (red), make it pass with the least code (green), then refactor.
Test each behaviour at the lowest level that can see it: unit, then component
(`*.svelte.test.ts`), then e2e only for what needs the running app (routing, reload, auth, writes,
files, touch, app-shell layout).

## Commits and PRs

Commit to `main`. Open a PR only for a one-way change (a migration that deletes or changes data,
auth, the backup, stored data formats) or one the teacher should approve first.

## Prototyping

Disable the auth guard in a prototype, unless it tests the auth pages. Serve it and open it in the
teacher's browser (`xdg-open <url>`) before asking about it.

## Reference

- Issues: GitHub Issues via `gh` (`docs/agents/issue-tracker.md`); labels in
  `docs/agents/triage-labels.md`.
- Domain terms: `GLOSSARY.md`, `docs/adr/` (`docs/agents/domain.md`). Use its terms, never the
  synonyms it lists to avoid.
- Migrations: read `docs/agents/migrations.md` before writing one.
- Backlog: put out-of-scope ideas in `docs/backlog.md`; read it before proposing a feature.
