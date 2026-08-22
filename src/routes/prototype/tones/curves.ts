/*
	PROTOTYPE — throwaway. Issue #67: pick the OKLCH curve for the eight Class tones.

	Eight fixed hue angles; one shared lightness/chroma curve per role for light, a second for
	dark — the formula-driven approach settled by #59. A curve is the variable under test, so the
	three variants here are three curves, and every surface below renders identically under each.
*/

export type Role = 'bg' | 'fg' | 'ring';

/*
	L and saturation for one role; hue comes from the tone. `sat` is a *fraction* of how much
	chroma that hue can hold at that lightness in sRGB, not an absolute C — see maxChroma(). The
	ceiling varies roughly threefold across these eight hues (at L 0.40, teal tops out at C 0.096
	and indigo at C 0.298), so one absolute chroma either clips the blues or leaves teal and
	emerald grey. A fraction is the only form of this curve that can be both in gamut and colourful.
*/
type Stop = { l: number; sat: number };
export type Curve = Record<Role, Stop>;

export type Variant = {
	key: string;
	name: string;
	blurb: string;
	light: Curve;
	dark: Curve;
};

/*
	The eight hues, in the index order `classTone()` hashes into. `indigo` replaces `stone` at 0
	(#59). Angles are Tailwind's own -500 hues, so the tones stay recognisably the same colours.
	`cMul` is the per-hue override hatch the ticket allows: 1 everywhere until a clash forces it.
*/
export const TONES = [
	{ name: 'indigo', h: 269.4, cMul: 1 },
	{ name: 'emerald', h: 162.5, cMul: 1 },
	{ name: 'sky', h: 237.3, cMul: 1 },
	{ name: 'violet', h: 293.5, cMul: 1 },
	{ name: 'amber', h: 70.1, cMul: 1 },
	{ name: 'rose', h: 16.4, cMul: 1 },
	{ name: 'teal', h: 182.5, cMul: 1 },
	{ name: 'fuchsia', h: 322.2, cMul: 1 }
] as const;

export const VARIANTS: Variant[] = [
	{
		key: 'A',
		name: 'Tint',
		blurb:
			'A port of today’s look: pale coloured fill, dark coloured text, mid ring — roughly Tailwind 100/800/400, rebuilt on one curve. Dark mode drops the fill to just above the card.',
		light: { bg: { l: 0.95, sat: 0.75 }, fg: { l: 0.4, sat: 0.85 }, ring: { l: 0.78, sat: 0.8 } },
		dark: { bg: { l: 0.28, sat: 0.55 }, fg: { l: 0.87, sat: 0.8 }, ring: { l: 0.6, sat: 0.8 } }
	},
	{
		key: 'B',
		name: 'Block',
		blurb:
			'The fill carries the colour. Saturated bg with near-white/near-black text on top, and a mid fill in dark rather than a tint. Loudest, and the easiest to tell apart across a grid.',
		light: { bg: { l: 0.88, sat: 0.85 }, fg: { l: 0.3, sat: 0.7 }, ring: { l: 0.66, sat: 0.95 } },
		dark: { bg: { l: 0.45, sat: 0.8 }, fg: { l: 0.96, sat: 0.5 }, ring: { l: 0.7, sat: 0.95 } }
	},
	{
		key: 'C',
		name: 'Ink',
		blurb:
			'Colour lives in the text and the ring; the fill stays all but neutral in both themes. Quietest against rhea’s neutral chrome — it bets that a coloured edge and label are enough.',
		light: { bg: { l: 0.975, sat: 0.55 }, fg: { l: 0.48, sat: 1 }, ring: { l: 0.62, sat: 1 } },
		dark: { bg: { l: 0.24, sat: 0.5 }, fg: { l: 0.8, sat: 0.95 }, ring: { l: 0.66, sat: 1 } }
	}
];

/** The absolute chroma a stop resolves to for one tone. */
export function chromaOf(v: Variant, theme: 'light' | 'dark', i: number, role: Role) {
	const stop = v[theme][role];
	return maxChroma(stop.l, TONES[i].h) * stop.sat * TONES[i].cMul;
}

export function toneColor(v: Variant, theme: 'light' | 'dark', i: number, role: Role) {
	return `oklch(${v[theme][role].l} ${chromaOf(v, theme, i, role).toFixed(4)} ${TONES[i].h})`;
}

/** The whole table as CSS custom properties, for a `style=` on a themed wrapper. */
export function toneVars(v: Variant, theme: 'light' | 'dark') {
	const out: string[] = [];
	TONES.forEach((_, i) => {
		for (const role of ['bg', 'fg', 'ring'] as Role[]) {
			out.push(`--tone-${i}-${role}: ${toneColor(v, theme, i, role)}`);
		}
	});
	return out.join('; ');
}

/* ---- gamut + contrast readouts ------------------------------------------------------------
	Two things kill distinguishability silently: a colour that falls outside sRGB and gets clipped
	(several hues collapse onto the same clipped value), and fg-on-bg that doesn't clear WCAG.
	Both are cheap to compute, so the prototype reports them rather than leaving them to the eye.
*/

function oklchToLinearSrgb(l: number, c: number, hDeg: number) {
	const h = (hDeg * Math.PI) / 180;
	const a = c * Math.cos(h);
	const b = c * Math.sin(h);
	const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
	const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
	const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
	return [
		4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
		-1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
		-0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_
	];
}

/*
	How far outside sRGB a colour falls, in linear-light units. A saturated colour is rarely exactly
	zero — Tailwind's own indigo-100 overflows by 0.004 — so the ceiling below allows a hair of
	overflow rather than chasing zero. Past that, the browser's clip starts pulling neighbouring
	hues onto the same pixel, which is precisely what costs distinguishability.
*/
function overflowAt(l: number, c: number, h: number) {
	const rgb = oklchToLinearSrgb(l, c, h);
	return Math.max(0, ...rgb.map((x) => Math.max(x - 1, -x)));
}

export const CLIP_LIMIT = 0.02;

/** The most chroma this hue holds at this lightness before sRGB clips it. */
export function maxChroma(l: number, h: number) {
	let lo = 0;
	let hi = 0.4;
	for (let i = 0; i < 30; i++) {
		const mid = (lo + hi) / 2;
		if (overflowAt(l, mid, h) > CLIP_LIMIT) hi = mid;
		else lo = mid;
	}
	return lo;
}

export function gamutOverflow(v: Variant, theme: 'light' | 'dark', i: number, role: Role) {
	return overflowAt(v[theme][role].l, chromaOf(v, theme, i, role), TONES[i].h);
}

export function outOfGamut(v: Variant, theme: 'light' | 'dark', i: number, role: Role) {
	return gamutOverflow(v, theme, i, role) > CLIP_LIMIT;
}

function relativeLuminance(l: number, c: number, h: number) {
	const [r, g, b] = oklchToLinearSrgb(l, c, h).map((x) => Math.min(1, Math.max(0, x)));
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast of a tone's fg on its own bg. Small text wants 4.5, large/bold 3. */
export function contrast(v: Variant, theme: 'light' | 'dark', i: number) {
	const t = TONES[i];
	const a = relativeLuminance(v[theme].fg.l, chromaOf(v, theme, i, 'fg'), t.h);
	const b = relativeLuminance(v[theme].bg.l, chromaOf(v, theme, i, 'bg'), t.h);
	const [hi, lo] = a > b ? [a, b] : [b, a];
	return (hi + 0.05) / (lo + 0.05);
}
