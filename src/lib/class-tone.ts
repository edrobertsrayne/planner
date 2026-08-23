// A Class's Tone is a fact stored on the Class and assigned once, at creation (ADR-0013): the
// next unused position in a fixed farthest-point walk of the eight Tone positions, so consecutive
// Classes land far apart on the hue wheel. A position freed by deletion is reused; past eight live
// Classes the sequence wraps and duplicates appear, spaced apart. Nothing here ever moves an
// existing Class's Tone.
//
// The eight positions are the tone tokens defined in src/routes/layout.css
// (`--tone-{0-7}-{bg|fg|ring}`, issue #83): position 0 indigo, then emerald, sky, violet, amber,
// rose, teal, fuchsia. Handing back var() references rather than Tailwind utilities keeps this
// file out of the palette business; consumers style with them inline, so both theme variants come
// free from the .dark override.

export const TONE_SEQUENCE = [0, 4, 6, 7, 1, 2, 5, 3];

// Pure: given the Tones the live Classes hold — a multiset once past eight — returns the next.
// The earliest position of the walk no live Class holds, or, when all eight are held, the
// least-held position, earliest first, so wrapped duplicates stay spaced apart.
export function nextTone(inUse: readonly number[]): number {
	const counts = new Map<number, number>();
	for (const tone of inUse) counts.set(tone, (counts.get(tone) ?? 0) + 1);
	for (const tone of TONE_SEQUENCE) if (!counts.has(tone)) return tone;
	return TONE_SEQUENCE.reduce((earliest, tone) =>
		counts.get(tone)! < counts.get(earliest)! ? tone : earliest
	);
}

// A stored Tone index to its token role names.
export function classTone(tone: number) {
	return {
		bg: `var(--tone-${tone}-bg)`,
		fg: `var(--tone-${tone}-fg)`,
		ring: `var(--tone-${tone}-ring)`
	};
}
