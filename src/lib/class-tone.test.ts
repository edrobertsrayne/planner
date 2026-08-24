import { describe, expect, it } from 'vitest';
import { classTone, nextTone, TONE_SEQUENCE } from './class-tone';

const TOKEN = /^var\(--tone-([0-7])-(bg|fg|ring)\)$/;

function positionOf(value: string): number {
	const match = value.match(TOKEN);
	if (!match) throw new Error(`${value} is not a --tone-N-{bg|fg|ring} reference`);
	return Number(match[1]);
}

// The hue of each Tone position, as settled in layout.css on issue #83 — indigo 266° first,
// every gap opened to 35°+ across the set.
const HUES = [266, 140, 225, 305, 66, 20, 185, 340];

function circularGap(a: number, b: number) {
	const d = Math.abs(HUES[a] - HUES[b]) % 360;
	return Math.min(d, 360 - d);
}

// Creates n Classes starting from none, returning the Tones they were handed.
function create(n: number): number[] {
	const live: number[] = [];
	for (let i = 0; i < n; i++) {
		const tone = nextTone(live);
		live.push(tone);
	}
	return live;
}

describe('nextTone', () => {
	it('hands out all eight positions in the fixed walk before repeating any', () => {
		const handed = create(8);
		expect(new Set(handed).size).toBe(8);
	});

	it('consecutive additions land far apart on the wheel', () => {
		let previous = TONE_SEQUENCE[0];
		for (let i = 1; i < TONE_SEQUENCE.length; i++) {
			expect(circularGap(previous, TONE_SEQUENCE[i])).toBeGreaterThanOrEqual(75);
			previous = TONE_SEQUENCE[i];
		}
	});

	it('a deleted position is reused and nothing else moves', () => {
		// Three Classes hold positions 0, 4 and 6 of the walk; deleting the second frees its
		// position for the next Class, while its neighbours keep theirs.
		const survivors = create(3).filter((_, i) => i !== 1);
		expect(survivors).toEqual([TONE_SEQUENCE[0], TONE_SEQUENCE[2]]);
		expect(nextTone(survivors)).toBe(TONE_SEQUENCE[1]); // handed out again next
	});

	it('past eight live Classes the sequence wraps, spaced apart', () => {
		const eight = create(8);
		expect(nextTone(eight)).toBe(TONE_SEQUENCE[0]);
		expect(nextTone([...eight, TONE_SEQUENCE[0]])).toBe(TONE_SEQUENCE[1]);
		expect(nextTone([...eight, TONE_SEQUENCE[0], TONE_SEQUENCE[1]])).toBe(TONE_SEQUENCE[2]);
	});

	it('no existing Tone is disturbed by a create or a delete', () => {
		const before = create(5);
		const kept = before[2];

		// Creating appends without touching anyone already holding a Tone...
		const afterCreate = [...before, nextTone(before)];
		expect(afterCreate[2]).toBe(kept);

		// ...and a delete takes away only its own holder's Tone, which is then handed out again.
		const last = afterCreate.at(-1)!;
		const afterDelete = afterCreate.filter((tone) => tone !== last);
		expect(afterDelete[2]).toBe(kept);
		expect(nextTone(afterDelete)).toBe(last);
	});
});

describe('classTone', () => {
	it('maps a stored tone to bg, fg and ring references of that one slot', () => {
		for (const tone of [0, 4, 7]) {
			const t = classTone(tone);
			expect(t.bg).toMatch(TOKEN);
			expect(t.fg).toMatch(TOKEN);
			expect(t.ring).toMatch(TOKEN);
			expect(positionOf(t.bg)).toBe(tone);
			expect(positionOf(t.fg)).toBe(tone);
			expect(positionOf(t.ring)).toBe(tone);
		}
	});

	it('names no Tailwind palette utility', () => {
		for (const tone of [0, 4, 7]) {
			for (const value of Object.values(classTone(tone))) {
				expect(value).toMatch(/^var\(--/);
				expect(value).not.toMatch(/-\d00|stone|emerald|sky|violet|amber|rose|teal|fuchsia|indigo/);
			}
		}
	});
});
