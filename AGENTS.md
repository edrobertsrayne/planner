# planner

An electronic teacher planner. Self-hosted, single-user, UK state secondary school.
Runtime: Node. Package manager: npm.

## Tests

Test-driven: write a failing test (red), make it pass with the least code (green), then refactor.
Test each behaviour at the lowest level that can see it: unit, then component
(`*.svelte.test.ts`), then e2e only for what needs the running app (routing, reload, auth, writes,
files, touch, app-shell layout).

When changing a default or visible behaviour, search `e2e/` as well as unit tests for the old
behaviour, without truncating the output. Run the affected spec locally
(`npx playwright test e2e/<file> -g "<name>"`) before pushing: CI's e2e job takes about 9 minutes.

In a cloud container (Node 22, mismatched Chromium) `npm ci` needs `--engine-strict=false`, `/usr/bin/chromium`
must link to `/opt/pw-browsers/chromium` for e2e, and component tests need a throwaway vitest config
passing that path as `launchOptions.executablePath`. Delete those afterwards; none belongs in the repo.

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

## Pull requests

Write every PR body with a diagram of the change, and before/after screenshots of any UI change.
