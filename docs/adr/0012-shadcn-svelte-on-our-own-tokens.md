# shadcn-svelte for controls, on our own tokens

The design system is shadcn-svelte, vendored into `$lib/components/ui`, rethemed onto a palette
chosen here rather than the one the CLI ships. Bits UI and `@internationalized/date` arrive beneath
it as the only new runtime dependencies. Skeleton, Flowbite, Carbon, Svelte Material UI, DaisyUI,
Melt UI, Ark UI and bare Bits UI were the alternatives, surveyed against primary sources in
`docs/research/ui-libraries-for-sveltekit.md`.

There was no design system before this. `src/lib/components` did not exist; all thirteen `.svelte`
files carried inline Tailwind, and the drift was already visible — `text-neutral-400` hand-repeated
thirteen times, the same text input spelled three ways.

This ADR originally assumed a staged migration that preserved the existing look, converting roughly
44% of the UI opportunistically. Issue #53 reset that: the redesign is ground-up, every screen
including the two grids, decided by prototype rather than argument. The Why below still holds — it's
the reason for shadcn-svelte at all, not the shape of the rollout. The Consequences have been
rewritten to match what #53 actually decided.

## Why

A future reader will reasonably ask why a project that chose SvelteKit _against_ agent familiarity
(ADR-0004) then adopted the component library agents know best. The answer is that ADR-0004's
binding constraint was reviewability, and shadcn-svelte's copy-in model serves it rather than
fighting it: the CLI writes `.svelte` files into this repository and leaves. There is no installed
package whose behaviour is opaque, no upgrade imposed on someone else's schedule, and every
component is diffable in git. That is the same argument ADR-0004 made about framework choice,
applied to components — the library agents know is here the library whose source sits in the tree.

The research document's own reasoning was weaker than its conclusion. It made calendar coverage the
deciding constraint, on the grounds that this is a timetable application. That argument does not
survive the code: there is one `<input type="date">` in the entire app, and the date-heavy work lives
in `src/lib/server/calendar`, never reaching the browser, because the schedule is derived rather than
edited (ADR-0007). The real case is narrower and holds anyway — consistency of controls across
features yet to be written, and one hand-rolled `role="dialog"` with no focus trap.

The tokens are ours because tokens are the layer that is hardest to change later; by the time a
change is wanted, every screen references them. Colour and radius are CSS variables in `@theme
inline`, so retheming is cheap and was always going to happen. What the CLI's defaults would have
settled by accident — the look of a tool one person uses every working day — is settled deliberately
instead.

Every styled alternative (Skeleton, Carbon, Svelte Material UI) asks for a second design language on
top of the Tailwind v4 already here. DaisyUI ships no JavaScript and so cannot supply a dialog. Melt
UI has no calendar and has stalled. Bits UI alone would have meant writing every class by hand,
including the fiddly dialog and popover states; it remains the escape hatch, since it is what
shadcn-svelte sits on.

## Consequences

**`$lib/components/ui` is ours, not vendored.** Once a component is added it is part of this
codebase and may be edited freely — the "byte-identical to upstream" rule is withdrawn. The
`.prettierignore` and eslint `ignores` entries that enforced it come out, and the directory is
formatted and linted like everything else.

**The style is `rhea`, at `--radius: 0.625rem`.** shadcn's recommended appearance stands otherwise
untouched: the CLI-default neutral tokens, no accent colour, no bespoke type scale. `mira` was tried
first for its 10px `xs` control size, then dropped as too cramped outside the grids; `rhea` was
settled instead, and `mira`'s `xs` convention — `h-7` (28px) everywhere except the Teaching Week and
Slot grids, which keep `xs`/`h-5` density — carried over as a documented convention rather than a
token. `@tailwindcss/typography` is dropped; nothing in the app renders prose. `@tailwindcss/forms` remains
dropped too — it applies base-layer resets to bare inputs that shadcn's own `input.svelte` also
styles, and stopped earning its place once every input is a component.

**The two grids are redesigned, not exempted.** ADR-0012's original carve-out — "the two grids are
never migrating" — is withdrawn. The density argument that justified it is answered by the `xs`
control size, not by leaving the grids on hand-rolled markup.

**There is no staged conversion.** Every screen converts as part of the redesign; the
44%-opportunistic-conversion plan and the two-idioms-coexist period it implied do not happen.

**Dark mode is wired with `mode-watcher`.** Both token sets shipping in `class` strings was only half
the story — the activation layer (`<ModeWatcher />`, localStorage, a pre-paint head script for
SSR-safety) had to be built separately from the tokens. Class tone tokens (below) replace the literal
per-Class Tailwind classes that would otherwise have needed a static exemption from the dark-mode
class scan.

**Class tones are CSS custom-property tokens, not literal Tailwind classes.** `class-tone.ts`'s
per-Class hash now resolves to `{ bg, fg, ring }` roles on `--tone-{0-7}-{bg|fg|ring}`, with dark
variants formula-driven from a shared OKLCH curve rather than hand-picked per tone. `stone` was
replaced by `indigo`; the other seven hues are unchanged. This is what makes the tones safe to keep
literal-free — a lint rule against raw palette utilities becomes viable now that `class-tone.ts` no
longer needs an exemption from it.

**The accent colour is near-neutral by default, not constrained by the calendar.** shadcn's
unmodified neutral palette was kept rather than picking an accent around the eight Class tones; the
tones live as their own token set and don't compete with chrome for colour budget.

**The component inventory is not pre-registered.** Adding a shadcn-svelte component is a single CLI
command, so rebuild tickets decide what they need when they need it rather than settling an inventory
up front. `dialog`, `field`, `separator` and `badge` are in use as of the prototypes; `sheet` and
`tabs` were tried and rejected.

**`data-table` is available, and the dependency is not the reason to avoid it.** The research
document flags that it pulls `@tanstack/table-core`; that is true and is not a deciding factor, on a
branch already adding Bits UI and `@internationalized/date`. The criterion is behaviour: a table
wanting sorting, filtering or column state should use it rather than hand-roll that logic, and a
list already rendered in an `{#each}` should not acquire a table engine to stay a list.
