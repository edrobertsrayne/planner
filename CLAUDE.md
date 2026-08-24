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

## Communication style

- Give brief context before the main point. Do not jump straight to the answer with no lead-in.
- Write in ASD-STE100 Simplified Technical English: short sentences, one instruction per sentence, active voice, approved words only, no jargon beyond the approved technical vocabulary.
- Use the ubiquitous language defined in `CONTEXT.md`. If `CONTEXT-MAP.md` exists, follow it to the `CONTEXT.md` for the relevant context. Do not drift to synonyms the glossary avoids.
