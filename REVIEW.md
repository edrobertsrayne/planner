# Review guide

A personal project. YAGNI and KISS come first. Read `AGENTS.md` for conventions.

## Flag

- Complexity the change doesn't need: speculative options, flags, layers or wrappers.
- A simpler way to do the same thing, especially one that deletes code.
- Special-case `if`s bolted onto an existing flow.
- `any`, casts or optional parameters hiding the real type.
- Duplicating a helper that already exists.
- Missing tests for new behaviour.

## Svelte 5

- Use `$derived`, not `$effect`, to compute values; values from props need `$derived` too.
- Put interaction code in event handlers, not effects.
- Key `{#each}` blocks by id, not index.
- No legacy syntax: `$:`, `export let`, `on:click`, `<slot>`, stores, `use:action`.

## Output

A few findings that matter, most important first, each with file, line and fix. No nits. If
nothing matters, say so in one line.
