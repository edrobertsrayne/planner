import { describe, expect, test } from 'vitest';
import { refused, setUp } from './fixtures';
import {
	activeEventSlots,
	addSlot,
	blockDay,
	eventOccurrences,
	clearEventSlot,
	createClass,
	createEvent,
	deleteEvent,
	eventSlotsOf,
	findEvent,
	listEvents,
	renameEvent,
	setEventNote,
	setEventSlotRoom,
	takeEventSlot,
	toggleEventSlot,
	unblockDay
} from './index';

// ADR-0029: an Event holds a position no Class holds, and a Class cannot take one an Event holds.
// Position 0 is Before school, 1 to 6 are the Periods, 7 is After school.
describe('an Event Slot never shares a position with a Class Slot', () => {
	test('an Event cannot take a position a Class holds, and the refusal names the Class', () => {
		const { db } = setUp();
		const event = createEvent(db, { name: 'Y11 intervention', kind: 'intervention' });

		// 9B/Sc1 holds Week A Mon P3 for the whole year (setUp).
		refused(
			() =>
				takeEventSlot(db, {
					eventId: event.id,
					week: 'A',
					day: 1,
					position: 3,
					from: '2026-11-02'
				}),
			'conflict',
			'Week A Mon P3 already belongs to 9B/Sc1 over these dates.'
		);
	});

	test('a Class cannot take a position an Event holds, and the refusal names the Event', () => {
		const { db, course } = setUp();
		const event = createEvent(db, { name: 'Y11 intervention', kind: 'intervention' });
		takeEventSlot(db, { eventId: event.id, week: 'A', day: 1, position: 2, from: null });
		const classC = createClass(db, { label: '9C/Sc2', courseId: course.id })!;

		refused(
			() => addSlot(db, { classId: classC.id, week: 'A', day: 1, period: 2 }),
			'conflict',
			'Week A Mon P2 already belongs to Y11 intervention over these dates.'
		);
	});

	test('an Event may hold Before school and After school, which no Class can', () => {
		const { db, course } = setUp();
		const event = createEvent(db, { name: 'Physics club', kind: 'club' });

		const before = takeEventSlot(db, {
			eventId: event.id,
			week: 'B',
			day: 2,
			position: 0,
			from: null
		});
		const after = takeEventSlot(db, {
			eventId: event.id,
			week: 'B',
			day: 2,
			position: 7,
			from: null
		});
		expect([before.slot.position, after.slot.position]).toEqual([0, 7]);

		const classC = createClass(db, { label: '9C/Sc2', courseId: course.id })!;
		expect(() => addSlot(db, { classId: classC.id, week: 'B', day: 2, period: 7 })).toThrow(
			/period/i
		);
	});

	test('two Events cannot share a position over dates where both hold', () => {
		const { db } = setUp();
		const first = createEvent(db, { name: 'Briefing', kind: 'meeting' });
		const second = createEvent(db, { name: 'Duty: gate', kind: 'other' });
		takeEventSlot(db, { eventId: first.id, week: 'A', day: 2, position: 0, from: null });

		refused(
			() => takeEventSlot(db, { eventId: second.id, week: 'A', day: 2, position: 0, from: null }),
			'conflict',
			'Week A Tue Before school already belongs to Briefing over these dates.'
		);
	});
});

describe('Event Slots hold between dates, as Slots do (ADR-0006)', () => {
	const position = { week: 'A', day: 1, position: 2 } as const;

	test('an Event Slot is active only on the dates it holds, and reads with its Event', () => {
		const { db } = setUp();
		const event = createEvent(db, { name: 'Y11 intervention', kind: 'intervention' });
		takeEventSlot(db, { eventId: event.id, ...position, from: '2026-11-09' });

		expect(activeEventSlots(db, '2026-11-02')).toEqual([]);
		const [active] = activeEventSlots(db, '2026-11-09');
		expect(active).toMatchObject({ eventId: event.id, name: 'Y11 intervention', position: 2 });
	});

	test('clearing ends the Event Slot the day before, and the position is free from then', () => {
		const { db, course } = setUp();
		const event = createEvent(db, { name: 'Y11 intervention', kind: 'intervention' });
		takeEventSlot(db, { eventId: event.id, ...position, from: null });

		clearEventSlot(db, { eventId: event.id, ...position, from: '2027-01-04' });
		expect(activeEventSlots(db, '2027-01-03')).toHaveLength(1);
		expect(activeEventSlots(db, '2027-01-04')).toEqual([]);

		// The replacement starts the day the Event ends, which window-aware uniqueness allows.
		const classC = createClass(db, { label: '9C/Sc2', courseId: course.id })!;
		expect(
			addSlot(db, { classId: classC.id, ...position, period: 2, holdsFrom: '2027-01-04' })
		).toBeTruthy();
	});

	test('clearing from the day an Event Slot began removes it outright', () => {
		const { db } = setUp();
		const event = createEvent(db, { name: 'Briefing', kind: 'meeting' });
		takeEventSlot(db, { eventId: event.id, ...position, from: '2026-11-09' });

		clearEventSlot(db, { eventId: event.id, ...position, from: '2026-11-09' });
		expect(activeEventSlots(db, '2027-06-01')).toEqual([]);
	});

	test('a click takes a free position, clears the Event’s own, and ignores a Class’s', () => {
		const { db } = setUp();
		const event = createEvent(db, { name: 'Y11 intervention', kind: 'intervention' });
		const click = (day: number, pos: number) =>
			toggleEventSlot(db, { eventId: event.id, week: 'A', day, position: pos, from: '2026-11-09' });

		expect(click(1, 2)).toMatchObject({ slot: { position: 2 } });
		expect(activeEventSlots(db, '2026-11-09')).toHaveLength(1);

		click(1, 2);
		expect(activeEventSlots(db, '2026-11-09')).toEqual([]);

		// 9B/Sc1 holds Week A Mon P3: a stale click on it changes nothing.
		expect(click(1, 3)).toBeNull();
		expect(activeEventSlots(db, '2026-11-09')).toEqual([]);
	});

	test('a Room is set on an Event Slot, and cleared when blank', () => {
		const { db } = setUp();
		const event = createEvent(db, { name: 'Y11 intervention', kind: 'intervention' });
		const { slot } = takeEventSlot(db, { eventId: event.id, ...position, from: null });

		expect(setEventSlotRoom(db, { id: slot.id, room: ' S4 ' })?.room).toBe('S4');
		expect(setEventSlotRoom(db, { id: slot.id, room: '  ' })?.room).toBeNull();
	});
});

// The calendar's fixed points (fixtures.ts): w/c 2 Nov 2026 is Week A, then B, A, B. Half-term is
// 26 to 30 Oct, and INSET falls on Thu 26 and Fri 27 Nov.
describe('an Event occurs on the dates its Event Slots hold, and is skipped otherwise', () => {
	const dates = (db: ReturnType<typeof setUp>['db'], eventId: string, from: string, to: string) =>
		eventOccurrences(db, { eventId, from, to }).map((o) => o.date);

	test('a Week A Monday Event occurs on alternate Mondays', () => {
		const { db } = setUp();
		const event = createEvent(db, { name: 'Y11 intervention', kind: 'intervention' });
		takeEventSlot(db, { eventId: event.id, week: 'A', day: 1, position: 2, from: null });

		expect(dates(db, event.id, '2026-11-02', '2026-11-23')).toEqual(['2026-11-02', '2026-11-16']);
	});

	test('it does not occur in a School Holiday', () => {
		const { db } = setUp();
		const event = createEvent(db, { name: 'Briefing', kind: 'meeting' });
		takeEventSlot(db, { eventId: event.id, week: 'A', day: 1, position: 0, from: null });

		const mondays = dates(db, event.id, '2026-10-19', '2026-11-03');
		expect(mondays).not.toContain('2026-10-26');
		expect(mondays).toContain('2026-11-02');
	});

	test('it does not occur on a Blocked Day, and occurs again when the day is unblocked', () => {
		const { db } = setUp();
		const event = createEvent(db, { name: 'Dept meeting', kind: 'meeting' });
		takeEventSlot(db, { eventId: event.id, week: 'B', day: 5, position: 5, from: null });
		blockDay(db, { date: '2026-11-13', note: 'Snow', today: '2026-11-01' });

		expect(dates(db, event.id, '2026-11-09', '2026-11-30')).toEqual([]);
		unblockDay(db, { date: '2026-11-13', today: '2026-11-01' });
		expect(dates(db, event.id, '2026-11-09', '2026-11-30')).toEqual(['2026-11-13']);
	});

	test('it stops occurring from the date its Event Slot is cleared', () => {
		const { db } = setUp();
		const event = createEvent(db, { name: 'Y11 intervention', kind: 'intervention' });
		takeEventSlot(db, { eventId: event.id, week: 'A', day: 1, position: 2, from: null });
		clearEventSlot(db, {
			eventId: event.id,
			week: 'A',
			day: 1,
			position: 2,
			from: '2026-11-10'
		});

		expect(dates(db, event.id, '2026-11-02', '2026-11-30')).toEqual(['2026-11-02']);
	});
});

describe('the Event note belongs to one Event and one date (ADR-0029)', () => {
	const setup = () => {
		const ctx = setUp();
		const event = createEvent(ctx.db, { name: 'Y11 intervention', kind: 'intervention' });
		takeEventSlot(ctx.db, { eventId: event.id, week: 'A', day: 1, position: 2, from: null });
		return { ...ctx, event };
	};
	const noteOn = (db: ReturnType<typeof setUp>['db'], eventId: string, date: string) =>
		eventOccurrences(db, { eventId, from: date, to: date })[0]?.note ?? null;

	test('a note is written for a date and read back with that date alone', () => {
		const { db, event } = setup();
		setEventNote(db, { eventId: event.id, date: '2026-11-02', note: 'Past paper Q4 to Q6' });

		expect(noteOn(db, event.id, '2026-11-02')).toBe('Past paper Q4 to Q6');
		expect(noteOn(db, event.id, '2026-11-16')).toBeNull();
	});

	test('a note is stored as typed, and a blank note deletes it', () => {
		const { db, event } = setup();
		setEventNote(db, { eventId: event.id, date: '2026-11-02', note: '  - one\n  - two  ' });
		expect(noteOn(db, event.id, '2026-11-02')).toBe('  - one\n  - two  ');

		setEventNote(db, { eventId: event.id, date: '2026-11-02', note: '  ' });
		expect(noteOn(db, event.id, '2026-11-02')).toBeNull();
	});

	test('a past date can still be written, so a date can be logged afterwards', () => {
		const { db, event } = setup();
		setEventNote(db, { eventId: event.id, date: '2026-09-14', note: 'Only two came' });
		expect(noteOn(db, event.id, '2026-09-14')).toBe('Only two came');
	});

	test('a date on which the Event does not occur is refused', () => {
		const { db, event } = setup();
		refused(
			() => setEventNote(db, { eventId: event.id, date: '2026-11-09', note: 'x' }),
			'invalid',
			'Y11 intervention does not occur on 2026-11-09.'
		);
	});

	test('a note stays when its date is blocked and returns when the day is unblocked', () => {
		const { db, event } = setup();
		setEventNote(db, { eventId: event.id, date: '2026-11-02', note: 'Bring the mark scheme' });

		blockDay(db, { date: '2026-11-02', today: '2026-11-01' });
		expect(noteOn(db, event.id, '2026-11-02')).toBeNull();
		unblockDay(db, { date: '2026-11-02', today: '2026-11-01' });
		expect(noteOn(db, event.id, '2026-11-02')).toBe('Bring the mark scheme');
	});

	test('earlier notes survive the Event moving to another position', () => {
		const { db, event } = setup();
		setEventNote(db, { eventId: event.id, date: '2026-11-02', note: 'Logged' });
		clearEventSlot(db, { eventId: event.id, week: 'A', day: 1, position: 2, from: '2026-11-10' });
		takeEventSlot(db, { eventId: event.id, week: 'A', day: 2, position: 2, from: '2026-11-10' });

		expect(noteOn(db, event.id, '2026-11-02')).toBe('Logged');
	});
});

describe('the Events screen lists each Event with the next date it occurs', () => {
	test('an Event lists with its kind, its Slot count and its next date from today', () => {
		const { db } = setUp();
		const event = createEvent(db, { name: 'Y11 intervention', kind: 'intervention' });
		takeEventSlot(db, { eventId: event.id, week: 'A', day: 1, position: 2, from: null });
		takeEventSlot(db, { eventId: event.id, week: 'B', day: 3, position: 7, from: null });

		// 2 Nov 2026 is a Week A Monday, so the next date from the 3rd is Wed 11 Nov (Week B).
		expect(listEvents(db, { today: '2026-11-03' })).toEqual([
			{
				id: event.id,
				name: 'Y11 intervention',
				kind: 'intervention',
				slotCount: 2,
				next: expect.objectContaining({ date: '2026-11-11', position: 7 })
			}
		]);
	});

	test('an Event with no Slot, or whose series has ended, has no next date', () => {
		const { db } = setUp();
		const bare = createEvent(db, { name: 'Duty: gate', kind: 'other' });
		const ended = createEvent(db, { name: 'Briefing', kind: 'meeting' });
		takeEventSlot(db, { eventId: ended.id, week: 'A', day: 1, position: 0, from: null });
		clearEventSlot(db, { eventId: ended.id, week: 'A', day: 1, position: 0, from: '2026-11-04' });

		const listed = listEvents(db, { today: '2026-11-03' });
		expect(listed.map((e) => [e.name, e.next])).toEqual([
			['Briefing', null],
			['Duty: gate', null]
		]);
		expect(bare.id).toBeTruthy();
	});
});

describe('an Event is renamed and deleted', () => {
	test('a rename trims, refuses blank, and an unknown id returns null', () => {
		const { db } = setUp();
		const event = createEvent(db, { name: 'Briefing', kind: 'meeting' });

		expect(renameEvent(db, { id: event.id, name: ' Staff briefing ' })?.name).toBe(
			'Staff briefing'
		);
		refused(
			() => renameEvent(db, { id: event.id, name: ' ' }),
			'invalid',
			'An Event needs a name.'
		);
		expect(renameEvent(db, { id: 'nope', name: 'x' })).toBeNull();
	});

	test('a delete asks first, naming the notes that go with it', () => {
		const { db } = setUp();
		const event = createEvent(db, { name: 'Y11 intervention', kind: 'intervention' });
		takeEventSlot(db, { eventId: event.id, week: 'A', day: 1, position: 2, from: null });
		setEventNote(db, { eventId: event.id, date: '2026-11-02', note: 'Q4 to Q6' });

		refused(
			() => deleteEvent(db, { id: event.id }),
			'unconfirmed',
			'Delete Y11 intervention? Its Timetable positions and 1 note go with it.'
		);
		expect(listEvents(db, { today: '2026-11-03' })).toHaveLength(1);
	});

	test('a confirmed delete frees its positions and removes its notes', () => {
		const { db, course } = setUp();
		const event = createEvent(db, { name: 'Y11 intervention', kind: 'intervention' });
		takeEventSlot(db, { eventId: event.id, week: 'A', day: 1, position: 2, from: null });
		setEventNote(db, { eventId: event.id, date: '2026-11-02', note: 'Q4 to Q6' });

		expect(deleteEvent(db, { id: event.id, confirmed: true })?.name).toBe('Y11 intervention');
		expect(listEvents(db, { today: '2026-11-03' })).toEqual([]);
		expect(activeEventSlots(db, '2026-11-03')).toEqual([]);

		const classC = createClass(db, { label: '9C/Sc2', courseId: course.id })!;
		expect(addSlot(db, { classId: classC.id, week: 'A', day: 1, period: 2 })).toBeTruthy();
		expect(deleteEvent(db, { id: event.id, confirmed: true })).toBeUndefined();
	});

	test('a delete with no notes still asks', () => {
		const { db } = setUp();
		const event = createEvent(db, { name: 'Briefing', kind: 'meeting' });
		refused(
			() => deleteEvent(db, { id: event.id }),
			'unconfirmed',
			'Delete Briefing? Its Timetable positions and 0 notes go with it.'
		);
	});
});

describe('an Event is read by id, with every Event Slot it has held', () => {
	test('findEvent returns the Event or undefined, and eventSlotsOf its ended and future Slots', () => {
		const { db } = setUp();
		const event = createEvent(db, { name: 'Briefing', kind: 'meeting' });
		takeEventSlot(db, { eventId: event.id, week: 'A', day: 1, position: 0, from: null });
		clearEventSlot(db, { eventId: event.id, week: 'A', day: 1, position: 0, from: '2026-11-10' });
		takeEventSlot(db, { eventId: event.id, week: 'A', day: 2, position: 0, from: '2026-11-10' });

		expect(findEvent(db, event.id)?.name).toBe('Briefing');
		expect(findEvent(db, 'nope')).toBeUndefined();
		expect(eventSlotsOf(db, event.id).map((s) => [s.day, s.holdsFrom, s.holdsTo])).toEqual([
			[1, null, '2026-11-09'],
			[2, '2026-11-10', null]
		]);
	});
});
