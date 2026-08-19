# shadcn-svelte for controls, on our own tokens

The design system is shadcn-svelte, vendored into `$lib/components/ui`, rethemed onto a palette
chosen here rather than the one the CLI ships. Bits UI and `@internationalized/date` arrive beneath
it as the only new runtime dependencies. Skeleton, Flowbite, Carbon, Svelte Material UI, DaisyUI,
Melt UI, Ark UI and bare Bits UI were the alternatives, surveyed against primary sources in
`docs/research/ui-libraries-for-sveltekit.md`.

There was no design system before this. `src/lib/components` did not exist; all thirteen `.svelte`
files carried inline Tailwind, and the drift was already visible — `text-neutral-400` hand-repeated
thirteen times, the same text input spelled three ways.

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

**`$lib/components/ui` is vendored, and hand-edits to it are a signal.** It is exempted from
`.prettierignore` and the eslint config so that it stays byte-identical to upstream and a diff means
a deliberate fork. Anything authored here lives outside that directory; single-use components stay
colocated with their route.

**The two grids are never migrating.** The Teaching Week grid and the Slot grid are bespoke tables
over the derived schedule, and no library on the survey ships them. They are also where density
matters most — `min-h-16 w-40` cells, `text-[11px]` titles, a `text-[9px]` control — against
shadcn's `h-9 px-4 py-2`. shadcn density is adopted for chrome and refused inside the grids, which
keeps the copied components unforked.

**Two idioms coexist for a while.** Only the four chrome files convert immediately; roughly 44% of
the UI converts when a feature next touches it. That band is where an agent will find both idioms
and pick either, so `CLAUDE.md` names which files are converted, which never will be, and what the
test is: things with states go through `ui/`, arrangement stays Tailwind in the route.

**`@tailwindcss/forms` is dropped.** It applies base-layer resets to bare inputs, which shadcn's
`input.svelte` also styles, leaving cascade order to decide. It existed to make unstyled inputs
tolerable and stops earning its place once every input is a component. `@tailwindcss/typography`
stays; it styles prose and does not overlap.

**Dark mode is taken at init rather than retrofitted.** shadcn ships both token sets and carries the
dark variants in its class strings, so the marginal cost now is one block of tokens. The cost later
would be revisiting every bespoke grid cell, since `class-tone.ts` hashes a colour per Class and its
eight tones must stay literal class names for Tailwind's scanner to see them.

**The accent colour is constrained by the calendar.** Eight hashed Class tones already spend the
colour budget on the busiest screen, so the accent is near-neutral by necessity rather than taste.

**`data-table` is available, and the dependency is not the reason to avoid it.** The research
document flags that it pulls `@tanstack/table-core`; that is true and is not a deciding factor, on a
branch already adding Bits UI and `@internationalized/date`. The criterion is behaviour: a table
wanting sorting, filtering or column state should use it rather than hand-roll that logic, and a
list already rendered in an `{#each}` should not acquire a table engine to stay a list.
