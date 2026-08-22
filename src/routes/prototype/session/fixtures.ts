// PROTOTYPE — throwaway. A hand-written fortnight of a plausible UK secondary physics teacher's
// timetable, so the prototype renders on any machine with an empty database and needs neither the
// real planner tables nor a login. That is a deliberate trade: the schedule prototype (#61) was
// judged against real data because the question was "what does the schedule look like"; this
// ticket's question is where the *Session* goes, and for that the schedule only has to be dense
// and realistic enough to squeeze, cover or replace.
//
// Nothing here touches `$lib/server/db`. Dates are derived from `today` so "Today —" lands.
import type { CalendarCell, SessionDetail } from '$lib/server/planner';
import type { Occasion } from '$lib/client/session-panel.svelte';

export interface AgendaFixtureRow {
	classId: string;
	classLabel: string;
	date: string;
	week: 'A' | 'B';
	periodFrom: number;
	periodTo: number;
	lesson: { title: string; topicName: string } | null;
}

const CLASSES = [
	{ id: 'cls-7x', label: '7X/Sc1' },
	{ id: 'cls-8y', label: '8Y/Sc2' },
	{ id: 'cls-9a', label: '9A/Ph1' },
	{ id: 'cls-10b', label: '10B/Ph' },
	{ id: 'cls-11c', label: '11C/Ph' },
	{ id: 'cls-12d', label: '12D/Ph' }
];

// [dayIndex 0=Mon .. 4=Fri, periodFrom, periodTo, classIndex]
const TIMETABLE: [number, number, number, number][] = [
	[0, 1, 1, 0],
	[0, 3, 3, 3],
	[0, 5, 6, 5],
	[1, 2, 2, 1],
	[1, 4, 4, 4],
	[2, 1, 1, 2],
	[2, 2, 2, 0],
	[2, 5, 5, 3],
	[3, 3, 4, 5],
	[3, 6, 6, 1],
	[4, 1, 1, 4],
	[4, 2, 2, 2],
	[4, 4, 4, 3]
];

// Deliberately not every occasion — an Unplanned Slot is still an occasion Ed may write about,
// and the Session has to look right for one.
const LESSONS: Record<string, { title: string; topicName: string; body: string | null }> = {
	'cls-7x': {
		title: 'Measuring speed',
		topicName: 'Forces and motion',
		body: 'Starter: recap distance–time graphs from last lesson.\n\nMain: trolley and ramp practical in pairs. Each pair takes three timings and averages them — stress that one reading is not a result.\n\nPlenary: exit ticket, calculate speed from a given distance and time.'
	},
	'cls-8y': {
		title: 'Energy stores and transfers',
		topicName: 'Energy',
		body: 'Card sort on the eight stores. Watch for the usual confusion between a store and a pathway.'
	},
	'cls-9a': {
		title: 'Series and parallel circuits',
		topicName: 'Electricity',
		body: null
	},
	'cls-10b': {
		title: 'Required practical: specific heat capacity',
		topicName: 'Particle model',
		body: 'Full write-up expected. Equipment is booked — check the immersion heaters are in the prep room the day before.'
	},
	'cls-11c': {
		title: 'Past paper walkthrough — Paper 1 Q4–Q7',
		topicName: 'Revision',
		body: 'Go through the mark scheme line by line. They lose marks on units, not on physics.'
	},
	'cls-12d': {
		title: 'Projectile motion',
		topicName: 'Mechanics',
		body: 'Resolve into components first. Do the worked example on the board before letting them start the problem set.'
	}
};

const NOTES: Record<string, string> = {
	'cls-11c':
		'Went better than expected — they are finally writing units. Q6 still catching them out, come back to it Thursday.',
	'cls-7x': 'Ran out of time on the plenary. Trolleys need re-checking, two had stiff wheels.'
};

function addDays(iso: string, n: number): string {
	const d = new Date(iso + 'T00:00:00Z');
	d.setUTCDate(d.getUTCDate() + n);
	return d.toISOString().slice(0, 10);
}

/** The Monday of the week `iso` falls in; Sat/Sun roll forward to the next Monday. */
export function mondayOf(iso: string): string {
	const day = new Date(iso + 'T00:00:00Z').getUTCDay(); // 0=Sun .. 6=Sat
	if (day === 0) return addDays(iso, 1);
	if (day === 6) return addDays(iso, 2);
	return addDays(iso, 1 - day);
}

function occasionsFor(monday: string, letter: 'A' | 'B') {
	return TIMETABLE.map(([dayIndex, periodFrom, periodTo, classIndex]) => {
		const cls = CLASSES[classIndex];
		// Week B leaves a couple of Slots Unplanned, so the Session has to handle both.
		const planned = letter === 'A' || classIndex % 3 !== 1;
		return {
			classId: cls.id,
			classLabel: cls.label,
			date: addDays(monday, dayIndex),
			week: letter,
			periodFrom,
			periodTo,
			lesson: planned
				? { title: LESSONS[cls.id].title, topicName: LESSONS[cls.id].topicName }
				: null
		};
	});
}

export function agendaFixture(today: string): AgendaFixtureRow[] {
	const monday = mondayOf(today);
	return [...occasionsFor(monday, 'A'), ...occasionsFor(addDays(monday, 7), 'B')]
		.filter((r) => r.date >= today)
		.sort((a, b) =>
			(a.date + String(a.periodFrom).padStart(2, '0')).localeCompare(
				b.date + String(b.periodFrom).padStart(2, '0')
			)
		);
}

export interface WeekFixture {
	weekCommencing: string;
	letter: 'A' | 'B';
	dates: string[];
	cells: CalendarCell[];
}

export function weekFixture(weekCommencing: string, letter: 'A' | 'B'): WeekFixture {
	const cells: CalendarCell[] = occasionsFor(weekCommencing, letter).map((o, i) => ({
		date: o.date,
		periodFrom: o.periodFrom,
		periodTo: o.periodTo,
		classId: o.classId,
		classLabel: o.classLabel,
		// One blocked cell per week so the grid isn't uniformly clickable.
		kind: i === 4 ? 'blocked' : o.lesson ? 'lesson' : 'unplanned',
		lesson: o.lesson,
		blockedNote: i === 4 ? 'Trip — Year 9 to the Science Museum' : null,
		slotId: `slot-${i}`,
		blockedDayId: null,
		blockedSlotId: i === 4 ? `blocked-${i}` : null
	}));
	return {
		weekCommencing,
		letter,
		dates: [0, 1, 2, 3, 4].map((n) => addDays(weekCommencing, n)),
		cells
	};
}

/** Stands in for the gated GET /session — same shape, no database, no auth. */
export function sessionDetailFixture(occasion: Occasion): SessionDetail {
	const cls = CLASSES.find((c) => c.id === occasion.classId);
	const lesson = LESSONS[occasion.classId];
	const planned = !!lesson && occasion.period !== 4;
	return {
		classId: occasion.classId,
		classLabel: cls?.label ?? occasion.classId,
		date: occasion.date,
		period: occasion.period,
		lesson: planned
			? {
					title: lesson.title,
					topicName: lesson.topicName,
					body: lesson.body,
					links:
						occasion.classId === 'cls-10b'
							? [
									{
										id: 'lnk-1',
										lessonId: 'lsn-10b',
										label: 'Required practical sheet (AQA)',
										url: 'https://example.org/practical',
										position: 0
									},
									{
										id: 'lnk-2',
										lessonId: 'lsn-10b',
										label: 'Slides',
										url: 'https://example.org/slides',
										position: 1
									}
								]
							: []
				}
			: null,
		note: NOTES[occasion.classId] ?? null
	};
}
