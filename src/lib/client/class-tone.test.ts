import { describe, expect, it } from 'vitest';
import { classTone } from './class-tone';

const TOKEN = /^var\(--tone-([0-7])-(bg|fg|ring)\)$/;

function slotOf(value: string): number {
	const match = value.match(TOKEN);
	if (!match) throw new Error(`${value} is not a --tone-N-{bg|fg|ring} reference`);
	return Number(match[1]);
}

describe('classTone', () => {
	it('hands back bg, fg and ring as references to one tone slot', () => {
		const tone = classTone('9B/Sc1');
		expect(tone.bg).toMatch(TOKEN);
		expect(tone.fg).toMatch(TOKEN);
		expect(tone.ring).toMatch(TOKEN);
		expect(new Set([slotOf(tone.bg), slotOf(tone.fg), slotOf(tone.ring)]).size).toBe(1);
	});

	it('names no Tailwind palette utility', () => {
		for (let i = 0; i < 64; i++) {
			const tone = classTone(`cls-${i}`);
			expect(tone.bg).toMatch(TOKEN);
			expect(tone.fg).toMatch(TOKEN);
			expect(tone.ring).toMatch(TOKEN);
		}
	});

	it('is stable for a given Class id', () => {
		expect(classTone('9B/Sc1')).toEqual(classTone('9B/Sc1'));
	});

	it('still selects the slot by hashing the id', () => {
		const slots = new Set(Array.from({ length: 64 }, (_, i) => slotOf(classTone(`cls-${i}`).bg)));
		expect(slots.size).toBeGreaterThan(1);
	});
});
