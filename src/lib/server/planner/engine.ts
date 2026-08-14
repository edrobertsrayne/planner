// THE ENGINE. Pure: no DOM, no clock, no I/O, nothing from SvelteKit or Drizzle. Lifted from the
// prototype validated against the real 2026/27 calendar (prototype/scheduling-engine,
// prototypes/scheduling/PROTOTYPE-scheduling-engine.html) per ADR-0007 and ADR-0010.

export interface Term {
	opens: string;
	closes: string;
}

export interface TeachingWeek {
	weekCommencing: string;
	letter: 'A' | 'B';
}

export interface TimetableSlot {
	id: string;
	classId: string;
	week: 'A' | 'B';
	day: number; // 1 = Monday ... 5 = Friday
	period: number;
	holdsFrom: string | null;
	holdsTo: string | null;
}

export interface BlockedSlot {
	classId: string;
	date: string;
	slotId: string;
}

export interface Calendar {
	terms: Term[];
	teachingWeeks: TeachingWeek[];
	slots: TimetableSlot[];
	blockedDays: string[];
	blockedSlots: BlockedSlot[];
}

export interface AvailableSlot {
	date: string;
	period: number;
	slotId: string;
	week: 'A' | 'B';
}

export interface LessonInput {
	id: string;
	plannedLength: number;
}

export interface Continuation {
	classId: string;
	lessonId: string;
}

export interface SessionRecord {
	classId: string;
	date: string;
	period: number;
	lessonId: string;
}

export interface RemainingPart {
	lessonId: string;
	part: number;
	of: number;
}

export interface PlannedSession extends RemainingPart, AvailableSlot {
	classId: string;
}

export interface ScheduleResult {
	boundary: string;
	history: SessionRecord[];
	planned: PlannedSession[];
	unplaced: RemainingPart[];
	unplanned: AvailableSlot[];
}

export interface Runway {
	date: string | null;
	lessonsRemaining: number;
}

function addDays(iso: string, days: number): string {
	const [year, month, day] = iso.split('-').map(Number);
	const date = new Date(Date.UTC(year, month - 1, day));
	date.setUTCDate(date.getUTCDate() + days);
	return date.toISOString().slice(0, 10);
}

const inAnyTerm = (terms: Term[], date: string) =>
	terms.some((term) => date >= term.opens && date <= term.closes);

const slotHolds = (slot: TimetableSlot, date: string) =>
	(!slot.holdsFrom || date >= slot.holdsFrom) && (!slot.holdsTo || date <= slot.holdsTo);

// Available Slot: a Slot on a date inside a Term, within the dates that Slot holds, not a Blocked
// Day, and not individually a Blocked Slot. Returned in calendar order — that order IS the
// schedule.
export function availableSlots(cal: Calendar, classId: string, from?: string): AvailableSlot[] {
	const blocked = new Set(cal.blockedDays);
	const blockedSlots = new Set(cal.blockedSlots.map((b) => `${b.date}|${b.slotId}`));
	const out: AvailableSlot[] = [];

	for (const week of cal.teachingWeeks) {
		for (let day = 1; day <= 5; day++) {
			const date = addDays(week.weekCommencing, day - 1);
			if (from && date < from) continue;
			if (!inAnyTerm(cal.terms, date)) continue;
			if (blocked.has(date)) continue;

			const todays = cal.slots
				.filter(
					(slot) =>
						slot.classId === classId &&
						slot.week === week.letter &&
						slot.day === day &&
						slotHolds(slot, date) &&
						!blockedSlots.has(`${date}|${slot.id}`)
				)
				.sort((a, b) => a.period - b.period);

			for (const slot of todays)
				out.push({ date, period: slot.period, slotId: slot.id, week: week.letter });
		}
	}

	return out;
}

// How many Available Slots a Lesson needs for this Class: its Planned Length, plus one per
// Continuation recorded against it. Planned Length and Continuation both widen a Lesson; neither
// creates a second Lesson.
const demandFor = (lesson: LessonInput, classId: string, continuations: Continuation[]) =>
	lesson.plannedLength +
	continuations.filter((c) => c.lessonId === lesson.id && c.classId === classId).length;

// The Lesson-parts still owed to this Class, in Assigned-Topic order then Lesson order.
export function remainingParts(
	lessons: LessonInput[],
	classId: string,
	continuations: Continuation[],
	delivered: Record<string, number>
): RemainingPart[] {
	const parts: RemainingPart[] = [];
	for (const lesson of lessons) {
		const need = demandFor(lesson, classId, continuations);
		for (let part = (delivered[lesson.id] || 0) + 1; part <= need; part++)
			parts.push({ lessonId: lesson.id, part, of: need });
	}
	return parts;
}

// Zip the owed parts onto the stream of Available Slots. The whole of shift-right is this line.
// `unplaced` is the mirror of `unplanned`: whichever of the two streams runs out first leaves the
// other's tail unconsumed.
export function layOut(
	parts: RemainingPart[],
	stream: AvailableSlot[]
): { sessions: PlannedSession[]; unplaced: RemainingPart[]; unplanned: AvailableSlot[] } {
	const sessions = parts
		.slice(0, stream.length)
		.map((part, i) => ({ ...part, ...stream[i] }) as PlannedSession);

	return {
		sessions,
		unplaced: parts.slice(stream.length),
		unplanned: stream.slice(parts.length)
	};
}

// THE ONE FUNCTION. Re-runnable in full, at any time, from any state. `boundary` is the only
// thing stopping it rewriting the past: it writes on and after that date and never before.
// Sessions dated before the boundary are the record of what happened — inputs here, not outputs.
export function schedule({
	cal,
	lessons,
	classId,
	sessions,
	continuations,
	boundary
}: {
	cal: Calendar;
	lessons: LessonInput[];
	classId: string;
	sessions: SessionRecord[];
	continuations: Continuation[];
	boundary: string;
}): ScheduleResult {
	const history = sessions
		.filter((s) => s.classId === classId && s.date < boundary)
		.sort((a, b) => (a.date + a.period).localeCompare(b.date + b.period));

	const delivered: Record<string, number> = {};
	for (const s of history) delivered[s.lessonId] = (delivered[s.lessonId] || 0) + 1;

	const {
		sessions: planned,
		unplaced,
		unplanned
	} = layOut(
		remainingParts(lessons, classId, continuations, delivered),
		availableSlots(cal, classId, boundary)
	);

	return {
		boundary,
		history,
		planned: planned.map((p) => ({ ...p, classId })),
		unplaced,
		unplanned
	};
}

// The one operation that is not a re-run. Entering a disruption in the past means the record after
// that date was written under a false assumption, so the boundary moves back and those Sessions
// are re-derived. Notes are evidence of what was really taught, so any Session carrying one is
// reported rather than silently discarded.
export function rewind(
	sessions: (SessionRecord & { note?: string | null })[],
	classId: string,
	to: string
): { boundary: string; atRisk: SessionRecord[]; discarded: SessionRecord[] } {
	const affected = sessions.filter((s) => s.classId === classId && s.date >= to);
	return {
		boundary: to,
		atRisk: affected.filter((s) => s.note),
		discarded: affected.filter((s) => !s.note)
	};
}

// Runway is derived, not stored — the date of a Class's first Unplanned Slot, with the count of
// Lesson-parts still owed but with nowhere to go alongside it.
export function runway(result: ScheduleResult): Runway {
	return {
		date: result.unplanned[0]?.date ?? null,
		lessonsRemaining: result.unplaced.length
	};
}
