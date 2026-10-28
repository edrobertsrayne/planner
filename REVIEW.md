# Review guide

How to review a pull request in this repo. Read `AGENTS.md` first for the project's conventions.

## Stance

Review for structure and maintainability, not only for whether the code works. Be ambitious: look
for the "code judo" move, a restructuring that keeps behaviour the same while whole branches,
helpers, modes or layers disappear. Prefer the change that deletes complexity over one that moves
it around.

Be direct and specific. Do not soften a structural problem into a mild suggestion, and do not bury
it under nits. A few high-conviction comments beat a long list of cosmetic ones.

## What to flag

1. **Missed simplification.** A plausible reframing (a simpler state model, a different ownership
   boundary, a default flow with fewer exceptions) would make the change much smaller.
2. **Spaghetti growth.** New ad-hoc conditionals, one-off booleans, nullable modes or special cases
   bolted onto an existing flow. Push the logic into its own helper, module or typed model.
3. **File size.** A file that crosses 1000 lines in this PR. Ask for decomposition first.
4. **Thin or magic abstractions.** Identity wrappers, pass-through helpers, generic mechanisms that
   hide a simple data shape.
5. **Weak type boundaries.** Needless `any`, `unknown`, casts or optional parameters; silent
   fallbacks that paper over an unclear invariant. Ask for an explicit type instead.
6. **Wrong layer.** Feature logic in a shared path, implementation details leaking through an API, a
   bespoke helper where a canonical one already exists, copy-pasted logic.
7. **Orchestration.** Independent async work run in sequence for no reason; related writes that can
   leave state half-applied.
8. **Domain terms.** Names that use a synonym `GLOSSARY.md` lists to avoid.
9. **Tests.** Behaviour tested at a higher level than it needs (e2e where a unit or component test
   would see it), or new behaviour with no test.

## Svelte 5

The project uses Svelte 5 in runes mode. Flag:

- `$state` on a variable nothing reactive reads. Large objects that are only reassigned, such as API
  responses, should use `$state.raw`.
- `$effect` that computes a value or writes state. Use `$derived` (or `$derived.by` for a complex
  expression). Deriveds are writable.
- `$effect` used for user interaction (put it in the event handler or a function binding), for
  syncing an external library (use `{@attach}`), for `window`/`document` listeners (use
  `<svelte:window>`/`<svelte:document>`), or for debugging (use `$inspect`).
- `if (browser)` inside an effect. Effects never run on the server.
- A value computed from props without `$derived`. Props can change.
- `{#each}` without a key, or keyed by index. Destructured items that are then mutated.
- `{#key}` used to re-run a child's script. Wrap the expression in `$derived` instead.
- `onMount` or `$effect` attaching `window`/`document` listeners.
- Inline style strings for JS values in CSS. Use `style:--name={value}`.
- `:global` overrides where a CSS custom property on the child would do.
- Shared module-level state. Prefer context via `createContext`, not `setContext`/`getContext`.
- Legacy syntax: `$:`, `export let`, `$$props`, `$$restProps`, `on:click`, `<slot>`, `$$slots`,
  `<svelte:fragment>`, `<svelte:component>`, `<svelte:self>`, stores for shared reactivity (use a
  class with `$state` fields), `use:action` (use `{@attach}`), `class:` directives (use clsx-style
  arrays and objects in `class`).

## Output

Order findings by severity:

1. Structural regressions and missed simplifications
2. Spaghetti growth and type-boundary problems
3. Svelte misuse
4. File size, layering and duplication
5. Legibility

For each finding, name the file and line, say what is wrong, and say what to do instead. If nothing
blocks the PR, say so in one line. Do not approve a PR only because it works.
