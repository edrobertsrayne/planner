// THE ENGINE. Pure: no DOM, no clock, no I/O, nothing from SvelteKit or Drizzle. Lifted from the
// prototype validated against the real 2026/27 calendar (prototype/scheduling-engine,
// prototypes/scheduling/PROTOTYPE-scheduling-engine.html) per ADR-0007; each Class lays its own
// Sequence (ADR-0026).
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

export interface BlockedDay {
	id: string;
	date: string;
	note: string | null;
}

export interface BlockedSlot {
	id: string;
	classId: string;
	date: string;
	slotId: string;
	note: string | null;
}

export interface Calendar {
	terms: Term[];
	teachingWeeks: TeachingWeek[];
	slots: TimetableSlot[];
	blockedDays: BlockedDay[];
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
// behind it (issue #250). `length` is the Lesson's own length; a Continuation recorded on one of
// the Placement's own Sessions widens its run by one Slot (ADR-0022). `anchorPeriod` is the
// anchor Slot's own Period, resolved where the Placement is loaded so the engine never has to
// look a Slot up to compare a claim against the anchor the teacher chose.
export interface Placement {
	id: string;
	classId: string;
	date: string;
	slotId: string;
	anchorPeriod: number;
	lessonId: string;
	length: number;
}

export interface SessionRecord {
	classId: string;
	date: string;
	period: number;
	lessonId: string;
}

// A recorded Session as the engine reports it: its occasion resolved against the Calendar as it
// stands now. `slotId` is null when no Slot holds the position any more — a Term change or an ended
// Slot can leave the record on an occasion the Timetable no longer has — and `placementId` is set
// when a Placement names the Lesson on this Class, which is what tells a placed part from a
// Sequence Lesson's.
export interface HistorySession extends SessionRecord {
	slotId: string | null;
	placementId?: string;
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

// Where one Placement's run landed this call. `landing` is the first Available Slot it claimed, or
// null when every Slot at or after the anchor is gone. A landing is reported only when it can be a
// move: a run whose first part is still to come, or a run with nothing left to land on. A run
// already in progress (part 1 in history) is not moving — its remaining parts are the run
// continuing — so it carries no landing and is never reported (ADR-0022).
export interface PlacementLanding {
	placementId: string;
	classId: string;
	lessonId: string;
	// The stored anchor the teacher chose, in the terms the report speaks.
	anchor: { date: string; period: number };
	landing: { date: string; period: number } | null;
}

export interface ScheduleResult {
	boundary: string;
	history: HistorySession[];
	scheduled: ScheduledSession[];
	unplaced: RemainingPart[];
	openSlots: AvailableSlot[];
	placementLandings: PlacementLanding[];
}

export interface Runway {
	date: string | null;
	lessonsRemaining: number;
}

export const inAnyTerm = (terms: Term[], date: string) =>
	terms.some((term) => date >= term.opens && date <= term.closes);

// The last day of a window of `days` Term days from `today`, today counting as the first when it
// is in a Term. A day outside every Term — a School Holiday — is skipped, not counted, so a window
// that crosses one reaches as far past it, and one that starts in one opens on the next Term. A
// weekend inside a Term counts. `null` reaches the close of the last Term; with no Term day ahead
// the window ends today.
export function termWindowEnd(terms: Term[], today: string, days: number | null): string {
	const lastCloses = terms.reduce((last, t) => (t.closes > last ? t.closes : last), today);
	let end = today;
	let left = days ?? Infinity;
	for (let date = today; left > 0 && date <= lastCloses; date = addDays(date, 1)) {
		if (!inAnyTerm(terms, date)) continue;
		end = date;
		left--;
	}
	return end;
}

export interface SchoolHoliday {
	starts: string;
	ends: string;
}

// The School Holidays touching the days `from` to `to`: each gap between two Terms, whole even when
// it began before `from`, and the gap before the first Term, which starts at `from` — the Terms
// say nothing earlier. No holiday follows the last Term: no window reaches past it.
export function schoolHolidays(terms: Term[], from: string, to: string): SchoolHoliday[] {
	const sorted = [...terms].sort((a, b) => a.opens.localeCompare(b.opens));
	const gaps: SchoolHoliday[] =
		sorted.length && from < sorted[0].opens
			? [{ starts: from, ends: addDays(sorted[0].opens, -1) }]
			: [];
	for (let i = 1; i < sorted.length; i++)
		gaps.push({ starts: addDays(sorted[i - 1].closes, 1), ends: addDays(sorted[i].opens, -1) });
	return gaps.filter((gap) => gap.ends >= from && gap.starts <= to);
}

export const slotHolds = (
	slot: { holdsFrom: string | null; holdsTo: string | null },
	date: string
) => (!slot.holdsFrom || date >= slot.holdsFrom) && (!slot.holdsTo || date <= slot.holdsTo);

// One reason the Calendar removes an occasion from teaching. `outside-term` is a School Holiday:
// the school is not running, so nothing was taken away. A Blocked Day and a Blocked Slot are
// recorded removals. A Blocked Slot is still recorded on a date a Blocked Day or a holiday already
// covers — the Calendar must offer its Unblock — so an occasion can carry more than one reason.
export type Removal =
	| { kind: 'outside-term' }
	| { kind: 'day'; id: string; note: string | null }
	| { kind: 'slot'; id: string; note: string | null };

export interface TimetabledSlot extends AvailableSlot {
	classId: string;
	// Every reason this occasion cannot be taught: empty exactly when it is an Available Slot.
	removedBy: Removal[];
}

// Every occasion the Timetable gives a Class — or every Class, when none is named — in calendar
// order, each with what the Calendar removes it by. This is the one walk over Teaching Weeks ×
// weekdays × Slots × the Calendar's removals: an Available Slot is one with nothing in
// `removedBy`, and every reader that needs to know what could have been taught, or why it was
// not, starts here rather than re-deriving the rule.
export function timetabledSlots(cal: Calendar, classId?: string, from?: string): TimetabledSlot[] {
	const blockedDays = new Map(cal.blockedDays.map((day) => [day.date, day]));
	const blockedSlots = new Map(
		cal.blockedSlots.map((slot) => [`${slot.date}|${slot.slotId}`, slot])
	);
	const out: TimetabledSlot[] = [];

	for (const week of cal.teachingWeeks) {
		for (let day = 1; day <= 5; day++) {
			const date = addDays(week.weekCommencing, day - 1);
			if (from && date < from) continue;

			const dayRemovals: Removal[] = [];
			if (!inAnyTerm(cal.terms, date)) dayRemovals.push({ kind: 'outside-term' });
			const dayBlock = blockedDays.get(date);
			if (dayBlock) dayRemovals.push({ kind: 'day', id: dayBlock.id, note: dayBlock.note });

			const todays = cal.slots
				.filter(
					(slot) =>
						(!classId || slot.classId === classId) &&
						slot.week === week.letter &&
						slot.day === day &&
						slotHolds(slot, date)
				)
				.sort((a, b) => a.period - b.period);

			for (const slot of todays) {
				const block = blockedSlots.get(`${date}|${slot.id}`);
				out.push({
					date,
					period: slot.period,
					slotId: slot.id,
					week: week.letter,
					classId: slot.classId,
					removedBy: block
						? [...dayRemovals, { kind: 'slot', id: block.id, note: block.note }]
						: dayRemovals
				});
			}
		}
	}

	return out;
}

// Available Slot: a Slot on a date inside a Term, within the dates that Slot holds, that no Blocked
// Day or Blocked Slot removes. Returned in calendar order — that order IS the schedule.
export function availableSlots(cal: Calendar, classId: string, from?: string): AvailableSlot[] {
	return timetabledSlots(cal, classId, from)
		.filter((slot) => slot.removedBy.length === 0)
		.map(({ date, period, slotId, week }) => ({ date, period, slotId, week }));
}

// How many Available Slots a Lesson needs for this Class: its Length, plus one per
// Continuation recorded against it. Length and Continuation both widen a Lesson; neither
// creates a second Lesson.
const demandFor = (
	lessonId: string,
	length: number,
	classId: string,
	continuations: Continuation[]
) => length + continuations.filter((c) => c.lessonId === lessonId && c.classId === classId).length;

// The Lesson-parts still owed to this Class, in the Class's Sequence order (ADR-0026).
export function remainingParts(
	lessons: LessonInput[],
	classId: string,
	continuations: Continuation[],
	delivered: Record<string, number>
): RemainingPart[] {
	const parts: RemainingPart[] = [];
	for (const lesson of lessons) {
		const need = demandFor(lesson.id, lesson.length, classId, continuations);
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
// Walked in ascending anchor order — by date, then by the anchor Slot's own Period (`anchorPeriod`,
// resolved where the Placement was loaded), both stable and pure so re-deriving the same
// Placements in the same state always walks them the same way — each claims the first Available
// Slots at-or-after its own anchor from whatever the stream still holds, so a later Placement
// whose anchor collides with an earlier one's claim shifts right past it, never refused. A
// Placement's run is its Lesson's Length plus one Slot per Continuation on that Lesson for this
// Class, the same demand `remainingParts` gives a Sequence Lesson, less the parts already taught.
// `delivered` is the same record `remainingParts` reads for the Sequence. A Lesson is never both
// Placed on a Class and held in its Sequence: Assign Topic skips a Placed Lesson, and Place Lesson
// always makes a new Lesson, so the two never contend for the same entry.
function layPlacements(
	placements: Placement[],
	continuations: Continuation[],
	delivered: Record<string, number>,
	stream: AvailableSlot[]
): {
	sessions: ScheduledSession[];
	openSlots: AvailableSlot[];
	placementLandings: PlacementLanding[];
	unplaced: RemainingPart[];
} {
	const ordered = [...placements].sort((a, b) => {
		if (a.date !== b.date) return a.date < b.date ? -1 : 1;
		return a.anchorPeriod - b.anchorPeriod;
	});

	let remaining = stream;
	const sessions: ScheduledSession[] = [];
	const placementLandings: PlacementLanding[] = [];
	const unplaced: RemainingPart[] = [];

	for (const placement of ordered) {
		const of = demandFor(placement.lessonId, placement.length, placement.classId, continuations);
		const used = delivered[placement.lessonId] ?? 0;
		const need = of - used;
		if (need <= 0) continue;

		const anchorIndex = remaining.findIndex(
			(s) =>
				s.date > placement.date || (s.date === placement.date && s.period >= placement.anchorPeriod)
		);
		const start = anchorIndex === -1 ? remaining.length : anchorIndex;
		const claimed = remaining.slice(start, start + need);

		// The anchor resolution this function already made is the answer describePlacementsMoved
		// needs: where the run's first part landed (or that nothing was left to land on). A run
		// whose part 1 is already history is not moving, so its remaining parts are not a landing
		// to report.
		if (used === 0 || claimed.length === 0) {
			placementLandings.push({
				placementId: placement.id,
				classId: placement.classId,
				lessonId: placement.lessonId,
				anchor: { date: placement.date, period: placement.anchorPeriod },
				landing: claimed[0] ? { date: claimed[0].date, period: claimed[0].period } : null
			});
		}

		// Every Slot at or after the anchor is gone — a Blocked Day at the end of term, or an
		// earlier-anchored Placement's run having already claimed the rest. Nothing is emitted, and
		// the landing above is null so the vanish is never silent.
		if (claimed.length === 0) continue;

		claimed.forEach((slot, i) =>
			sessions.push({
				...slot,
				classId: placement.classId,
				lessonId: placement.lessonId,
				part: used + i + 1,
				of,
				placementId: placement.id
			})
		);

		// The stream ran out mid-run: the parts with nowhere left to go join the Topic stream's
		// own unplaced tail rather than vanishing behind a "part 1 of 3" nothing can finish.
		for (let i = claimed.length; i < need; i++) {
			unplaced.push({ lessonId: placement.lessonId, part: used + i + 1, of });
		}

		remaining = [...remaining.slice(0, start), ...remaining.slice(start + claimed.length)];
	}

	return { sessions, openSlots: remaining, placementLandings, unplaced };
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
	const ownPlacements = placements.filter((p) => p.classId === classId);
	const placementOf = new Map(ownPlacements.map((p) => [p.lessonId, p.id]));
	const slots = new Map(
		timetabledSlots(cal, classId).map((slot) => [`${slot.date}|${slot.period}`, slot.slotId])
	);

	const history: HistorySession[] = sessions
		.filter((s) => s.classId === classId && s.date < boundary)
		.sort((a, b) => (a.date + a.period).localeCompare(b.date + b.period))
		.map((session) => ({
			...session,
			slotId: slots.get(`${session.date}|${session.period}`) ?? null,
			placementId: placementOf.get(session.lessonId)
		}));

	const delivered: Record<string, number> = {};
	for (const s of history) delivered[s.lessonId] = (delivered[s.lessonId] || 0) + 1;

	const {
		sessions: placed,
		openSlots: afterPlacements,
		placementLandings,
		unplaced: strandedParts
	} = layPlacements(
		ownPlacements,
		continuations,
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
		placementLandings
	};
}

// Runway is derived, not stored — the date of a Class's first Open Slot, with the count of
// distinct Lessons still owed but with nowhere to go alongside it (a Lesson of two parts counts once).
export function runway(result: ScheduleResult): Runway {
	return {
		date: result.openSlots[0]?.date ?? null,
		lessonsRemaining: new Set(result.unplaced.map((part) => part.lessonId)).size
	};
}

export interface RunPart {
	classId: string;
	date: string;
	period: number;
	lessonId: string;
	slotId: string | null;
}

export interface Run {
	classId: string;
	date: string;
	periodFrom: number;
	periodTo: number;
	lessonId: string;
	// One id per Period the run covers, in order: slotIds[i] belongs to periodFrom + i. Empty when
	// a Period's occasion has no Slot any more — a recorded Session on a position the Timetable no
	// longer holds has no Slot left to block or to name a Room for.
	slotIds: string[];
}

// One run per Lesson over consecutive Periods on one date: a Lesson with Length above one, a
// Continuation, or a Placement's run is one row spanning its Periods rather than one per Period.
// The same rule reports the schedule and the record, so the Agenda's days ahead, its look-back and
// the Calendar's past never disagree about what was one run. Parts must be in calendar order — the
// schedule lays them that way, and a recorded Session is read Class, date, Period — and a run never
// crosses a date: a Lesson that runs into the next day's first Slot has a date change between its
// parts.
export function runsOf(parts: readonly RunPart[]): Run[] {
	const runs: (Omit<Run, 'slotIds'> & { slotIds: (string | null)[] })[] = [];

	for (const part of parts) {
		const prev = runs.at(-1);
		if (
			prev &&
			prev.classId === part.classId &&
			prev.date === part.date &&
			prev.periodTo + 1 === part.period &&
			prev.lessonId === part.lessonId
		) {
			prev.periodTo = part.period;
			prev.slotIds.push(part.slotId);
			continue;
		}
		runs.push({
			classId: part.classId,
			date: part.date,
			periodFrom: part.period,
			periodTo: part.period,
			lessonId: part.lessonId,
			slotIds: [part.slotId]
		});
	}

	return runs.map(({ slotIds, ...run }) =>
		slotIds.every((id): id is string => id !== null) ? { ...run, slotIds } : { ...run, slotIds: [] }
	);
}
