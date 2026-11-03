import { describe, expect, test } from 'vitest';
import { setUp } from './fixtures';
import {
	agenda,
	agendaLookBackEvents,
	blockDay,
	calendarWeek,
	createEvent,
	setEventNote,
	takeEventSlot
} from './index';

// The calendar's fixed points (fixtures.ts): w/c 2 Nov 2026 is Week A, then B, A, B.
function withEvent() {
	const ctx = setUp();
	const event = createEvent(ctx.db, { name: 'Y11 intervention', kind: 'intervention' });
	takeEventSlot(ctx.db, { eventId: event.id, week: 'A', day: 1, position: 2, from: null });
	takeEventSlot(ctx.db, { eventId: event.id, week: 'A', day: 3, position: 7, from: null });
	return { ...ctx, event };
}

describe('the Calendar week carries the Events that occur in it', () => {
	test('each Event occurrence lands on its date and position, with its kind and note', () => {
		const { db, event } = withEvent();
		setEventNote(db, { eventId: event.id, date: '2026-11-02', note: 'Past paper Q4' });

		const week = calendarWeek(db, { weekCommencing: '2026-11-02', today: '2026-11-01' })!;
		expect(week.events.map((e) => [e.date, e.position, e.kind, e.note])).toEqual([
			['2026-11-02', 2, 'intervention', 'Past paper Q4'],
			['2026-11-04', 7, 'intervention', null]
		]);
	});

	test('a week of the other letter has none', () => {
		const { db } = withEvent();
		const week = calendarWeek(db, { weekCommencing: '2026-11-09', today: '2026-11-01' })!;
		expect(week.events).toEqual([]);
	});

	test('a Blocked Day drops its Events and the rest of the week keeps theirs', () => {
		const { db } = withEvent();
		blockDay(db, { date: '2026-11-02', today: '2026-11-01' });

		const week = calendarWeek(db, { weekCommencing: '2026-11-02', today: '2026-11-01' })!;
		expect(week.events.map((e) => e.date)).toEqual(['2026-11-04']);
	});
});

describe('the Agenda carries Events across its horizon', () => {
	test('a horizon of one week holds this week’s Events and no later ones', () => {
		const { db } = withEvent();
		const { events } = agenda(db, { today: '2026-11-02', horizonDays: 5 });
		expect(events.map((e) => e.date)).toEqual(['2026-11-02', '2026-11-04']);
	});

	test('All reaches the last Term, skipping a School Holiday and a Blocked Day', () => {
		const { db } = withEvent();
		blockDay(db, { date: '2026-11-16', today: '2026-11-01' });
		const { events } = agenda(db, { today: '2026-10-19', horizonDays: null });
		const mondays = events.filter((e) => e.position === 2).map((e) => e.date);
		expect(mondays).not.toContain('2026-10-26');
		expect(mondays).not.toContain('2026-11-16');
		expect(mondays).toContain('2026-11-02');
		expect(mondays.at(-1)! <= '2027-07-19').toBe(true);
	});

	test('the look-back holds the Events of the seven days before today', () => {
		const { db } = withEvent();
		const dates = agendaLookBackEvents(db, { today: '2026-11-09' }).map((e) => e.date);
		expect(dates).toEqual(['2026-11-02', '2026-11-04']);
		expect(agendaLookBackEvents(db, { today: '2026-11-02' }).map((e) => e.date)).toEqual([]);
	});
});
