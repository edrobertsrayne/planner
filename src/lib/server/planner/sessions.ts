// A Session — one occasion of one Class — and the two things Ed does to it directly: writing the
// Teaching note of its Lesson, and marking that it needs more time. Everything else about a Session is derived.
import { and, eq } from 'drizzle-orm';
import * as schema from '../db/schema';
import { classDetail } from './classes';
import { rederive, type Db, type WriteReport } from './derive';
import { linksOf, tagsOf, type LessonStatus } from './authoring';
import { attachmentsOf } from './attachments';
import { Refused } from './refused';
import { teachingNoteOf } from './sequence';
import { lessonBody } from './fields';

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
	lesson: {
		id: string;
		title: string;
		topicName: string | null;
		body: string | null;
		status: LessonStatus;
		length: number;
		links: ReturnType<typeof linksOf>;
		tags: string[];
		attachments: ReturnType<typeof attachmentsOf>;
	} | null;
	ready: boolean | null;
	note: string | null;
	// The Placement naming this occasion's Lesson, if it has one — what the Session panel's
	// Remove-placement button deletes by (issue #254). A Standalone Lesson may in the rare case
	// be placed on this same Class twice (ADR-0022); the first Placement naming this pairing is
	// taken, since telling the two apart from one occasion alone needs no further design here.
	placement: { id: string } | null;
	// Whether the Session panel's Place-a-Lesson card should show. Placing is future-and-today
	// only (placement.ts), never a correction to the past. A Topic Lesson already on the occasion
	// is no refusal (issue #256): a Placement claims its Slot ahead of the Topic stream, so that
	// Lesson and every Lesson after it shift right. A Placement already anchored here is the one
	// refusal — a second one on the same anchor collides on `placement_anchor`.
	canPlace: boolean;
	// Continuations recorded on this occasion — what the rail's status line counts and "Remove one" removes.
	continuations: number;
}

// The Session panel's one read (issue #35) — the only place a Session is read or written. A
// Session is identified by its occasion, not by its Lesson, so this never fails to resolve just
// because the occasion carries no Lesson: an Open Slot is still an occasion Ed may want to
// write about.
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
		const [lessonRow] = db
			.select({
				id: schema.lesson.id,
				title: schema.lesson.title,
				body: schema.lesson.body,
				status: schema.lesson.status,
				length: schema.lesson.length,
				topicName: schema.topic.name
			})
			.from(schema.lesson)
			.leftJoin(schema.topic, eq(schema.topic.id, schema.lesson.topicId))
			.where(eq(schema.lesson.id, row.lessonId))
			.all();
		if (lessonRow) {
			lesson = {
				...lessonRow,
				links: linksOf(db, row.lessonId),
				tags: tagsOf(db, row.lessonId),
				attachments: attachmentsOf(db, row.lessonId)
			};
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
		canPlace: occasion.date >= today && placement === null
	};
}

// The Session page's one write: the Teaching note of the occasion's Lesson, kept by Class and
// Lesson, so it is shared by every Session of that Lesson on this Class and follows the Lesson
// when it moves. An empty body deletes the note. An Open Slot has no Lesson, so it has no note:
// writing one is `invalid`.
export function writeTeachingNote(
	db: Db,
	{ note, ...occasion }: Occasion & { note: string | null }
) {
	const [row] = db
		.select({ lessonId: schema.session.lessonId })
		.from(schema.session)
		.where(atOccasion(occasion))
		.all();
	if (!row?.lessonId)
		throw new Refused('invalid', 'An Open Slot has no Lesson to write a note on.');

	const key = { classId: occasion.classId, lessonId: row.lessonId };
	const body = lessonBody(note);
	if (body === null) {
		db.delete(schema.teachingNote)
			.where(
				and(
					eq(schema.teachingNote.classId, key.classId),
					eq(schema.teachingNote.lessonId, key.lessonId)
				)
			)
			.run();
		return;
	}
	db.insert(schema.teachingNote)
		.values({ ...key, body })
		.onConflictDoUpdate({
			target: [schema.teachingNote.classId, schema.teachingNote.lessonId],
			set: { body }
		})
		.run();
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

	db.insert(schema.continuation).values({ sessionId: existing.id }).run();

	return rederive(db, occasion.classId, today);
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
	db.delete(schema.continuation).where(eq(schema.continuation.id, row.id)).run();
	return rederive(db, occasion.classId, today);
}
