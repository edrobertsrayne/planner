## Project Configuration

- **Language**: TypeScript
- **Package Manager**: bun
- **Add-ons**: prettier, eslint, vitest, playwright, tailwindcss, sveltekit-adapter, drizzle, better-auth

---

# planner

An electronic teacher planner — self-hosted, single-user. UK state secondary school context.

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

## Browser preview

When Claude in Chrome is not available, drive the browser with `Bun.WebView` — the headless browser built into the Bun runtime. It navigates, clicks, types, and takes screenshots. See <https://bun.com/docs/runtime/webview.md>.

## Communication style

- Give brief context before the main point. Do not jump straight to the answer with no lead-in.
- Write in ASD-STE100 Simplified Technical English: short sentences, one instruction per sentence, active voice, approved words only, no jargon beyond the approved technical vocabulary.
- Use the ubiquitous language defined in `CONTEXT.md`. If `CONTEXT-MAP.md` exists, follow it to the `CONTEXT.md` for the relevant context. Do not drift to synonyms the glossary avoids.
