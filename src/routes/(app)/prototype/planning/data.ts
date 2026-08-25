// PROTOTYPE — throwaway mock data for the restated Planning row (issue #108).
// Readiness is gone from this board (#106, ADR-0014): Lessons carry Draft/Planned only.
// Nothing here touches the database; every value is invented and in-memory.

import { classTone } from '$lib/class-tone';

export type Status = 'draft' | 'planned';

export interface MockClass {
	id: string;
	label: string;
	/** The Class's stored Tone position (ADR-0013) — the index into the eight tone tokens. */
	tone: number;
}

export interface Occurrence {
	classId: string;
	dayOffset: number;
	period: string;
}

export interface MockLesson {
	id: string;
	title: string;
	courseName: string;
	topicName: string;
	status: Status;
	/** Next Scheduled occurrence per Class that teaches this Lesson. */
	occurrences: Occurrence[];
}

// Tones follow the real walk (TONE_SEQUENCE in src/lib/class-tone.ts): four Classes created in
// this order take positions 0, 4, 6, 7 — indigo, amber, teal, fuchsia.
export const mockClasses: MockClass[] = [
	{ id: 'c1', label: '9B/Sc1', tone: 0 },
	{ id: 'c2', label: '9C/Sc2', tone: 4 },
	{ id: 'c3', label: '10A/Ph1', tone: 6 },
	{ id: 'c4', label: '11X/Ch2', tone: 7 }
];

function lesson(
	id: string,
	title: string,
	topicName: string,
	courseName: string,
	status: Status,
	occurrences: Occurrence[]
): MockLesson {
	return { id, title, topicName, courseName, status, occurrences };
}

export function mockLessons(): MockLesson[] {
	return [
		// Two Classes share the Topic — the date block must pick one of them.
		lesson('l1', 'Friction', 'Forces', 'Year 9 Physics', 'draft', [
			{ classId: 'c1', dayOffset: 0, period: 'P3' },
			{ classId: 'c2', dayOffset: 1, period: 'P1' }
		]),
		lesson('l2', 'Air resistance', 'Forces', 'Year 9 Physics', 'planned', [
			{ classId: 'c2', dayOffset: 1, period: 'P4' },
			{ classId: 'c1', dayOffset: 2, period: 'P2' }
		]),
		lesson('l3', 'Terminal velocity', 'Forces', 'Year 9 Physics', 'draft', [
			{ classId: 'c1', dayOffset: 2, period: 'P5' }
		]),
		lesson('l4', 'Balanced and unbalanced forces', 'Forces', 'Year 9 Physics', 'planned', [
			{ classId: 'c2', dayOffset: 3, period: 'P1' }
		]),
		lesson('l5', 'Series circuits', 'Electricity', 'Year 9 Physics', 'planned', [
			{ classId: 'c1', dayOffset: 3, period: 'P3' },
			{ classId: 'c2', dayOffset: 4, period: 'P2' }
		]),
		lesson('l6', 'Parallel circuits', 'Electricity', 'Year 9 Physics', 'draft', [
			{ classId: 'c2', dayOffset: 4, period: 'P5' }
		]),
		lesson('l7', 'Resistance and the ohm', 'Electricity', 'Year 9 Physics', 'draft', [
			{ classId: 'c1', dayOffset: 5, period: 'P2' }
		]),
		lesson('l8', 'Static charge', 'Electricity', 'Year 9 Physics', 'draft', []),
		lesson('l9', 'Moments and levers', 'Turning forces', 'A-level Physics', 'planned', [
			{ classId: 'c3', dayOffset: 5, period: 'P4' }
		]),
		lesson('l10', 'Centre of mass', 'Turning forces', 'A-level Physics', 'draft', [
			{ classId: 'c3', dayOffset: 6, period: 'P1' }
		]),
		lesson('l11', 'Stability and toppling', 'Turning forces', 'A-level Physics', 'draft', [
			{ classId: 'c3', dayOffset: 8, period: 'P3' }
		]),
		lesson('l12', 'Collision theory', 'Rates of reaction', 'GCSE Chemistry', 'planned', [
			{ classId: 'c4', dayOffset: 6, period: 'P2' }
		]),
		lesson('l13', 'Surface area and rate', 'Rates of reaction', 'GCSE Chemistry', 'planned', [
			{ classId: 'c4', dayOffset: 7, period: 'P5' }
		]),
		lesson('l14', 'Catalysts', 'Rates of reaction', 'GCSE Chemistry', 'draft', [
			{ classId: 'c4', dayOffset: 9, period: 'P1' }
		]),
		lesson('l15', 'Measuring rate by gas volume', 'Rates of reaction', 'GCSE Chemistry', 'draft', [
			{ classId: 'c4', dayOffset: 10, period: 'P3' }
		]),
		lesson('l16', 'Reversible reactions', 'Equilibria', 'GCSE Chemistry', 'draft', [
			{ classId: 'c4', dayOffset: 12, period: 'P2' }
		]),
		// A long title, to test how the middle column behaves when it takes the vacated space.
		lesson(
			'l17',
			'Le Chatelier’s principle and its application to industrial processes',
			'Equilibria',
			'GCSE Chemistry',
			'draft',
			[{ classId: 'c4', dayOffset: 13, period: 'P4' }]
		),
		lesson('l18', 'The Haber process', 'Equilibria', 'GCSE Chemistry', 'draft', [])
	];
}

export function counts(lessons: MockLesson[]): Record<Status | 'all', number> {
	return {
		all: lessons.length,
		draft: lessons.filter((l) => l.status === 'draft').length,
		planned: lessons.filter((l) => l.status === 'planned').length
	};
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** dayOffset counts teaching days, not calendar days — a school timetable has no weekends. */
export function occurrenceDate(o: Occurrence) {
	const d = new Date();
	let left = o.dayOffset;
	while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
	while (left > 0) {
		d.setDate(d.getDate() + 1);
		if (d.getDay() !== 0 && d.getDay() !== 6) left -= 1;
	}
	return d;
}

export function dateText(o: Occurrence) {
	const d = occurrenceDate(o);
	return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function soonest(lesson: MockLesson) {
	return [...lesson.occurrences].sort((a, b) => a.dayOffset - b.dayOffset)[0] ?? null;
}

/** The fixed rule: soonest next Scheduled occurrence first, unscheduled at the bottom. */
export function ordered(lessons: MockLesson[]) {
	return [...lessons].sort((a, b) => {
		const x = soonest(a);
		const y = soonest(b);
		if (!x && !y) return a.title.localeCompare(b.title);
		if (!x) return 1;
		if (!y) return -1;
		return x.dayOffset - y.dayOffset;
	});
}

export function mockClass(classId: string) {
	return mockClasses.find((c) => c.id === classId) ?? null;
}

export function classLabel(classId: string) {
	return mockClass(classId)?.label ?? classId;
}

export function classToneIndex(classId: string) {
	return mockClass(classId)?.tone ?? 0;
}

// PROTOTYPE: the status colours alias two Class Tone positions rather than adding tokens of their
// own — rose for Draft, emerald for Planned. Aliasing keeps both themes free and the palette in one
// place, at the cost of a hue a Class can also wear.
export function statusTone(status: Status) {
	return classTone(status === 'planned' ? 1 : 5);
}
