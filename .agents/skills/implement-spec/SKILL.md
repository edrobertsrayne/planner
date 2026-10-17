---
name: implement-spec
description: 'Implement the result of /to-spec and /to-tickets in code.'
disable-model-invocation: true
---

You have a spec and its tickets. Build every ticket on one **integration branch**, one subagent at a time. Read `docs/agents/issue-tracker.md` for how to read the tickets and their blocking edges.

## Steps

1. **Order.** Read the spec and its tickets. Put the tickets in an order where every blocker comes before the tickets that it blocks. Make one `todo` item for each ticket.
2. **Branch.** Create the integration branch from `origin/main` and check it out.
3. **Implement, one ticket at a time.** For each ticket, in order:
   1. Dispatch one `task` subagent, named `implement-T<N>`. Its task: "Follow `skill://implement` for `issue://<N>`, part of spec `issue://<S>`." Add only what the ticket text cannot know: interfaces or decisions from earlier tickets, as commit SHAs or file paths.
   2. Wait for its report. Start no other subagent, and run no command that reads or builds the tree, until it reports.
   3. Check that it committed: `git status` is clean and `git log` shows its commit. If not, send it back with `write agent://implement-T<N>`.
   4. Mark the ticket's `todo` item done.
4. **Final review.** When every ticket is committed, read `skill://code-review` and run it on the integration branch, from its merge-base with `main` to `HEAD`. Write the findings to `local://implement-spec/review.md`.
5. **Fix.** If the review has findings, dispatch one `task` subagent, named `implement-fixes`. Its task: "Follow `skill://implement` to fix the findings in `local://implement-spec/review.md`, for spec `issue://<S>`." Wait for it, then check its commit as in step 3.3.
6. **Open the PR.** Push the branch. Open a PR with `Closes #<N>` for the spec and for each ticket.
7. **Spec check.** Read the spec again and compare it with the PR diff (`gh pr diff`). For each User Story and Implementation Decision, find the code that meets it. List each one that the PR does not meet.
8. **Report out.** In your final message, give the PR link, the review findings with what the fix subagent did about each, and the spec gaps from step 7.

Stop and ask the user only before a destructive or irreversible step. Settle every other question yourself and name each decision in the final message.
