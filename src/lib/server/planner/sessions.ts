// A Session — one occasion of one Class — and the two things Ed does to it directly: writing the
// Teaching note of its Lesson, and marking that it needs more time. Everything else about a Session is derived.
import { and, eq } from 'drizzle-orm';
import * as schema from '../db/schema';
import { inTransaction } from '../db';
import { classDetail } from './classes';
import { rederive, type Db, type WriteReport } from './derive';
import { lessonDetail, type LessonDetail } from './lessons';
import { Refused } from './refused';
import { setTeachingNote, teachingNoteOf } from './teaching-notes';
import { lessonBody } from './fields';
import { placementAdmission } from './placement';

// A Session is identified by its occasion (ADR-0002), never by row id, so every function here
// takes the triple rather than an id.
export interface Occasion {
	classId: string;
	date: string;
	period: number;
}

const atOccasion = ({ classId, date, period }: Occasion) =>
	and(
		eq(schema.session.classId, classId),
		eq(schema.session.date, date),
		eq(schema.session.period, period)
	);

export interface SessionDetail extends Occasion {
	classLabel: string;
	// The whole Lesson, read through the same seam function the editor and the API use. Readiness
	// stays beside it: it belongs to this Class, not to the Lesson (ADR-0014).
	lesson: LessonDetail | null;
	ready: boolean | null;
	note: string | null;
	// The Placement naming this occasion's Lesson, if it has one — what the Session panel's
	// Remove-placement button deletes by (issue #254).
	placement: { id: string } | null;
	// Whether the Session panel's Place-a-Lesson card should show: the seam's one admission answer
	// for this occasion (placement.ts), the same value the Calendar's day menu reads, so the two
	// screens can never offer and refuse different occasions.
	canPlace: boolean;
	// Continuations recorded on this occasion — what the rail's status line counts and "Remove one" removes.
	continuations: number;
	// The server's day this was read on, so the panel judges "started" and "still ahead" by the same
	// day the seam did, not by the browser's clock.
	today: string;
}

// The Session panel's one read (issue #35) — the only place a Session is read or written. A
// Session is identified by its occasion, not by its Lesson, so this never fails to resolve just
// because the occasion carries no Lesson: an Open Slot still resolves to a detail (Place a
// Lesson, Continuations), but it has no Lesson and so no Teaching note.
export function sessionDetail(
	db: Db,
	{ today, ...occasion }: Occasion & { today: string }
): SessionDetail | null {
	const cls = classDetail(db, occasion.classId);
	if (!cls) return null;

	const [row] = db
		.select({
			id: schema.session.id,
			lessonId: schema.session.lessonId
		})
		.from(schema.session)
		.where(atOccasion(occasion))
		.all();

	let lesson: SessionDetail['lesson'] = null;
	let ready: boolean | null = null;
	let note: string | null = null;
	let placement: SessionDetail['placement'] = null;
	if (row?.lessonId) {
		const lessonRow = lessonDetail(db, row.lessonId);
		if (lessonRow) {
			lesson = lessonRow;
			const [readyRow] = db
				.select()
				.from(schema.readiness)
				.where(
					and(
						eq(schema.readiness.lessonId, row.lessonId),
						eq(schema.readiness.classId, occasion.classId)
					)
				)
				.all();
			ready = readyRow !== undefined;
			note = teachingNoteOf(db, occasion.classId, row.lessonId);

			const [placementRow] = db
				.select({ id: schema.placement.id })
				.from(schema.placement)
				.where(
					and(
						eq(schema.placement.lessonId, row.lessonId),
						eq(schema.placement.classId, occasion.classId)
					)
				)
				.all();
			placement = placementRow ?? null;
		}
	}

	return {
		...occasion,
		classLabel: cls.label,
		lesson,
		ready,
		note,
		continuations: row
			? db
					.select({ id: schema.continuation.id })
					.from(schema.continuation)
					.where(eq(schema.continuation.sessionId, row.id))
					.all().length
			: 0,
		placement,
		canPlace: placementAdmission(db, { ...occasion, today }).admitted,
		today
	};
}

// The Session page's one write: the Teaching note of the occasion's Lesson, kept by Class and
// Lesson, so it is shared by every Session of that Lesson on this Class and follows the Lesson
// when it moves. An empty body deletes the note. An Open Slot has no Lesson, so it has no note:
// writing one is `invalid`. The panel names the Lesson it shows; if the occasion has since
// moved to another Lesson, the write is `invalid` too, so a note never lands on the wrong one.
export function writeTeachingNote(
	db: Db,
	{ note, lessonId, ...occasion }: Occasion & { note: string | null; lessonId: string }
) {
	const [row] = db
		.select({ lessonId: schema.session.lessonId })
		.from(schema.session)
		.where(atOccasion(occasion))
		.all();
	if (!row?.lessonId)
		throw new Refused('invalid', 'An Open Slot has no Lesson to write a note on.');
	if (lessonId !== row.lessonId)
		throw new Refused('invalid', 'This Session now has a different Lesson. Reload to see it.');

	setTeachingNote(db, occasion.classId, row.lessonId, lessonBody(note));
}

// A Session marked as needing more time: its Lesson widens to occupy the next Available Slot too.
// The Session must already have started (dated today or earlier), since a Continuation is a reaction to
// how teaching actually went, not a plan. Both refusals are `invalid`: an occasion with no
// Session to continue, and an occasion that has not happened yet, are each bad input to this
// write — the occasion comes from the request body, not the URL.
export function recordContinuation(
	db: Db,
	{ today, ...occasion }: Occasion & { today: string }
): WriteReport {
	const [existing] = db
		.select({ id: schema.session.id })
		.from(schema.session)
		.where(atOccasion(occasion))
		.all();
	if (!existing)
		throw new Refused(
			'invalid',
			`No Session on ${occasion.date} P${occasion.period} for this Class.`
		);
	if (occasion.date > today) {
		throw new Refused(
			'invalid',
			`The ${occasion.date} P${occasion.period} Session has not been taught yet.`
		);
	}

	// The Continuation and the schedule it widens commit together: a Session marked "needs more
	// time" whose later parts were never re-derived is a lie about the record, and no forward
	// re-derivation reaches back past today to repair it.
	return inTransaction(db.$client, () => {
		db.insert(schema.continuation).values({ sessionId: existing.id }).run();

		return rederive(db, occasion.classId, today);
	});
}

// Remove a Continuation: undoes one "Needs more time" on this occasion, so the Lesson's later
// Sessions move back one Available Slot. No date rule — a past extra Session stays in the record.
export function removeContinuation(
	db: Db,
	{ today, ...occasion }: Occasion & { today: string }
): WriteReport {
	const [existing] = db
		.select({ id: schema.session.id })
		.from(schema.session)
		.where(atOccasion(occasion))
		.all();
	if (!existing)
		throw new Refused(
			'invalid',
			`No Session on ${occasion.date} P${occasion.period} for this Class.`
		);
	const [row] = db
		.select({ id: schema.continuation.id })
		.from(schema.continuation)
		.where(eq(schema.continuation.sessionId, existing.id))
		.limit(1)
		.all();
	if (!row)
		throw new Refused(
			'invalid',
			`No Continuation on ${occasion.date} P${occasion.period} to remove.`
		);
	// The removal and the schedule it narrows commit together, the mirror of recordContinuation.
	return inTransaction(db.$client, () => {
		db.delete(schema.continuation).where(eq(schema.continuation.id, row.id)).run();

		return rederive(db, occasion.classId, today);
	});
}
