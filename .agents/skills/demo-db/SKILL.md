---
name: demo-db
description: Seeded demo database and a running, logged-in app. Use for a UI prototype that needs realistic data, screenshots for a PR, or a manual smoke test of a changed page.
---

# Demo database

`scripts/demo-db.ts` builds a fresh database through the planner seam: three Classes, two Courses, Lessons with markdown and maths bodies, taught Sessions from the last two weeks, a queue ahead, and one Session note. The user is created through `/setup`, as a real install does. Leave `dev.db` alone; it is the user's.

## Steps

1. **Seed.** `bun scripts/demo-db.ts seed /tmp/demo.db`. The file must not exist.
2. **Serve.** Start a named service: `DATABASE_URL=/tmp/demo.db bun run dev --port 5173 --strictPort`, ready on log `ready in`. Port 5173 is required: `ORIGIN` and `BETTER_AUTH_URL` in `.env` name it, and auth fails on any other port.
3. **User.** `bun scripts/demo-db.ts user http://localhost:5173`. It creates the user `EMAIL` / `PASSWORD` from `e2e/helpers.ts` through `/setup`.
4. **Drive.** Use a throwaway Playwright script in `/tmp` that imports `node_modules/playwright/index.mjs`. Log in at `/login` with the labels `Email` and `Password` and the button `Log in`.
5. **Clean up.** Stop the service and delete `/tmp/demo.db*`, the script and any worktree. Done when `git status` shows only the change you mean to ship.

## Before and after screenshots

Take the "before" shots from the base commit, against the same database:

```bash
git worktree add --detach /tmp/planner-before main
ln -s "$PWD/node_modules" /tmp/planner-before/node_modules
cp .env /tmp/planner-before/.env
```

Serve from `/tmp/planner-before` on 5173, capture, stop it, then serve the branch. Only one server can hold 5173. Seed once, before the "before" run. A run that edits data changes what the "after" run sees, so re-seed between runs that write.

Write PNGs to `/tmp`, not the repo; `gh pr create --attach /tmp/x.png` uploads from there.

## Gotchas

- **Blur-save.** The Lesson editor saves on blur. Click a plain label outside it (for example `Status`) to blur. The title is not a heading.
- **Caret.** Keyboard moves such as `End` are unreliable in the editor: `End` stops at a visual line end, not the paragraph end. To put the caret at the end of a paragraph, use a DOM selection: `getSelection().collapse(textNode, length)`.
- **Formulas take clicks.** A click on a rendered formula opens its edit prompt. Click plain text when you mean to place the caret. Answer prompts with `page.on('dialog', d => d.accept(answer))`. An empty answer deletes the formula.
- **Dates.** The Terms cover the academic year that holds today. In the summer break no Term is open, so the Agenda has no Sessions.
