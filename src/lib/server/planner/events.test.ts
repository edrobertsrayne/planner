import { describe, expect, test } from 'vitest';
import { refused, setUp } from './fixtures';
import {
	activeEventSlots,
	addSlot,
	clearEventSlot,
	createClass,
	createEvent,
	setEventSlotRoom,
	takeEventSlot,
	toggleEventSlot
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
