# planner

An electronic teacher planner. Self-hosted, single-user, UK state secondary school.
Package manager: bun.

## Tests

Test-driven: write a failing test (red), make it pass with the least code (green), then refactor.
Test each behaviour at the lowest level that can see it: unit, then component
(`*.svelte.test.ts`), then e2e only for what needs the running app (routing, reload, auth, writes,
files, touch, app-shell layout).

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
