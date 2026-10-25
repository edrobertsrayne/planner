# Coding standards

These standards apply to all code in this repo. Reviewers and agents use them to review each change.

Tooling comes first. `bun run check`, ESLint (`svelte.configs.recommended`) and the Svelte compiler in runes mode enforce many rules. Do not review what tooling already enforces.

## Contents

1. Principles
   - Single responsibility (SOLID "S")
   - KISS: keep it simple
   - YAGNI: you aren't going to need it
2. Svelte best practices
   - `$state`
   - `$derived`
   - `$effect`
   - `$props`
   - Events
   - Each blocks
   - Context
   - Styling
   - Debugging and `{#key}`
   - Modern replacements
3. Code quality review
   - Review rules
   - Blockers
4. Code smells

## 1. Principles

Three principles guide all code. They agree with "Favour the simple implementation" in `AGENTS.md`.

### Single responsibility (SOLID "S")

A module, component, function or type does one thing. It has one reason to change.

- Name the unit's job in one short sentence. If the sentence needs "and", split the unit.
- Keep orchestration (what happens, in what order) apart from business logic (how to decide).
- Keep data access, domain rules and presentation in separate layers.
- Do not add a flag or mode to a unit to make it do a second job. Write a second unit.

### KISS: keep it simple

Choose the simplest design that meets the stated need.

- Prefer direct, boring code to clever or "magic" code.
- Prefer deleting code to adding code.
- If a design needs a long explanation, look for a simpler design.

### YAGNI: you aren't going to need it

Build only what the current need requires.

- Do not add parameters, options, hooks, layers or abstractions for a future need.
- Do not keep code "just in case". Delete it. Git keeps the history.
- Add an abstraction or extract a helper when a real second use exists, not before.
- Put ideas that you leave out of scope in `docs/backlog.md`.

## 2. Svelte best practices

Source: <https://svelte.dev/docs/svelte/best-practices>. This section keeps only the rules that tooling does not enforce here.

### `$state`

Use `$state` only for variables that are _reactive_: they cause an `$effect`, a `$derived` or a template expression to update. All other variables are normal variables.

`$state({...})` and `$state([...])` are deeply reactive, so Svelte must proxy them. For large objects that you only reassign (never mutate), use `$state.raw`. API responses are a common case.

### `$derived`

To compute a value from state, use `$derived`, not `$effect`.

```js
// do this
let square = $derived(num * num);

// don't do this
let square;
$effect(() => {
	square = num * num;
});
```

`$derived` takes an expression. For a complex expression, use `$derived.by`. A derived object or array is not deeply reactive.

### `$effect`

Effects are an escape hatch. Avoid them. Do not update state inside an effect.

- To sync state to an external library, prefer `{@attach ...}`.
- To respond to user interaction, put the code in an event handler or a function binding.
- To log values for debugging, use `$inspect`.
- To observe something outside Svelte, use `createSubscriber`.

Do not wrap an effect's contents in `if (browser) {...}`. Effects do not run on the server.

### `$props`

Treat props as values that change. A value that depends on a prop usually needs `$derived`.

```js
let { type } = $props();

// do this
let color = $derived(type === 'danger' ? 'red' : 'green');

// don't do this: `color` does not update when `type` changes
let color = type === 'danger' ? 'red' : 'green';
```

### Events

To listen on `window` or `document`, use `<svelte:window>` and `<svelte:document>`. Do not use `onMount` or `$effect` for this.

### Each blocks

The key must uniquely identify the item. Do not use the index as a key. Do not destructure the item if you need to mutate it (for example `bind:value={item.count}`).

### Context

Prefer context to state in a shared module. Context scopes the state to the part of the app that needs it, and it cannot leak between users during server-side rendering. Use `createContext`, not `setContext` and `getContext`, for type safety.

### Styling

Style with Tailwind classes. In `class` attributes, use clsx-style arrays and objects, not the `class:` directive. If a component needs a `<style>` block and a JS value, pass the value with `style:--name={value}`.

### Debugging and `{#key}`

To find why something updates too often or not at all, put `$inspect.trace(label)` on the first line of an `$effect` or `$derived.by`. Remove it before you commit.

`{#key}` unmounts everything inside it each time its expression changes. Use it only for transitions. To re-run code in a child, use `$derived`.

### Modern replacements

- Use classes with `$state` fields to share reactivity between components, not stores.
- Use `{@attach ...}`, not `use:action`. Exception: SvelteKit's `use:enhance` on forms.

## 3. Code quality review

Source: Cursor team kit, `thermo-nuclear-code-quality-review`
<https://github.com/cursor/plugins/blob/main/cursor-team-kit/skills/thermo-nuclear-code-quality-review/SKILL.md>

Behaviour that works is not enough. The change must not leave the codebase messier. Look for a restructuring that keeps behaviour and deletes complexity. A refactor that only moves complexity to a different place is not enough.

### Review rules

1. **File size.** Do not push a file from under 1000 lines to over 1000 lines. Extract focused modules first.
2. **No spaghetti growth.** Do not add ad-hoc conditionals, one-off flags or special cases to an unrelated flow. Change the model so the special case disappears, or move it into its own unit.
3. **Delete, do not rearrange.** If the structure can be simpler with the same behaviour, make it simpler. Remove moving pieces.
4. **No needless indirection.** Delete thin wrappers and pass-through helpers. Be sceptical of generic mechanisms that hide a simple data shape.
5. **Clear types.** Question needless optionality, `unknown`, `any` and casts. Prefer an explicit typed model to a loose object. Do not hide an unclear invariant behind a silent fallback.
6. **Canonical layer.** Put logic in the layer that owns the concept. Reuse the existing helper. Do not write a near-duplicate.
7. **Atomic updates.** Related writes go in one transaction, so that state cannot apply in part.

### Blockers

Do not approve because behaviour looks correct. These block approval unless the author justifies them:

- The change keeps complexity that a simpler design would delete.
- The change pushes a file from under 1000 lines to over 1000 lines.
- The change adds ad-hoc branching that tangles an existing flow, or scatters feature checks across shared code.
- The change adds an unnecessary abstraction, wrapper or cast.
- The change duplicates an existing helper, or puts logic in the wrong layer.

## 4. Code smells

Source: Matt Pocock, `code-review` skill
<https://github.com/mattpocock/skills/blob/main/skills/engineering/code-review/SKILL.md>
(the smells are from Fowler, _Refactoring_, chapter 3)

Each smell is a judgement call, not a hard violation. Label it as such ("possible Feature Envy"). A rule in sections 1–3 overrides a smell. Sections 1 and 3 already cover Duplicated Code, Divergent Change, Speculative Generality, Repeated Switches and Middle Man.

Each line reads: what it is → how to fix it.

- **Mysterious Name**: a name that does not show what the thing does or holds, or that uses a synonym `GLOSSARY.md` lists to avoid. → Rename it with the glossary term. If no honest name comes, the design is unclear.
- **Feature Envy**: a function that uses another module's data more than its own. → Move the function to the data it uses.
- **Data Clumps**: the same few fields or parameters travel together. → Bundle them into one type. Pass that type.
- **Primitive Obsession**: a primitive or string stands in for a domain concept. → Give the concept its own small type.
- **Shotgun Surgery**: one logical change forces edits across many files. → Gather what changes together into one module.
