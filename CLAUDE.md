## Project Configuration

- **Language**: TypeScript
- **Package Manager**: bun
- **Add-ons**: prettier, eslint, vitest, playwright, tailwindcss, sveltekit-adapter, drizzle, better-auth

---

# planner

An electronic teacher planner — self-hosted, single-user. UK state secondary school context.

## Favour the simple implementation

This planner has one user and one school year. Build the simplest thing that meets the stated
need, and no more.

- Solve the case in front of you. Do not add generality for a second user, a second year, or a
  caller nobody has asked for.
- Prefer no code to code. A rule that costs a query, a lookup or an ordering constraint must earn
  it. Drop the rule if the cost is larger than the mistake it catches.
- Do not guard against a wrong shape the app itself never sends. Read the fields you need and
  ignore the rest.
- Do not enforce a rule at one door that you cannot enforce at the others. Enforce it everywhere,
  or drop it.
- Reuse what is already there before you write a new module or a new abstraction.

When you find a simpler approach than the one agreed, say so before you build it.

## Agent skills

### Issue tracker

GitHub Issues on `edrobertsrayne/planner`, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical roles, each label string equal to its name. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context — `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

### Database migrations

What this project's SQLite and `drizzle-kit` can actually do. Read before writing a migration. See `docs/agents/migrations.md`.

### Backlog

Out-of-scope ideas for later. See `docs/backlog.md`.

## End-to-end tests

Run the whole suite with `bun run test`. Do not run one e2e file on its own.

The suite keeps one database and one user, so every file depends on the state the files before it
left. A single file starts against an empty database and stops at the first-run wizard, not the
login page. The error names a duplicate "Password" field, which looks like a selector fault and is
not one.

## Browser preview

When Claude in Chrome is not available, drive the browser with `Bun.WebView` — the headless browser built into the Bun runtime. It navigates, clicks, types, and takes screenshots. See <https://bun.com/docs/runtime/webview.md>.

## Prototyping

Disable the auth guard for a prototype, unless the prototype is testing the authentication
pages themselves. This keeps the prototype easy for a non-developer to open and use.

## Communication style

- Give brief context before the main point. Do not jump straight to the answer with no lead-in.
- Write in ASD-STE100 Simplified Technical English: short sentences, one instruction per sentence, active voice, approved words only, no jargon beyond the approved technical vocabulary.
- Use the ubiquitous language defined in `CONTEXT.md`. If `CONTEXT-MAP.md` exists, follow it to the `CONTEXT.md` for the relevant context. Do not drift to synonyms the glossary avoids.
