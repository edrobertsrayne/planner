# planner

An electronic teacher planner. Self-hosted, single-user, UK state secondary school.
Runtime: Node. Package manager: npm.

Checks: `npm run check` (types), `npm run lint`, `npm run test:unit -- --run`, `npm run test:e2e`.

## Changes

Subtract before you add: remove dead code, stale tests and stub references first, in their own
commit, then build on the simpler base. Design for observed use; add no guards, validators or
options the spec does not ask for.

Make the smallest diff that solves the problem. Put each decision in one place and pass its result
on; don't repeat the choice at every call site.

Parse input at the door (form actions, `load`, API handlers, file imports) into typed values, and
trust those types inside the seam. Don't re-check what the door already checked.

To fix a bug, reproduce it first. Then fix it where the wrong state starts, not where it shows up,
and fix every place with the same fault. A guard, retry, swallowed error or clamped value that
hides a fault is not a fix.

## Tests

Test-driven: write a failing test (red), make it pass with the least code (green), then refactor.
Test each behaviour at the lowest level that can see it: unit, then component
(`*.svelte.test.ts`), then e2e only for what needs the running app (routing, reload, auth, writes,
files, touch, app-shell layout).

Test behaviour, not implementation: a test should fail if the behaviour breaks and keep passing if
only the internals change. Drive it through the interface its user sees (page, form action, seam
function) and work out the expected value from the requirement, not from running the code.

When changing a default or visible behaviour, search `e2e/` as well as unit tests for the old
behaviour, without truncating the output. Run the affected spec locally
(`npx playwright test e2e/<file> -g "<name>"`) before pushing: CI's e2e job takes about 9 minutes.

In a cloud container (Node 22, mismatched Chromium) `npm ci` needs `--engine-strict=false`, `/usr/bin/chromium`
must link to `/opt/pw-browsers/chromium` for e2e, and component tests need a throwaway vitest config
passing that path as `launchOptions.executablePath`. Delete those afterwards; none belongs in the repo.

## Prototyping

Disable the auth guard in a prototype, unless it tests the auth pages. Serve it and open it in the
teacher's browser (`xdg-open <url>`) before asking about it. In a cloud container, which has no
browser to open, report the port and a screenshot instead.

## Reference

- Issues: GitHub Issues via `gh` (`docs/agents/issue-tracker.md`); in a cloud container, use the
  GitHub MCP tools instead. Labels in `docs/agents/triage-labels.md`.
- Domain terms: `GLOSSARY.md`, `docs/adr/` (`docs/agents/domain.md`). Use its terms, never the
  synonyms it lists to avoid.
- Migrations: read `docs/agents/migrations.md` before writing one.
- Backlog: put out-of-scope ideas in `docs/backlog.md`; read it before proposing a feature.
