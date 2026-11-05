import { describe, expect, test } from 'vitest';
import { earlierNote, notesByDate, openDate } from './notes-by-date';

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

// The Notes tab shows one date at a time, picked from a strip of every date.
describe('which date the Notes tab opens on', () => {
	const cards = notesByDate([
		o('2026-10-21', 2, null, 'Agreed weekly check-ins'),
		o('2026-11-04', 2),
		o('2026-11-18', 2)
	]);

	test('the date a link names, when the Event has it', () => {
		expect(openDate(cards, '2026-11-04', '2026-11-18')).toBe('2026-11-18');
	});

	test('otherwise the next date, today included', () => {
		expect(openDate(cards, '2026-11-04', null)).toBe('2026-11-04');
		expect(openDate(cards, '2026-11-05', null)).toBe('2026-11-18');
	});

	test('a date the Event does not have falls back to the next one', () => {
		expect(openDate(cards, '2026-11-05', '2026-11-11')).toBe('2026-11-18');
	});

	test('when every date has passed, the latest, to log it', () => {
		expect(openDate(cards, '2027-01-01', null)).toBe('2026-11-18');
	});

	test('an Event with no dates opens on none', () => {
		expect(openDate([], '2026-11-04', null)).toBeNull();
	});
});

describe('the earlier note shown while planning a date', () => {
	const cards = notesByDate([
		o('2026-09-23', 2),
		o('2026-10-07', 2, null, 'Set up the group'),
		o('2026-10-21', 2),
		o('2026-11-04', 2)
	]);

	test('is the nearest earlier date that has a note, skipping empty ones', () => {
		expect(earlierNote(cards, '2026-11-04')).toEqual({
			date: '2026-10-07',
			note: 'Set up the group'
		});
	});

	test('is absent when no earlier date has a note', () => {
		expect(earlierNote(cards, '2026-10-07')).toBeNull();
	});
});
