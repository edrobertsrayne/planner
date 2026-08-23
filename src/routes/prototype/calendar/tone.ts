/*
	PROTOTYPE — throwaway. The tone tokens settled on #67, read back as inline styles.

	`--tone-{0-7}-{bg|fg|ring}` live in `layout.css` for real (Curve A / Tint, Relieved hues), and
	#68 confirmed Tint holds on a real surface, so there is no tone-strength axis here — the loud
	fallback is closed. Converting `classTone()` in `$lib/client/class-tone.ts` off literal Tailwind
	is still the rebuild's job (#59); this stands in for it.
*/
export function tone(i: number) {
	return {
		bg: `var(--tone-${i}-bg)`,
		fg: `var(--tone-${i}-fg)`,
		ring: `var(--tone-${i}-ring)`
	};
}

/**
 * How much of the tone a cell wears — the ticket's "how a Class is distinguished", separated from
 * the layout question so the two can be judged independently.
 *
 *   fill   — the whole cell is the tone. Closest to today's grid.
 *   chip   — a neutral card cell; the tone is a Badge-shaped chip on the Class label only.
 *   stripe — a neutral card cell; the tone is a thick left edge and nothing else.
 *
 * The Agenda (#68) settled on stripe *and* chip together, which these three bracket.
 */
export type ClassCue = 'fill' | 'chip' | 'stripe';

export function skin(toneIndex: number, cue: ClassCue) {
	const t = tone(toneIndex);
	return {
		/** Cell background, or undefined to leave it on `bg-card`. */
		surface: cue === 'fill' ? t.bg : undefined,
		/** Cell border colour, or undefined for the default `border`. */
		edge: cue === 'fill' ? t.ring : undefined,
		/** Left-edge stripe colour, or undefined for no stripe. */
		stripe: cue === 'stripe' ? t.ring : undefined,
		/** Class-label chip colours, or undefined to render the label as plain text. */
		chipBg: cue === 'chip' ? t.bg : undefined,
		chipFg: cue === 'chip' ? t.fg : undefined,
		/** The Class label's own colour when it is not a chip. */
		labelFg: cue === 'fill' ? t.fg : undefined
	};
}
