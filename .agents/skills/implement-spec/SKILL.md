---
name: implement-spec
description: 'Implement the result of /to-spec and /to-tickets in code.'
disable-model-invocation: true
---

You have been provided a spec. This spec should have tickets associated with it, describing how to implement the spec.

The issue tracker should have been provided to you. If not, read `docs/agents/issue-tracker.md`. If that file is missing, tell the user to run `/setup-matt-pocock-skills`.

The goal is the entire spec implemented on a single **integration branch**, with every ticket resolved the way the issue tracker closes work.

The tickets are not a list of steps. They are a **task graph** with blocking relationships between them. This means there is always a **frontier** of tickets which are ready to be grabbed.

Communication to and from subagents should be sparse. Communicate primarily through **context pointers**: to the spec, tickets, research notes, and previous commits. Don't duplicate information already available via pointers. Subagents do not see this conversation, so every pointer MUST be a path or URL they can open: `issue://<N>`, `local://…`, a repo path, or a commit SHA.

## Model

One **implementer subagent per ticket, dispatched serially**. Implementers never run in parallel: one ticket at a time, each implementing directly in the parent checkout and committing to the integration branch.

While an implementer is active, the parent runs **no build, no test, and no code review**: it does not touch the tree the implementer is working in. Wait for the implementer's report before the parent runs anything that reads or builds the tree.

A **reviewer subagent** reviews each ticket's diff (base recorded before the dispatch) for spec compliance and quality. A capped fix loop revisits. Implementers never spawn subagents.

## Continuous execution

Do not pause to ask the user between tickets. Execute all tickets without stopping. Stop only for:

1. an irreversible or destructive operation (e.g. a needed `git reset --hard`);
2. a security-sensitive action;
3. a side effect outside this worktree that norms say ask first (merge, push to a shared branch, publish);
4. a ticket graph so broken every path forward is a guess.

Otherwise, **rule, don't stall**: conflicts, ambiguities, plan defects — decide them. The spec is the binding authority, the tickets are its argument, and your judgment settles what neither answers. Record every decision in the ledger as `Ruling: <what> — <why> — <cost if wrong>`.

## Ledger

Track progress in a ledger file, `local://implement-spec/progress.md`. It is the recovery map after context compaction — trust the ledger and `git log` over your memory.

- First line: `# implement-spec ledger — spec: <spec pointer>`.
- One line per event, oldest first so the file reads as a history:
  - `Ticket #N: complete (base7..head7, review clean)` or `(base7..head7, K parked)`
  - `Ticket #N: fix round R/3 (X addressed, Y open — <one-liners>; base..head)`
  - `Ticket #N: minor (deferred): <one-liner>` — point the final review at these
  - `Ticket #N: parked — <finding> — Ruling: <why the code stands>`
  - `Ticket #N: Ruling: <finding> — <what you decided and why>`
- The ticket's `todo` mirrors the latest state; the ledger is the detail.

Create the `todo` list and the ledger before ticket 1 dispatches.

## Steps

1. Read the spec and tickets. Sort them topologically into a ready queue: a ticket is ready only when all its prerequisite tickets are complete (step 10).
2. (optional) Use an **exploration subagent** for any exploration the tickets need: use the `task` agent, not `scout` (`scout` is read-only and cannot save notes). It saves markdown notes to `local://notes/<topic>.md`. All subagents share the parent's `local://` root, so implementers read these notes by path and skip exploration.
3. Create the integration branch and check it out in the parent. If the issue tracker closes work through PRs, or the user asks for one, open a draft PR after the first ticket is complete in step 10 (a branch with no commits ahead of main can't open one), marked as closing the spec and tickets.

## Dispatching an implementer

4. **One implementer at a time.** Pick the next ready ticket. Record `BASE = git rev-parse HEAD`. Dispatch one `task` call:
   - `name: implement-T<N>` (so you can steer it later with `write agent://implement-T<N>`).
   - `solutionSpace`: how closed the ticket's solution is — e.g. `one fix: the acceptance criteria name the seams; design open on caching` vs `mechanical rename, files listed`.
   - `outputSchema`: `{ ticket, status: "DONE|DONE_WITH_CONCERNS|BLOCKED|NEEDS_CONTEXT", commit, tests, report, concerns[] }`.
   - The send carries, and only this:
     - one line on where this ticket fits ("#N feeds #M, which reads its interface");
     - pointers: `issue://N`, the spec, the ledger file, the notes dir, `docs/agents/issue-tracker.md`;
     - interfaces and decisions from earlier tickets that the ticket text can't know;
     - your resolution of any ambiguity you noticed;
     - the report path (`local://implement-spec/report-T<N>.md`).
   - Never paste accumulated state from earlier tickets into the send. The ledger and tickets carry it.

## Implementer contract (include in the send)

5. The implementer MUST:
   - Read `issue://N` now and state its title. Ask questions before starting if anything is unclear; report `NEEDS_CONTEXT` mid-ticket rather than guess.
   - Read `skill://tdd` and use it where possible, at pre-agreed seams.
   - Follow `AGENTS.md` and the `GLOSSARY.md` terms. Note out-of-scope ideas in `docs/backlog.md`.
   - Run `bun run check` regularly; run focused tests for the code being iterated on; run the full `bun run test` once before committing.
   - Read `skill://code-review` and review its own work critically before reporting.
   - Write the full report to the report path: what was implemented, what was tested with command and output summary, TDD RED/GREEN evidence where it applies, files changed, self-review findings, concerns.
   - Return the short contract through `outputSchema` — the detail lives in the report file.
   - **Never dispatch subagents.** Anything an implementer spawns duplicates the review the controller dispatches anyway. No exceptions.
6. **Tests in implementers:** because only one implementer runs at a time, e2e runs cannot collide on `playwright.config.ts`'s fixed port 4173 with `reuseExistingServer: false`. TDD therefore works end to end, including e2e: the implementer runs its ticket's own e2e file (`bun run test:e2e -- e2e/<file>.e2e.ts`) plus the full `bun run test` once before committing.

## Handling the report

7. **DONE** — proceed to review. **DONE_WITH_CONCERNS** — read the concerns before review; if they touch correctness or scope, resolve them before review; observations (e.g. "this file is getting large") are noted and deferred. **NEEDS_CONTEXT** — supply the missing information (steer the same agent with `write agent://implement-T<N>`, or dispatch fresh if it is parked). **BLOCKED** — rule on the blocker in the ledger. A re-dispatch after NEEDS_CONTEXT or BLOCKED is a new `task` call that carries the ruling and the missing context — not the earlier agent's history. Never force a retry without change: more context, split the ticket, or rule on a ticket defect.

## Reviewing a ticket

8. Dispatch the bundled **`reviewer`** agent with the `issue://N` pointer, the report path, and the diff range `BASE..HEAD` written to a file (`local://implement-spec/review-T<N>.md`: `git log --oneline BASE..HEAD`, `git diff --stat`, `git diff -U10`). Never paste the raw diff into the dispatch. The reviewer returns:
   - **Spec compliance:** ✅ met, or ❌ with what the ticket or spec demands that is missing;
   - **Quality:** approved, or issues found (Critical > Important > Minor) with file:line evidence;
   - optional "cannot verify from diff" items — you resolve each yourself, because you hold the spec and the cross-ticket context the reviewer lacks; a confirmed gap enters the fix loop with the other findings.
   - **Never** instruct the reviewer to ignore or pre-judge a finding. If you believe a finding is a false positive, let the reviewer raise it and adjudicate it in the loop.

## The fix loop

9. Triggered by spec ❌, or by any Critical or Important finding. A Minor finding is noted in the ledger as deferred and pointed at the final review. Cap: **3 rounds per ticket** (omp's task schema has no per-item model escalation, so after 3 rounds stop and adjudicate).
   - Rounds 1–3: resume the same implementer with `write agent://implement-T<N>`, carrying the findings verbatim. It fixes, re-runs the tests that cover the amended code (named tests, not the whole suite), and appends a fix report to the report file.
   - Then a **scoped re-review**: only the fix diff (`FIX_BASE..HEAD`, where `FIX_BASE` is the head the previous review saw). The re-review verdicts each finding ADDRESSED or NOT ADDRESSED; new Critical/Important breakage in the fix diff joins the open findings list; new out-of-scope observations go to the ledger as deferred minors and never extend the loop.
   - Conflict recovery: if the integration branch goes bad mid-ticket, `git reset --hard <BASE>`. Ask first — it destroys work.
   - Never fix findings in the parent yourself: that skips the review.
   - After each round, append to the ledger: `Ticket #N: fix round R/3 (<X> addressed, <Y> open — <one-liners>; base..head)`.
10. When the review is clean, or findings left open at the cap are each parked with a ruling, append `Ticket #N: complete (base7..head7, review clean)` (or `(base7..head7, K parked)`) to the ledger, mark the ticket's `todo` done, and continue with the next ready ticket (step 4).

## Final review

11. Once all tickets are complete, read `skill://code-review` and run it on the integration branch (merge-base with main to HEAD), pointed at the ledger's deferred-minor lines so it can triage which must be fixed before merge.
12. If it raises findings, dispatch **one** fix implementer with the complete findings list — never one fixer per finding. Then run exactly one scoped re-review of the fix range. **No second fix wave.** Surface any residual load-bearing findings to the user in your final message.

## Reporting out

13. If a draft PR exists, mark it ready for review. Otherwise, resolve each ticket the way the issue tracker closes work (for GitHub: `Closes #N` in the PR body, or `gh issue close`), and report the integration branch.

## Rulings I made

Before you report out, collect every ledger line containing `Ruling:` into your final message, in order, each with what it costs if wrong. This list is the only record of decisions you took on the user's behalf — an unreported ruling was made in secret.

## Final checklist

Before you report out:

- Every ticket's `todo` is done, or the exceptions are stated in the final message.
- Every ledger line ends in a clear state: complete, or parked with a ruling.
- The integration branch is pushed, and the PR (if any) reflects the ledger's completion lines.
- The "Rulings I made" list is present, in order, and complete against the ledger.

Every claim in the final message must trace to a tool result you saw. If you cannot show it, say what remains.
