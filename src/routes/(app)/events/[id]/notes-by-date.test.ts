import { describe, expect, test } from 'vitest';
import { notesByDate } from './notes-by-date';

const o = (
	date: string,
	position: number,
	room: string | null = null,
	note: string | null = null
) => ({
	date,
	position,
	room,
	note
});

// One note per Event per date (ADR-0029): an Event that holds two positions on a date has one
// card for that date, naming both.
describe('the Notes tab shows one card per date', () => {
	test('occurrences on different dates stay separate, in order', () => {
		expect(notesByDate([o('2026-11-02', 2), o('2026-11-16', 2)]).map((d) => d.date)).toEqual([
			'2026-11-02',
			'2026-11-16'
		]);
	});

	test('two positions on one date make one card carrying both, with their Rooms', () => {
		const [card, ...rest] = notesByDate([o('2026-11-02', 0, 'S4'), o('2026-11-02', 6)]);
		expect(rest).toEqual([]);
		expect(card.positions).toEqual([
			{ position: 0, room: 'S4' },
			{ position: 6, room: null }
		]);
	});

	test('the card carries the date’s one note', () => {
		const [card] = notesByDate([o('2026-11-02', 0, null, 'Q4'), o('2026-11-02', 6, null, 'Q4')]);
		expect(card.note).toBe('Q4');
	});
});
