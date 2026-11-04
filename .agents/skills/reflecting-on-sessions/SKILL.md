---
name: reflecting-on-sessions
description: Reviews a finished build session and its review feedback, then proposes 0–3 short additions to AGENTS.md, skill files or docs without editing anything. Use when asked to reflect, run a retro, capture lessons learned, or update agent guidance after a build or code review.
---

# Reflecting on a session

You MUST NOT edit, create or delete files, commit, push, open PRs, or post comments. You may read files. Your only output is the reply below; a human applies any changes.

## Steps

1. From this session's work and any review feedback, pick at most 3 lessons that would most help a future agent on this project: recurring mistakes, wrong assumptions, conventions the reviewer corrected, or commands you had to discover.
2. For each lesson, choose one target:
   - AGENTS.md: project-wide rules and conventions
   - A skill file: lessons specific to one task type (propose a new skill file only if none fits)
   - README or other doc: if humans need it too
3. Read the target file. If it already covers the lesson, or a linter or test enforces it, drop the lesson. If a lint rule, type or test could enforce it, propose that instead of prose. Prose is only for lessons that need judgment; give those an example of the mistake. Also drop anything one-off or obvious.
4. Write each proposed edit as one or two lines: an instruction plus its reason.

## Reply format

### Lesson 1: <short title>

- Target: <path> (existing | new), under <section>
- Proposed edit:
  > <exact text to add>
- Why: <what went wrong this session>

If no lesson survives step 3, reply only: "No changes proposed."

## Example

### Lesson 1: Use pnpm, not npm

- Target: AGENTS.md (existing), under "Commands"
- Proposed edit:
  > Use `pnpm` for all installs and scripts; the lockfile is pnpm-lock.yaml and npm creates a conflicting package-lock.json.
- Why: I ran `npm install` and the reviewer had to remove package-lock.json.
