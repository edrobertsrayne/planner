# The Calm design system, built from our own Svelte components

The planner's look is the Calm design system: cool neutral surfaces, one blue accent, Inter, and
eight Tones used in small doses (a Class chip, a Period badge, a dot). It supersedes ADR-0012, which
vendored shadcn-svelte on top of Bits UI.

## Why

The design was drawn first, as a canvas of artboards (foundations, components, desktop and phone
screens). shadcn-svelte's defaults are a different system — a neutral grey palette, large radii,
Bits UI's headless parts — and rethemeing each component to match the artboards meant overriding
nearly every class the CLI wrote. Owning the whole layer is less code than fighting it: the planner
needs about a dozen small controls, and the platform now supplies what Bits UI was there for.

## What it is

**Tokens** are CSS custom properties in `src/routes/layout.css`: `--bg`, `--surface`, `--step-1`,
`--step-2`, `--border`, `--divider`, `--outline`, `--text`, `--muted`, `--primary` and its
container, `--error`, the eight `--tone-{n}-{bg|fg|dot}` sets, and the feedback sets. Every token has
a light and a `.dark` value, so a component never branches on the theme. Tailwind's theme names
(`bg-background`, `text-muted-foreground`, `bg-surface`, `bg-step-1`, `bg-primary-container`) point
at them.

**Components** are Svelte files in `src/lib/ui/`, styled by one stylesheet, `src/lib/ui/ui.css`, in
Tailwind's `components` layer. Plain classes in that layer mean a utility passed as `class`
(width, margin, a one-off height) always wins, so there is no class-merging library. Compound parts
are imported as namespaces (`import * as Dialog from '$lib/ui/dialog'`).

**The platform does the behaviour.** `Dialog` is a native `<dialog>` opened with `showModal()` — focus
trap, inert page, Escape and top layer come with it — and the phone navigation drawer is the same
dialog anchored left. `Popover` and the dropdown `Menu` use the `popover` attribute and its
`popovertarget` trigger for light dismiss and layering, with a small placement helper. `Select` is a
native `<select>`. `Tabs` and the segmented `ToggleGroup` carry the ARIA roles and arrow keys. The
`Tooltip` is CSS, and `toast` is a small store with a `<Toaster />`.

**Tones keep their stored positions.** A Class or Course stores a Tone position 0–7 (ADR-0013); the
Calm palette re-hues the positions (lilac, mint, sky, lime, lemon, rose, lagoon, peach) without
touching any row. The farthest-point walk is unchanged and still lands consecutive Classes far
apart.

## Consequences

`shadcn-svelte`, `bits-ui`, `svelte-sonner`, `tailwind-merge`, `tailwind-variants`,
`tw-animate-css` and `@internationalized/date` are removed. Dialog content is mounted only while the
dialog is open, so there is no close animation and no need to hold the last value while one plays.
Adding a control means adding a Svelte file and its classes in `ui.css`, not running a CLI.
