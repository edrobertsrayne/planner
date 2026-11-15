import { describe, expect, test } from 'vitest';
import type { BellTime } from '$lib/bell';
import { refused, setUp } from './fixtures';
import {
	bellOf,
	classDetail,
	createBellSchedule,
	createClass,
	createEvent,
	deleteBellSchedule,
	eventOccurrences,
	listBellSchedules,
	makeDefaultBellSchedule,
	setClassSchedule,
	takeEventSlot,
	toggleEventSlot,
	updateBellSchedule
} from './index';

// The split day ADR-0033 was written for: Years 9–10 lunch after P3, Years 11–13 after P4, the
// same Break for both.
const LOWER: Record<number, BellTime> = {
	1: { starts: '08:50', ends: '09:50' },
	2: { starts: '09:50', ends: '10:50' },
	8: { starts: '10:50', ends: '11:10' },
	3: { starts: '11:10', ends: '12:10' },
	9: { starts: '12:10', ends: '12:40' },
	4: { starts: '12:40', ends: '13:40' },
	5: { starts: '13:40', ends: '14:40' },
	6: { starts: '14:40', ends: '15:40' }
};
const UPPER: Record<number, BellTime> = {
	...LOWER,
	4: { starts: '12:10', ends: '13:10' },
	9: { starts: '13:10', ends: '13:40' }
};

describe('Bell Schedules', () => {
	test('the first one made is the default, and every Class follows it', () => {
		const { db, classA, classB } = setUp();
		expect(bellOf(db)).toEqual({ schedules: [], classSchedules: {} });

		const lower = createBellSchedule(db, { name: 'Years 9–10', times: LOWER });
		const upper = createBellSchedule(db, { name: 'Years 11–13', times: UPPER });

		expect(listBellSchedules(db).map((s) => [s.name, s.isDefault])).toEqual([
			['Years 9–10', true],
			['Years 11–13', false]
		]);
		expect(bellOf(db).classSchedules).toEqual({ [classA.id]: lower.id, [classB.id]: lower.id });
		expect(listBellSchedules(db)[1].times[9]).toEqual({ starts: '13:10', ends: '13:40' });
		expect(upper.isDefault).toBe(false);
	});

	test('a new Class follows the default unless it names another', () => {
		const { db, course } = setUp();
		const lower = createBellSchedule(db, { name: 'Lower', times: LOWER });
		const upper = createBellSchedule(db, { name: 'Upper', times: UPPER });

		const plain = createClass(db, { label: '9A/Sc', courseId: course.id });
		const sixth = createClass(db, { label: '12X/Ph', courseId: course.id, scheduleId: upper.id });

		expect(classDetail(db, plain.id)?.scheduleId).toBe(lower.id);
		expect(classDetail(db, sixth.id)?.scheduleId).toBe(upper.id);
	});

	test('a Class can be moved to another Bell Schedule', () => {
		const { db, classB } = setUp();
		createBellSchedule(db, { name: 'Lower', times: LOWER });
		const upper = createBellSchedule(db, { name: 'Upper', times: UPPER });

		setClassSchedule(db, { id: classB.id, scheduleId: upper.id });

		expect(bellOf(db).classSchedules[classB.id]).toBe(upper.id);
	});

	test('making another the default leaves exactly one default', () => {
		const { db } = setUp();
		createBellSchedule(db, { name: 'Lower', times: LOWER });
		const upper = createBellSchedule(db, { name: 'Upper', times: UPPER });

		makeDefaultBellSchedule(db, { id: upper.id });

		expect(listBellSchedules(db).map((s) => [s.name, s.isDefault])).toEqual([
			['Upper', true],
			['Lower', false]
		]);
	});

	test('names are unique, case-insensitively', () => {
		const { db } = setUp();
		createBellSchedule(db, { name: 'Lower', times: LOWER });
		refused(
			() => createBellSchedule(db, { name: ' lower ', times: UPPER }),
			'conflict',
			'A Bell Schedule called "lower" already exists.'
		);
	});

	test('an update replaces the name and every time', () => {
		const { db } = setUp();
		const s = createBellSchedule(db, { name: 'Lower', times: LOWER });

		updateBellSchedule(db, { id: s.id, name: 'Upper', times: UPPER });

		expect(listBellSchedules(db)).toEqual([
			{ id: s.id, name: 'Upper', isDefault: true, times: UPPER }
		]);
	});

	describe('times draw a day the school has', () => {
		const attempt = (times: Record<number, BellTime>) => () => {
			const { db } = setUp();
			createBellSchedule(db, { name: 'Lower', times });
		};

		test('every position needs a real HH:MM start and end', () => {
			const noLunch = { ...LOWER };
			delete noLunch[9];
			refused(attempt(noLunch), 'invalid', 'Lunch needs a start and an end time, as HH:MM.');
			refused(
				attempt({ ...LOWER, 2: { starts: '9:50', ends: '10:50' } }),
				'invalid',
				'P2 needs a start and an end time, as HH:MM.'
			);
			refused(
				attempt({ ...LOWER, 8: { starts: '10:50', ends: '24:10' } }),
				'invalid',
				'Break needs a start and an end time, as HH:MM.'
			);
		});

		test('each ends after it starts', () => {
			refused(
				attempt({ ...LOWER, 1: { starts: '09:50', ends: '08:50' } }),
				'invalid',
				'P1 must end after it starts.'
			);
		});

		test('the Periods keep their order', () => {
			refused(
				attempt({
					...LOWER,
					5: { starts: '14:40', ends: '15:40' },
					6: { starts: '13:40', ends: '14:40' }
				}),
				'invalid',
				'P6 cannot start before P5.'
			);
		});

		test('nothing overlaps', () => {
			refused(
				attempt({ ...LOWER, 8: { starts: '10:40', ends: '11:10' } }),
				'invalid',
				'P2 and Break overlap: one ends 10:50, the next starts 10:40.'
			);
		});
	});

	describe('deleting', () => {
		test('the default goes only when it is the last, and leaves Classes with none', () => {
			const { db, classA } = setUp();
			const lower = createBellSchedule(db, { name: 'Lower', times: LOWER });
			const upper = createBellSchedule(db, { name: 'Upper', times: UPPER });

			refused(
				() => deleteBellSchedule(db, { id: lower.id }),
				'conflict',
				'Make another Bell Schedule the default before deleting this one.'
			);
			deleteBellSchedule(db, { id: upper.id });
			deleteBellSchedule(db, { id: lower.id });

			expect(listBellSchedules(db)).toEqual([]);
			expect(classDetail(db, classA.id)?.scheduleId).toBeNull();
		});

		test('one a Class follows is refused, naming the Class', () => {
			const { db, classB } = setUp();
			createBellSchedule(db, { name: 'Lower', times: LOWER });
			const upper = createBellSchedule(db, { name: 'Upper', times: UPPER });
			setClassSchedule(db, { id: classB.id, scheduleId: upper.id });

			refused(
				() => deleteBellSchedule(db, { id: upper.id }),
				'conflict',
				'Upper cannot be deleted while 10C/Ph2 follows it.'
			);
		});

		test('one whose Lunch an Event holds is refused, naming the Event', () => {
			const { db } = setUp();
			const lower = createBellSchedule(db, { name: 'Lower', times: LOWER });
			const duty = createEvent(db, { name: 'Canteen duty', kind: 'duty' });
			takeEventSlot(db, {
				eventId: duty.id,
				week: 'A',
				day: 2,
				position: 9,
				scheduleId: lower.id,
				from: null
			});

			refused(
				() => deleteBellSchedule(db, { id: lower.id }),
				'conflict',
				'Lower cannot be deleted while Canteen duty holds its Break or Lunch.'
			);
		});
	});
});

describe('an Event at Break or Lunch', () => {
	test('names whose Lunch it is, and two Lunches are two positions', () => {
		const { db } = setUp();
		const lower = createBellSchedule(db, { name: 'Lower', times: LOWER });
		const upper = createBellSchedule(db, { name: 'Upper', times: UPPER });
		const canteen = createEvent(db, { name: 'Canteen duty', kind: 'duty' });
		const yard = createEvent(db, { name: 'Yard duty', kind: 'duty' });
		const at = { week: 'A', day: 1, position: 9, from: null } as const;

		takeEventSlot(db, { eventId: canteen.id, ...at, scheduleId: lower.id });
		takeEventSlot(db, { eventId: yard.id, ...at, scheduleId: upper.id });

		refused(
			() => takeEventSlot(db, { eventId: yard.id, ...at, scheduleId: lower.id }),
			'conflict',
			'Week A Mon Lunch already belongs to Canteen duty over these dates.'
		);
		expect(
			eventOccurrences(db, { from: '2026-11-02', to: '2026-11-02' }).map((o) => [
				o.name,
				o.position,
				o.scheduleId
			])
		).toEqual([
			['Canteen duty', 9, lower.id],
			['Yard duty', 9, upper.id]
		]);
	});

	test('must name a Bell Schedule, and only Break and Lunch may', () => {
		const { db } = setUp();
		const lower = createBellSchedule(db, { name: 'Lower', times: LOWER });
		const duty = createEvent(db, { name: 'Gate duty', kind: 'duty' });

		refused(
			() => takeEventSlot(db, { eventId: duty.id, week: 'A', day: 1, position: 8, from: null }),
			'invalid',
			'A Break or Lunch must name its Bell Schedule.'
		);
		const { slot } = takeEventSlot(db, {
			eventId: duty.id,
			week: 'A',
			day: 1,
			position: 0,
			scheduleId: lower.id,
			from: null
		});
		expect(slot.scheduleId).toBeNull();
	});

	test('a second click on the same Lunch clears it', () => {
		const { db } = setUp();
		const lower = createBellSchedule(db, { name: 'Lower', times: LOWER });
		const duty = createEvent(db, { name: 'Canteen duty', kind: 'duty' });
		const click = {
			eventId: duty.id,
			week: 'A',
			day: 1,
			position: 9,
			scheduleId: lower.id,
			from: '2026-11-02'
		};

		toggleEventSlot(db, click);
		expect(eventOccurrences(db, { from: '2026-11-02', to: '2026-11-02' })).toHaveLength(1);
		toggleEventSlot(db, click);
		expect(eventOccurrences(db, { from: '2026-11-02', to: '2026-11-02' })).toEqual([]);
	});
});
