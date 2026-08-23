// PROTOTYPE — throwaway. Two ways to make the toast carry its own status colour, because #80's
// answer ("A, with a coloured toast") raises a question the token set does not answer: rhea has a
// `--destructive` but no success colour, so colouring a *success* toast means adding one.
//
// Sonner exposes six variables per status. `rich` leaves its stock palette alone; `token` rebuilds
// the same six from our own tokens, so error matches the destructive Alert exactly and both themes
// fall out of one recipe rather than being hand-picked twice.
//
// `rich` won. `token` is kept as the rejected alternative: it buys an exact match with the
// destructive Alert at the price of inventing a success colour the design system does not have,
// and the toast is transient chrome that never sits beside the Alert anyway.

export type Tint = 'rich' | 'token';

// The shadcn wrapper sets these three inline; passing `style` replaces that, so they come along.
const NORMAL = [
	'--normal-bg: var(--color-popover)',
	'--normal-text: var(--color-popover-foreground)',
	'--normal-border: var(--color-border)'
];

// The one colour the design system is missing. Held at rhea's own lightness/chroma discipline
// rather than picked by eye: a mid green in light, lifted and desaturated for dark, the same move
// #67 made for the Class tones.
const SUCCESS_LIGHT = 'oklch(0.55 0.13 150)';
const SUCCESS_DARK = 'oklch(0.72 0.12 150)';

// One recipe, applied to whatever hue is handed in: a wash of it over the popover for the fill, the
// hue itself for the text, and a quarter-strength edge. Both themes read from `--popover`, so the
// dark variant is derived rather than written down twice.
const status = (name: string, hue: string) => [
	`--${name}-bg: color-mix(in oklab, ${hue} 12%, var(--color-popover))`,
	`--${name}-text: ${hue}`,
	`--${name}-border: color-mix(in oklab, ${hue} 28%, var(--color-popover))`
];

export function toasterStyle(tint: Tint, dark: boolean): string | undefined {
	if (tint === 'rich') return undefined;
	return [
		...NORMAL,
		...status('error', 'var(--color-destructive)'),
		...status('success', dark ? SUCCESS_DARK : SUCCESS_LIGHT)
	].join('; ');
}
