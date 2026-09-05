// THE ENGINE. Pure: no DOM, no clock, no I/O, nothing from SvelteKit or Drizzle. Lifted from the
// prototype validated against the real 2026/27 calendar (prototype/scheduling-engine,
// prototypes/scheduling/PROTOTYPE-scheduling-engine.html) per ADR-0007 and ADR-0010.
import { addDays } from '$lib/date';

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
	length: number;
}

export interface Continuation {
	classId: string;
	lessonId: string;
}

// A Placement: a Lesson scheduled directly onto a Class at a chosen date/Slot, with no Topic
// behind it (issue #250). `length` is the Lesson's own length — a Placement carries no
// Continuation of its own.
export interface Placement {
	id: string;
	classId: string;
	date: string;
	slotId: string;
	lessonId: string;
	length: number;
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

export interface ScheduledSession extends RemainingPart, AvailableSlot {
	classId: string;
	// Set only on a Session a Placement produced — the derived-from-Topic-Lesson kind carries
	// none, so `undefined` there reads as "not a Placement" rather than needing its own flag.
	placementId?: string;
}

export interface ScheduleResult {
	boundary: string;
	history: SessionRecord[];
	scheduled: ScheduledSession[];
	unplaced: RemainingPart[];
	openSlots: AvailableSlot[];
	// A Placement whose anchor, and every Available Slot after it, is gone — nothing was emitted
	// for it at all, so it has no landing in `scheduled` for a caller to compare against its
	// anchor. Reported by id so it is never silently dropped from `placementsMoved` (ADR-0022).
	strandedPlacementIds: string[];
}

export interface Runway {
	date: string | null;
	lessonsRemaining: number;
}

export const inAnyTerm = (terms: Term[], date: string) =>
	terms.some((term) => date >= term.opens && date <= term.closes);

export const slotHolds = (
	slot: { holdsFrom: string | null; holdsTo: string | null },
	date: string
) => (!slot.holdsFrom || date >= slot.holdsFrom) && (!slot.holdsTo || date <= slot.holdsTo);

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

// How many Available Slots a Lesson needs for this Class: its Length, plus one per
// Continuation recorded against it. Length and Continuation both widen a Lesson; neither
// creates a second Lesson.
const demandFor = (lesson: LessonInput, classId: string, continuations: Continuation[]) =>
	lesson.length +
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
// `unplaced` is the mirror of `openSlots`: whichever of the two streams runs out first leaves the
// other's tail unconsumed.
export function layOut(
	parts: RemainingPart[],
	stream: AvailableSlot[]
): { sessions: ScheduledSession[]; unplaced: RemainingPart[]; openSlots: AvailableSlot[] } {
	const sessions = parts
		.slice(0, stream.length)
		.map((part, i) => ({ ...part, ...stream[i] }) as ScheduledSession);

	return {
		sessions,
		unplaced: parts.slice(stream.length),
		openSlots: stream.slice(parts.length)
	};
}

// Lay every Placement onto the stream of Available Slots before any Topic Lesson gets a look in.
// Walked in ascending anchor order — by date, then by the anchor Slot's own Period, both stable
// and pure so re-deriving the same Placements in the same state always walks them the same way —
// each claims the first `length` Available Slots at-or-after its own anchor from whatever the
// stream still holds, so a later Placement whose anchor collides with an earlier one's claim
// shifts right past it, never refused. `delivered` is the same record `remainingParts` reads for
// Topic Lessons — a Placement's Lesson never appears in the Topic stream (it has no Topic), so
// the two never contend for the same entry; read from a local copy, never written back onto the
// caller's map, so this stays the one pure function in the system with no hidden side effect on a
// shared record. Still needed within the loop itself: the same Lesson may be placed twice on one
// Class (ADR-0022), and the earlier-anchored Placement's already-taught parts must stop counting
// against the later one's own length too.
function layPlacements(
	cal: Calendar,
	placements: Placement[],
	delivered: Record<string, number>,
	stream: AvailableSlot[]
): {
	sessions: ScheduledSession[];
	openSlots: AvailableSlot[];
	stranded: string[];
	unplaced: RemainingPart[];
} {
	const periodOf: Record<string, number> = Object.fromEntries(
		cal.slots.map((s) => [s.id, s.period])
	);
	const ordered = [...placements].sort((a, b) => {
		if (a.date !== b.date) return a.date < b.date ? -1 : 1;
		return (periodOf[a.slotId] ?? 0) - (periodOf[b.slotId] ?? 0);
	});

	const left: Record<string, number> = { ...delivered };
	let remaining = stream;
	const sessions: ScheduledSession[] = [];
	const stranded: string[] = [];
	const unplaced: RemainingPart[] = [];

	for (const placement of ordered) {
		const already = left[placement.lessonId] || 0;
		const used = Math.min(already, placement.length);
		left[placement.lessonId] = already - used;
		const need = placement.length - used;
		if (need <= 0) continue;

		const period = periodOf[placement.slotId] ?? 0;
		const anchorIndex = remaining.findIndex(
			(s) => s.date > placement.date || (s.date === placement.date && s.period >= period)
		);
		const start = anchorIndex === -1 ? remaining.length : anchorIndex;
		const claimed = remaining.slice(start, start + need);

		// Every Slot at or after the anchor is gone — a Blocked Day at the end of term, or an
		// earlier-anchored Placement's run having already claimed the rest. Nothing is emitted, so
		// this Placement has no landing for describePlacementsMoved to compare against; reported
		// separately, by id, so the vanish is never silent.
		if (claimed.length === 0) {
			stranded.push(placement.id);
			continue;
		}

		claimed.forEach((slot, i) =>
			sessions.push({
				...slot,
				classId: placement.classId,
				lessonId: placement.lessonId,
				part: used + i + 1,
				of: placement.length,
				placementId: placement.id
			})
		);

		// The stream ran out mid-run: the parts with nowhere left to go join the Topic stream's
		// own unplaced tail rather than vanishing behind a "part 1 of 3" nothing can finish.
		for (let i = claimed.length; i < need; i++) {
			unplaced.push({ lessonId: placement.lessonId, part: used + i + 1, of: placement.length });
		}

		remaining = [...remaining.slice(0, start), ...remaining.slice(start + claimed.length)];
	}

	return { sessions, openSlots: remaining, stranded, unplaced };
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
	placements,
	boundary
}: {
	cal: Calendar;
	lessons: LessonInput[];
	classId: string;
	sessions: SessionRecord[];
	continuations: Continuation[];
	placements: Placement[];
	boundary: string;
}): ScheduleResult {
	const history = sessions
		.filter((s) => s.classId === classId && s.date < boundary)
		.sort((a, b) => (a.date + a.period).localeCompare(b.date + b.period));

	const delivered: Record<string, number> = {};
	for (const s of history) delivered[s.lessonId] = (delivered[s.lessonId] || 0) + 1;

	const {
		sessions: placed,
		openSlots: afterPlacements,
		stranded: strandedPlacementIds,
		unplaced: strandedParts
	} = layPlacements(
		cal,
		placements.filter((p) => p.classId === classId),
		delivered,
		availableSlots(cal, classId, boundary)
	);

	const {
		sessions: laid,
		unplaced: topicUnplaced,
		openSlots
	} = layOut(remainingParts(lessons, classId, continuations, delivered), afterPlacements);

	const scheduled = [...placed, ...laid]
		.sort((a, b) => (a.date + a.period).localeCompare(b.date + b.period))
		.map((p) => ({ ...p, classId }));

	return {
		boundary,
		history,
		scheduled,
		unplaced: [...strandedParts, ...topicUnplaced],
		openSlots,
		strandedPlacementIds
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

// Runway is derived, not stored — the date of a Class's first Open Slot, with the count of
// Lesson-parts still owed but with nowhere to go alongside it.
export function runway(result: ScheduleResult): Runway {
	return {
		date: result.openSlots[0]?.date ?? null,
		lessonsRemaining: result.unplaced.length
	};
}

export interface AgendaRow {
	classId: string;
	date: string;
	week: 'A' | 'B';
	periodFrom: number;
	periodTo: number;
	// One id per Period the row covers, in order: slotIds[i] belongs to periodFrom + i.
	// A Lesson with a Length above one, or a Continuation, carries one Slot per Period it
	// covers; every other kind of row carries exactly one.
	slotIds: string[];
	lesson: { lessonId: string; part: number; of: number } | null;
}

// A view of a ScheduleResult for the Agenda: one row per occasion, a Lesson with Length
// (or a Continuation) above 1 collapsed into a single row spanning its Periods rather than
// reported once per Period. Only ever merges within one date — `scheduled` is chronological, so a
// Lesson that runs into the next day's first Slot never lands in adjacent array positions with
// contiguous Periods, and the Agenda groups by day regardless.
export function agendaRows(classId: string, result: ScheduleResult): AgendaRow[] {
	const rows: AgendaRow[] = [];

	for (const p of result.scheduled) {
		const prev = rows[rows.length - 1];
		if (
			prev?.lesson &&
			prev.date === p.date &&
			prev.periodTo + 1 === p.period &&
			prev.lesson.lessonId === p.lessonId &&
			prev.lesson.part + 1 === p.part
		) {
			prev.periodTo = p.period;
			prev.slotIds.push(p.slotId);
			prev.lesson = { lessonId: p.lessonId, part: p.part, of: p.of };
		} else {
			rows.push({
				classId,
				date: p.date,
				week: p.week,
				periodFrom: p.period,
				periodTo: p.period,
				slotIds: [p.slotId],
				lesson: { lessonId: p.lessonId, part: p.part, of: p.of }
			});
		}
	}

	for (const slot of result.openSlots) {
		rows.push({
			classId,
			date: slot.date,
			week: slot.week,
			periodFrom: slot.period,
			periodTo: slot.period,
			slotIds: [slot.slotId],
			lesson: null
		});
	}

	return rows;
}
