# UI component libraries for SvelteKit

**Question:** Which Svelte UI component libraries are viable in 2026, and which one fits this project —
SvelteKit 2.63 on Svelte 5.56, Tailwind v4 already in place, adapter-node, self-hosted, single user,
calendar-and-panel-heavy UI, tested under vitest-browser-svelte?

**Date researched:** 2026-08-18

Every claim below traces to the source that owns it: the library's own documentation, its GitHub
repository, or its npm registry manifest. Version numbers, release dates, licences and peer
dependencies come from the npm registry API and the GitHub REST API, both read directly. Anything I
could not confirm from such a source is marked **unverified**.

## The distinction that matters

Three different kinds of thing get called a "UI library", and they do not substitute for one another.

**Headless primitives** ship behaviour — focus management, keyboard interaction, ARIA wiring,
floating-element positioning — and no appearance. Bits UI, Melt UI, Zag.js and Ark UI are these. They
compose with Tailwind because they have no opinion about Tailwind.

**Styled component sets** ship behaviour _and_ appearance, usually with a theming system you either
adopt or fight. Skeleton, Flowbite Svelte, Carbon and Svelte Material UI are these.

**CSS class layers** ship appearance only, as class names, with no JavaScript and therefore no
accessibility behaviour. DaisyUI is this, and only this.

A fourth model is not a library at all: **copy-in source**, where a CLI writes component files into
your repository and then has no further relationship with them. shadcn-svelte is this.

## Findings

### shadcn-svelte — copy-in source over Bits UI

Not a dependency. The CLI writes `.svelte` files into your project and leaves. The
[SvelteKit installation guide](https://shadcn-svelte.com/docs/installation/sveltekit) shows
`shadcn-svelte@latest init` writing a `components.json`, and `add <component>` placing files under
`$lib/components/ui` by default; you import from `$lib/components/ui/button/index.js`. The
[README](https://github.com/huntabyte/shadcn-svelte) calls it "an unofficial community-led Svelte port
of shadcn/ui" — "components that you can copy and paste into your apps" — under the MIT licence.

The CLI package `shadcn-svelte` is at **1.5.0, published 2026-08-02**, MIT, `peerDependencies: {svelte:
"^5.0.0"}` (npm registry). Release cadence over the last four months: 1.2.7 (2026-04-02), 1.3.0
(2026-05-27), 1.4.0 (2026-07-08), 1.4.1, 1.4.2, 1.5.0 — roughly monthly. The repository was last pushed
2026-08-09 and is not archived (GitHub API).

**Tailwind v4** is supported and is now the default. The
[Tailwind v4 migration guide](https://shadcn-svelte.com/docs/migration/tailwind-v4) states existing v3
apps keep working, that all components were updated "for v4 and Svelte 5", that colours moved from HSL
to OKLCH, that configuration moved to the `@theme inline` directive so `tailwind.config.ts` is no
longer needed, and that projects move from PostCSS to `@tailwindcss/vite`. This project already uses
`@tailwindcss/vite` 4.3 and has no `tailwind.config` — it is already in the shape the v4 path expects.

**Svelte 5 / runes:** confirmed by reading the registry source. Fetching
`https://shadcn-svelte.com/registry/calendar.json` returns component files using `$props()` and
`$bindable()`, e.g. `calendar/calendar-cell.svelte` opens with
`import { Calendar as CalendarPrimitive } from "bits-ui";` and `let { ref = $bindable(null), ... }:
CalendarPrimitive.CellProps = $props();`. So the components are runes-authored, and Bits UI is the
behavioural layer underneath — which the README does not say, but the shipped source does.

**Component coverage** — the [registry index](https://shadcn-svelte.com/registry/index.json) lists 206
items. Against the needs here: `calendar`, `range-calendar` (plus 32 `calendar-NN` example blocks),
`dialog`, `alert-dialog`, `popover`, `hover-card`, `command` (the command palette, which
`registry/command.json` shows depends on the `dialog` item and ships `command-dialog.svelte`),
`data-table`, `table`, `select`, `sheet`, `drawer`, `sidebar`, `form`, `field`, `input-group`,
`pagination`, `tabs`, `sonner` (toasts), `chart`. There is no `combobox` registry item — in shadcn the
combobox is a documented _composition_ of `command` inside `popover`, not a shipped unit; the
underlying Bits UI does ship a first-class `combobox` primitive if you want one.

`data-table` is worth flagging: `registry/data-table.json` ships `data-table.svelte.ts` importing from
`@tanstack/table-core`. Adding it therefore adds a real npm dependency, unlike most of the registry.

**Accessibility posture:** the README's claim is "Accessible and customizable components". The
substance comes from Bits UI beneath it (below).

**SSR:** _unverified._ I found no statement about SSR or hydration in the shadcn-svelte documentation
either way.

**Lock-in:** minimal by construction. The files are yours, in your repo, under your linter and
formatter and diffable in git. There is no upgrade treadmill because there is no installed package to
upgrade — which is also the cost: you own the maintenance of whatever you copied.

### Bits UI — headless primitives, Svelte 5 only

[Bits UI](https://bits-ui.com/docs/introduction) describes itself as "a headless component library for
Svelte", and the [README](https://github.com/huntabyte/bits-ui) as "flexible, unstyled, and accessible
primitives that provide the foundation for building your own high-quality component library". MIT.

**Version 2.18.1, published 2026-05-03** (npm). `peerDependencies: {svelte: "^5.33.0",
"@internationalized/date": "^3.8.1"}` — so Svelte 5 is not merely supported, it is required at a fairly
recent minor, comfortably below this project's 5.56. Runtime dependencies are small and specific:
`@floating-ui/core`, `@floating-ui/dom`, `esm-env`, `runed`, `svelte-toolbelt`, `tabbable`.

Release cadence: 2.17.0 (2026-04-04) through 2.18.1 (2026-05-03) is six releases in a month, then
nothing for three and a half months. The repository is alive — last push 2026-08-10, latest commit
`fix: cancel DismissibleLayer afterSleep timer on destroy` dated 2026-08-10 — so this reads as a stable
plateau rather than abandonment, but the release gap is real and worth naming.

**Tailwind v4:** not applicable in the compatibility sense. Bits UI ships no CSS. The docs note you
style "using standard `class` props or `data-*` attributes" with Tailwind or plain CSS, so there is
nothing for a Tailwind major to break.

**Accessibility posture** — the strongest stated claim of any candidate here. The introduction page
lists "WAI-ARIA compliance", "keyboard navigation by default", "focus management handled for you" and
"screen reader support built-in".

**Component coverage** — from the source tree at `packages/bits-ui/src/lib/bits` (GitHub API), 43
primitives: `accordion`, `alert-dialog`, `aspect-ratio`, `avatar`, `button`, **`calendar`**,
`checkbox`, `collapsible`, **`combobox`**, **`command`**, `context-menu`, **`date-field`**,
**`date-picker`**, **`date-range-field`**, **`date-range-picker`**, **`dialog`**, `dropdown-menu`,
`label`, `link-preview`, `menu`, `menubar`, `meter`, `navigation-menu`, `pagination`, `pin-input`,
**`popover`**, `progress`, `radio-group`, **`range-calendar`**, `rating-group`, `scroll-area`,
`select`, `separator`, `slider`, `switch`, `tabs`, **`time-field`**, **`time-range-field`**, `toggle`,
`toggle-group`, `toolbar`, `tooltip`.

That date and time cluster is unusually deep, and it is the reason the `@internationalized/date` peer
exists — the same Adobe calendar-system library (Apache-2.0, 3.12.3 as of 2026-07-31) that React Aria
uses. For an app whose core object is a timetable laid onto real dates, having `DateValue`,
`CalendarDate` and time-zone-correct arithmetic already in the dependency graph is a genuine asset
rather than bloat.

The gap is a **data table** — there is none, by design, since a table is data logic rather than an
interaction primitive.

**SSR:** _unverified._ I checked the introduction and child-snippet documentation pages and found no
statement about SSR or hydration caveats.

### Melt UI — two packages, one stalled, one slowing

Melt UI is genuinely two projects and conflating them produces wrong conclusions.

**`@melt-ui/svelte` (the original, builder-based) is effectively frozen.** Latest **0.86.6, published
2025-03-28** — sixteen months before this was written. The `melt-ui/melt-ui` repository was last pushed
2025-09-30 and has 122 open issues. Its peer range is `svelte: "^3.0.0 || ^4.0.0 || ^5.0.0-next.118"`,
which pins Svelte 5 support to a _prerelease_ identifier. Not archived, but not maintained either. Do
not start here.

**`melt` (next-gen) is the runes rewrite and is alive but slow.** Latest **0.44.0, published
2026-01-04**; `peerDependencies: {svelte: "^5.30.1", "@floating-ui/dom": "^1.6.0"}`. The
`melt-ui/next-gen` repository was last pushed **2026-03-04**, and that commit was "update dev
dependencies, fix security vulnerabilities" — seven and a half months without a release and five and a
half without a feature commit, at 328 stars. Not dead; not a foundation I would build a project on
today.

The [documentation](https://next.melt-ui.com/) says it is "Built for Svelte 5", and the
[how-to-use guide](https://next.melt-ui.com/guides/how-to-use) describes two consumption modes:
_builders_, callable from `.svelte.js|ts` files and returning attributes and state for you to spread
onto elements; and _components_, "a more traditional Svelte experience" with no built-in styling. Both
use `$state` and `$bindable`.

**Coverage** (from `packages/melt/src/lib/builders`, 18 builders): accordion, avatar, collapsible,
combobox, dialog, file-upload, pin-input, popover, progress, radio-group, select, slider, spatial-menu,
tabs, toaster, toggle, tooltip, tree. **No calendar, no date picker, no table, no command palette.**
For a planner, that absence is disqualifying on its own.

### Skeleton — a Tailwind v4 design system plus Zag-backed components

Skeleton reached **5.0.0 on 2026-07-17** — both `@skeletonlabs/skeleton` and
`@skeletonlabs/skeleton-svelte`, MIT, published within ten seconds of each other. The repository was
last pushed 2026-08-17 (6,041 stars), so this is the most recently _released_ full-stack option here.

The [SvelteKit installation page](https://www.skeleton.dev/docs/get-started/installation/sveltekit)
gives the requirements table as **Svelte 5 minimum, Tailwind 4 minimum**, and describes Skeleton as "a
UI-toolkit built on top of Tailwind [that] provides framework agnostic components". Two packages are
installed. npm confirms the split precisely: `@skeletonlabs/skeleton` declares
`peerDependencies: {tailwindcss: "^4.0.0"}` and **zero runtime dependencies** — it is purely a Tailwind
v4 layer. The [core API page](https://www.skeleton.dev/docs/get-started/core-api) describes what that
layer injects: global `@base` styles, `@theme` design tokens, a semantic colour system (primary,
secondary, tertiary, success, warning, error, surface), typography and spacing scales, and Tailwind
component styles for badges, buttons, cards and dialogs.

`@skeletonlabs/skeleton-svelte` declares `peerDependencies: {svelte: "^5.40.0"}` and its dependency list
is the interesting part: `@internationalized/date` 3.12.2 and roughly two dozen pinned `@zag-js/*`
packages at 1.42.0 — `combobox`, `date-picker`, `dialog`, `listbox`, `menu`, `floating-panel`,
`file-upload`, `toast` and so on. So Skeleton's behaviour is Zag.js state machines with a Skeleton skin
on top. (The core-api documentation page does not mention Zag; the npm manifest does.)

**Coverage** — from the published 5.0.0 tarball's `dist/components` directory (via the jsDelivr package
API), 31 components: accordion, app-bar, avatar, carousel, collapsible, **combobox**, **date-picker**,
**dialog**, file-upload, floating-panel, listbox, locale-provider, marquee, menu, navigation,
pagination, **popover**, portal, progress, qr-code, rating-group, segmented-control, slider, steps,
switch, tabs, tags-input, toast, toggle-group, tooltip, tree-view. **No data table and no command
palette.**

The real objection for this project is not coverage but the design system. Skeleton's `@theme` tokens
and semantic colour scale want to _be_ your design language. That is excellent if you have no opinion
and want a coherent app for free; it is friction if you want to write ordinary Tailwind classes and
have the components disappear into your own design.

**SSR:** _unverified_ — I found no SSR or hydration statement in the pages I read.

### Flowbite Svelte — styled components, heavy runtime

**1.33.1, published 2026-04-07**, MIT (npm), from `themesberg/flowbite-svelte`. Peer dependencies are
explicit and current: `{svelte: "^5.40.0", tailwindcss: "^4.1.4"}` — so both Svelte 5 and Tailwind v4
are hard requirements, which is a good sign.

Runtime dependencies are the problem: `apexcharts` ^5.10.4, `flowbite` ^3.1.2, `date-fns` ^4.1.0,
`@floating-ui/dom`, `@floating-ui/utils`, `clsx`, `tailwind-merge` ^3.5.0, `tailwind-variants` ^3.2.2.
Pulling in a full charting library and a second date library as non-optional dependencies is a lot of
surface for a single-user planner, and `date-fns` would sit alongside whatever this project already
uses for dates.

**Coverage is broad** — the `src/lib` directory (GitHub API) contains, among ~55 entries: `datepicker`,
**`command-palette`**, `dialog`, `modal`, `popover`, `dropdown`, `table`, `virtuallist`,
`virtual-masonry`, `forms`, `drawer`, `sidebar`, `stepper`, `tour`, `kanban`, `split-pane`,
`scroll-spy`, `toast`, `timeline`. It is the only styled set here that ships a command palette. The
presence of `uiHelpers.svelte.ts` in that directory is direct evidence of runes-era authoring (the
`.svelte.ts` extension only exists in Svelte 5).

**Maintenance signal is mixed.** GitHub releases show v1.32.1 and v1.33.1 both on 2026-04-07, and
before them a `2.0.0-next` prerelease line running to `v2.0.0-next.13` on 2026-04-02 — a v2 that has
published nothing since. Repository last pushed 2026-06-27. Four months without a stable release and a
stalled major in flight is a "wait and see" signal, not a red flag.

**Accessibility posture:** _unverified._ The pages I could reach returned HTTP 429 and I found no
accessibility claim in the README.

### DaisyUI — a CSS class layer, no JavaScript

**5.7.18, published 2026-08-18** (the day of writing), MIT, `saadeghi/daisyui`, 42,114 stars. The
manifest declares **no dependencies and no peer dependencies at all**; the package exports are
`./index.js`, `./theme`, and a couple of helper modules. It is a Tailwind plugin and nothing else.

Release cadence is extraordinary — 5.7.13 through 5.7.18 all landed between 2026-08-02 and 2026-08-18.
By release frequency it is the healthiest project in this list by a wide margin.

**Tailwind v4 is mandatory, stated flatly** in the repository's own installation instructions
(`skills/daisyui/install/SKILL.md`): _"You must use Tailwind CSS 4 with daisyUI 5."_ The setup is two
CSS lines — `@import "tailwindcss";` then `@plugin "daisyui";` — and the docs add that
`tailwind.config.js` is deprecated under v4 and should not be used. That is a near-zero-cost drop-in
for this project.

**And that is the whole story.** DaisyUI provides class names. It ships no JavaScript, no focus
trapping, no keyboard handling, no ARIA wiring, no calendar, no combobox, no command palette. The
[installation guide](https://daisyui.com/docs/install/sveltekit/) describes only applying class names
to your own markup. It is a _complement_ to a headless library, or a way to make plain HTML look
decent — not an answer to "which components do I use for the date picker".

**SSR:** trivially safe. There is no runtime to hydrate.

### Svelte Material UI — alive, but the wrong shape

Not dead, contrary to what its reputation might suggest. **9.0.3, published 2026-08-04**, Apache-2.0;
the repository was last pushed 2026-08-04 with tags v9.0.0 (2026-05-20) through v9.0.3, 3,441 stars.
The [README](https://github.com/hperrin/svelte-material-ui) states plainly: **"SMUI v8 and higher
requires Svelte 5"**, with v7 as the last Svelte 4 line, and for v9, "No more '@material' packages."

The umbrella package re-exports ~40 `@smui/*` and `@smui-extra/*` sub-packages including `data-table`,
`dialog`, `autocomplete` and `chip-input` (npm manifest). Coverage is respectable.

It does not fit here. It is Material Design with its own SCSS theming pipeline, which means adopting
Google's visual language and running a second styling system alongside Tailwind v4. Nothing about that
serves a self-hosted personal planner already committed to Tailwind. **Tailwind v4 compatibility:**
_unverified_ — SMUI declares no Tailwind relationship in either direction; the two would simply
coexist, with the usual specificity friction, which I have not verified in practice.

### Carbon Components Svelte — active, accessible, but pre-runes internally

The most active repository in this survey: **0.111.0, published 2026-08-14**, last push 2026-08-18,
Apache-2.0. Cadence is steady — 0.108.1 (2026-06-08), 0.109.0, 0.110.0, 0.110.1, 0.110.2, 0.111.0.

The [README](https://github.com/carbon-design-system/carbon-components-svelte) claims **"90+
components"**, "5 built-in themes", "fully typed TypeScript API", and — notably, and more concretely
than anyone else here — **"WCAG 2.1 AA: keyboard and screen-reader ready"**. Coverage includes
DataTable, DatePicker, ComboBox, MultiSelect, Modal, Dropdown, Pagination and forms; the 0.111.0
changelog shows active work on all of them (per-column alignment and CSV export on DataTable, a year
picker on DatePicker, a `hideCloseButton` prop on ComposedModal).

Two things rule it out for this project.

**It is authored in the legacy Svelte API, not runes.** Reading `src/Modal/Modal.svelte` from `master`
shows `export let size = undefined;` and `export let open = false;` with JSDoc `@event` annotations —
Svelte 4 props and `createEventDispatcher`-style events, running under Svelte 5's compatibility mode.
The changelog corroborates this at length: entries such as _"rename `expanded-row` slot to
`expandedRow` for Svelte 5 snippet support"_ and repeated _"prevent dispatching initial 'change' event
in Svelte 5"_ fixes are compatibility-shim work, not a runes port. It works on Svelte 5 (its own
devDependency is `svelte: "^5.56.8"`, matching this project exactly), but it is a legacy-API library
whose eventual migration is a risk you would inherit. **Whether a runes rewrite is planned is
unverified.**

**It brings its own world.** Styling is five prebuilt Carbon CSS themes imported wholesale — the IBM
design language, orthogonal to Tailwind. The DatePicker is a wrapper over `flatpickr` pinned to
4.6.9 (npm manifest). It also depends on `@ibm/telemetry-js` ^1.5.0; the package name implies build- or
usage-telemetry, but I have **not verified what it actually collects** — for a self-hosted personal
tool that is a question you would want answered before installing, not after. And it is still 0.x after
326 releases.

### Zag.js and Ark UI — the framework-agnostic layer

**`@zag-js/svelte` 1.43.1, published 2026-08-16**, MIT, `peerDependencies: {svelte: ">=5"}`, part of
`chakra-ui/zag` (last push 2026-08-18). The repository describes it as "Build your design system in
React, Solid, Vue, Svelte or Vanilla. Powered by finite state machines." Very actively maintained.
This is what Skeleton v5 is built on. Using it directly means wiring machines to markup yourself — a
lower level than Bits UI, and more work than this project needs.

**`@ark-ui/svelte` 5.23.1, published 2026-08-17**, MIT, `peerDependencies: {svelte: ">=5.20.0"}`, from
`chakra-ui/ark` (last push 2026-08-18, only 10 open issues). Its dependencies are the full `@zag-js/*`
set at 1.43.1 plus `@internationalized/date` 3.12.3, so it is the styled-API layer over Zag. Ark's
[announcement post](https://ark-ui.com/blog/introducing-ark-ui-svelte), published 2025-06-23, states
Svelte support is official, that **"Ark UI only works for Svelte 5 apps and design systems"**, and that
there are **45+ headless, accessible components** with "WAI-ARIA patterns baked in".

The Svelte package is at 5.23.1 while React, Vue and Solid are at 5.38.x (npm, and the release tags
published on 2026-08-17 show `@ark-ui/vue@5.38.2` and `@ark-ui/svelte@5.23.1` side by side) — the Svelte
port is a real, currently-released target, but it trails the other frameworks' version line by about
fifteen minors. **Whether that gap represents missing components or merely independent versioning is
unverified**; the Svelte-specific documentation URLs I tried returned 404 and I could not enumerate its
Svelte component list from a primary source.

This is the credible outsider: genuinely headless, genuinely current, backed by an organisation rather
than one maintainer. Its weakness for this project is that it is Svelte-second, where Bits UI is
Svelte-only.

## Comparison

| Library                         | Kind                                  | Version (date)       | Svelte 5 / runes                                                      | Tailwind v4                           | Calendar / date picker                                      | Dialog     | Popover    | Combobox                         | Data table                         | Command palette | Licence    | Maintenance                                  |
| ------------------------------- | ------------------------------------- | -------------------- | --------------------------------------------------------------------- | ------------------------------------- | ----------------------------------------------------------- | ---------- | ---------- | -------------------------------- | ---------------------------------- | --------------- | ---------- | -------------------------------------------- |
| **shadcn-svelte**               | copy-in source (over Bits UI)         | 1.5.0 (2026-08-02)   | Yes — registry source uses `$props`/`$bindable`; peer `svelte ^5.0.0` | Yes, default; OKLCH + `@theme inline` | Yes (`calendar`, `range-calendar`)                          | Yes        | Yes        | Composed (`command` + `popover`) | Yes (pulls `@tanstack/table-core`) | Yes (`command`) | MIT        | ~monthly releases; repo pushed 2026-08-09    |
| **Bits UI**                     | headless primitives                   | 2.18.1 (2026-05-03)  | Required — peer `svelte ^5.33.0`                                      | N/A (ships no CSS)                    | Yes — calendar, date-picker, date-field, ranges, time-field | Yes        | Yes        | Yes                              | No                                 | Yes             | MIT        | 3.5-month release gap; commits to 2026-08-10 |
| **Melt UI (`melt`, next-gen)**  | headless builders + components        | 0.44.0 (2026-01-04)  | Yes — "Built for Svelte 5", peer `^5.30.1`                            | N/A                                   | **No**                                                      | Yes        | Yes        | Yes                              | No                                 | No              | MIT        | Slowing — last commit 2026-03-04             |
| **Melt UI (`@melt-ui/svelte`)** | headless builders                     | 0.86.6 (2025-03-28)  | Prerelease pin only (`^5.0.0-next.118`)                               | N/A                                   | Yes                                                         | Yes        | Yes        | Yes                              | No                                 | No              | MIT        | **Stalled** — no release in 16 months        |
| **Skeleton**                    | design system + Zag-backed components | 5.0.0 (2026-07-17)   | Required — peer `svelte ^5.40.0`                                      | Required — peer `tailwindcss ^4.0.0`  | Yes (`date-picker`, Zag)                                    | Yes        | Yes        | Yes                              | No                                 | No              | MIT        | Just shipped v5; pushed 2026-08-17           |
| **Flowbite Svelte**             | styled components                     | 1.33.1 (2026-04-07)  | Required — peer `svelte ^5.40.0`                                      | Required — peer `tailwindcss ^4.1.4`  | Yes (`datepicker`)                                          | Yes        | Yes        | via `dropdown`/`select`          | Yes (`table`)                      | Yes             | MIT        | v2 prerelease stalled since 2026-04          |
| **DaisyUI**                     | CSS class layer                       | 5.7.18 (2026-08-18)  | N/A — no JavaScript                                                   | Required — "must use Tailwind CSS 4"  | No                                                          | Class only | No         | No                               | Class only                         | No              | MIT        | Excellent — several releases/month           |
| **Svelte Material UI**          | styled components (Material)          | 9.0.3 (2026-08-04)   | Required — "v8 and higher requires Svelte 5"                          | Unverified (own SCSS pipeline)        | Yes                                                         | Yes        | Yes (menu) | Yes (autocomplete)               | Yes                                | No              | Apache-2.0 | Alive — v9 line since 2026-05                |
| **Carbon Components Svelte**    | styled components (IBM Carbon)        | 0.111.0 (2026-08-14) | Runs on 5, **authored in legacy API** (`export let`, slots)           | No — ships own CSS themes             | Yes (wraps `flatpickr` 4.6.9)                               | Yes        | Yes        | Yes                              | Yes                                | No              | Apache-2.0 | Very active; still 0.x                       |
| **Ark UI (Svelte)**             | headless primitives (over Zag)        | 5.23.1 (2026-08-17)  | Required — peer `svelte >=5.20.0`, "only works for Svelte 5"          | N/A                                   | Yes (Zag date-picker)                                       | Yes        | Yes        | Yes                              | No                                 | Unverified      | MIT        | Very active; Svelte trails React/Vue 5.38.x  |
| **Zag.js (Svelte)**             | state machines                        | 1.43.1 (2026-08-16)  | Required — peer `svelte >=5`                                          | N/A                                   | Machine only                                                | Machine    | Machine    | Machine                          | No                                 | No              | MIT        | Very active                                  |

## Recommendation

**Primary: shadcn-svelte, backed by Bits UI as a direct dependency.**

Practically this means running `shadcn-svelte init`, adding the handful of components the planner
actually needs, and letting the CLI install `bits-ui` and `@internationalized/date` as the two real
dependencies. Everything else lands as source files in `src/lib/components/ui`.

The reasoning is specific to this project rather than general preference.

_The Tailwind v4 story is already solved here._ The migration guide's target state — `@tailwindcss/vite`,
no `tailwind.config.ts`, `@theme inline` in CSS — is exactly the configuration this repo already has.
Every styled alternative (Skeleton, Carbon, SMUI) asks you to adopt a second design language on top of
the Tailwind you already chose. shadcn-svelte's output _is_ Tailwind classes, editable in place.

_Calendar coverage is the deciding constraint._ This is a timetable application: Teaching Weeks, Slots
that hold between dates, a derived schedule. Bits UI's date cluster — `calendar`, `range-calendar`,
`date-picker`, `date-range-picker`, `date-field`, `time-field` — is the deepest of any candidate, and it
brings `@internationalized/date`, giving proper `CalendarDate` arithmetic rather than `Date`
hand-rolling. Melt UI has no calendar at all, which removes it outright.

_The dependency surface stays small and inspectable._ Two runtime packages, and Bits UI's own
dependencies are six named, small things (floating-ui, runed, tabbable, esm-env, svelte-toolbelt). Set
that against Flowbite Svelte hauling in ApexCharts and date-fns, or Carbon shipping flatpickr and a
telemetry package. For a self-hosted app on a personal box, less installed code is less to audit.

_Copy-in source suits a single developer._ There is no version to bump, no breaking-change migration
imposed on a schedule someone else sets, and when a component is wrong you edit it rather than fight a
prop API. The trade is that you own those files; for one person on one app, that is the cheaper side of
the trade.

_It tests well under vitest-browser-svelte._ Components are ordinary runes-authored `.svelte` files in
your own `src/`, imported by path like any other component. Bits UI renders real ARIA roles and
`data-*` state attributes, which is what a browser-mode test wants to query against.

The known costs, stated plainly: shadcn-svelte's `data-table` pulls in `@tanstack/table-core`, so skip
it and write plain tables unless sorting and column state genuinely earn it; there is no `combobox`
registry item, so build it from `command` + `popover` or reach for the Bits UI primitive; and Bits UI
has gone three and a half months without a release, so the plateau is worth re-checking before
committing.

**Alternative: Bits UI on its own, no shadcn-svelte.**

If you would rather write every class yourself than inherit someone else's Tailwind opinions, install
`bits-ui` and skip the CLI entirely. You get identical behaviour and accessibility with one dependency
instead of a CLI plus 206 registry items, and no generated code in your repository at all. The cost is
that you write all the styling — including the fiddly parts like calendar cell states, dialog overlays
and popover animation — where shadcn-svelte hands you tuned defaults for free.

**Deliberately not recommended, with reasons:** Skeleton and Flowbite because they impose a design
system where this project already has Tailwind; Carbon and SMUI additionally because they bring
non-Tailwind styling pipelines, and Carbon because it is authored in the pre-runes API; DaisyUI because
it has no JavaScript and therefore cannot supply a date picker, combobox or dialog, though it remains a
reasonable _addition_ later if you want quick class-level styling; Melt UI because it has no calendar
and its release cadence has stalled; Zag.js because it is a layer lower than needed; Ark UI only
because Bits UI is Svelte-native and Ark's Svelte port trails its other targets — it is the closest
runner-up and worth revisiting if Bits UI's release gap widens.

## Unverified

Recorded explicitly rather than guessed:

- **SSR / hydration behaviour under SvelteKit.** No candidate's documentation that I reached makes an
  explicit statement about SSR or hydration caveats — not shadcn-svelte, Bits UI, Skeleton or Melt.
  Absence of a stated caveat is not the same as a guarantee. Verify by rendering a dialog and a date
  picker in a real SvelteKit route before committing.
- **Ark UI Svelte's component list and version-parity meaning.** `@ark-ui/svelte` 5.23.1 versus
  `@ark-ui/vue` 5.38.2 may reflect missing components or merely independent release lines. The
  Svelte-specific documentation URLs I tried returned 404.
- **Flowbite Svelte's accessibility posture.** Its documentation returned HTTP 429 on repeated attempts
  and the README makes no accessibility claim.
- **What `@ibm/telemetry-js` collects** in Carbon Components Svelte. Its presence in `dependencies` is
  confirmed; its behaviour is not.
- **Svelte Material UI's Tailwind v4 interaction.** Neither project declares a relationship; whether
  their CSS coexists cleanly is untested here.
- **Whether Carbon Components Svelte plans a runes rewrite.** The legacy authoring is confirmed from
  source; the roadmap is not.

## Sources

npm registry manifests (read via `https://registry.npmjs.org/<pkg>`) for version, publish date,
licence, peer dependencies, dependencies and release history: `bits-ui`, `melt`, `@melt-ui/svelte`,
`@skeletonlabs/skeleton`, `@skeletonlabs/skeleton-svelte`, `flowbite-svelte`, `daisyui`,
`svelte-material-ui`, `carbon-components-svelte`, `@zag-js/svelte`, `@ark-ui/svelte`, `shadcn-svelte`,
`@internationalized/date`.

GitHub REST API (repository metadata, releases, tags, commits, directory listings) for
`huntabyte/bits-ui`, `huntabyte/shadcn-svelte`, `melt-ui/next-gen`, `melt-ui/melt-ui`,
`skeletonlabs/skeleton`, `themesberg/flowbite-svelte`, `saadeghi/daisyui`, `hperrin/svelte-material-ui`,
`carbon-design-system/carbon-components-svelte`, `chakra-ui/ark`, `chakra-ui/zag`.

jsDelivr package API for the published contents of `@skeletonlabs/skeleton-svelte@5.0.0`.

Documentation and repository pages:

- shadcn-svelte — [SvelteKit installation](https://shadcn-svelte.com/docs/installation/sveltekit),
  [Tailwind v4 migration](https://shadcn-svelte.com/docs/migration/tailwind-v4),
  [registry index](https://shadcn-svelte.com/registry/index.json), registry items
  `calendar.json`, `command.json`, `data-table.json`, `popover.json`, `dialog.json`,
  [README](https://github.com/huntabyte/shadcn-svelte)
- Bits UI — [introduction](https://bits-ui.com/docs/introduction),
  [getting started](https://bits-ui.com/docs/getting-started),
  [child snippet](https://bits-ui.com/docs/child-snippet),
  [README](https://github.com/huntabyte/bits-ui),
  source tree `packages/bits-ui/src/lib/bits`
- Melt UI — [next-gen home](https://next.melt-ui.com/),
  [how to use](https://next.melt-ui.com/guides/how-to-use),
  [legacy README](https://github.com/melt-ui/melt-ui),
  source tree `packages/melt/src/lib/builders`
- Skeleton — [SvelteKit installation](https://www.skeleton.dev/docs/get-started/installation/sveltekit),
  [core API](https://www.skeleton.dev/docs/get-started/core-api)
- Flowbite Svelte — [README](https://github.com/themesberg/flowbite-svelte), source tree `src/lib`
- DaisyUI — [installation](https://daisyui.com/docs/install/),
  [SvelteKit installation](https://daisyui.com/docs/install/sveltekit/),
  [README](https://github.com/saadeghi/daisyui),
  repository files `skills/daisyui/install/SKILL.md` and the docs upgrade page
- Svelte Material UI — [README](https://github.com/hperrin/svelte-material-ui)
- Carbon Components Svelte —
  [README](https://github.com/carbon-design-system/carbon-components-svelte),
  [CHANGELOG](https://github.com/carbon-design-system/carbon-components-svelte/blob/master/CHANGELOG.md),
  `src/Modal/Modal.svelte` on `master`
- Ark UI — [Introducing Ark UI Svelte](https://ark-ui.com/blog/introducing-ark-ui-svelte),
  [introduction](https://ark-ui.com/docs/overview/introduction)
