// The planner's design system (docs/adr/0031-the-calm-design-system.md): small Svelte components
// over the Calm tokens in src/routes/layout.css, styled by ./ui.css. Compound parts are imported
// as namespaces — `import * as Dialog from '$lib/ui/dialog'`.
export { default as Button, type ButtonProps } from './button.svelte';
export { default as Input } from './input.svelte';
export { default as Textarea } from './textarea.svelte';
export { default as Label } from './label.svelte';
export { default as Badge } from './badge.svelte';
export { default as Separator } from './separator.svelte';
export { default as Select, type SelectOption } from './select.svelte';
export { touchTarget } from './touch-target';
