# SvelteKit, chosen for reviewability over agent familiarity

The application is SvelteKit 2 with Svelte 5 runes, Drizzle and Postgres, better-auth, and Vitest,
deployed via `adapter-node` as a container. Next.js and React Router 7 were the alternatives, and
both have more training data behind them.

## Why

A future reader will reasonably ask why a project built primarily with coding agents did not pick
the framework those agents know best. The answer is that the binding constraint is not whether the
agent writes correct code first time — it is whether the author, who is a teacher rather than a
developer, can tell when it has not. Familiarity with the framework does more for review quality
than a marginally higher first-pass success rate, and SvelteKit produces less code to review.

Next.js would have bought agent fluency and spent it on complexity — caching semantics and the
client/server boundary — that is hard to debug without existing expertise. Those costs buy
scalability properties that are irrelevant to a single-user application.

The scheduling engine is deliberately plain TypeScript outside the framework, so the hardest and
most-changed logic is insulated from this choice.

## Consequences

Agents habitually write Svelte 4 patterns — stores, `export let` — into Svelte 5 codebases. The
required versions are pinned in `CLAUDE.md`, and current documentation should be fetched rather
than recalled.
