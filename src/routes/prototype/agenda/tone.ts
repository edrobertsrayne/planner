/*
	PROTOTYPE — throwaway. The tone tokens settled on #67 read back as inline styles.

	`--tone-{0-7}-{bg|fg|ring}` now live in `layout.css` for real (Curve A / Tint, Relieved hues).
	Converting `classTone()` in `$lib/client/class-tone.ts` from literal Tailwind utilities to this
	shape is the rebuild's job, per #59 — this is the prototype's stand-in for it.

	Inline `style:` rather than Tailwind arbitrary values because the token indirection is the
	point: swapping the tone strength (see ./tones.css) has to change nothing in the markup.
*/
export function tone(i: number) {
	return {
		bg: `var(--tone-${i}-bg)`,
		fg: `var(--tone-${i}-fg)`,
		ring: `var(--tone-${i}-ring)`
	};
}

export type ToneStrength = 'tint' | 'block';
