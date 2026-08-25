// A Session — one occasion of one Class — and the two things Ed does to it directly: writing a
// note, and marking that it needs more time. Everything else about a Session is derived.
import { and, eq } from 'drizzle-orm';
import * as schema from '../db/schema';
import { classDetail } from './classes';
import { rederive, type Db, type WriteReport } from './derive';
import { linksOf } from './authoring';

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
		title: string;
		topicName: string;
		body: string | null;
		links: ReturnType<typeof linksOf>;
	} | null;
	note: string | null;
}

// The Session panel's one read (issue #35) — the only place a Session is read or written. A
// Session is identified by its occasion, not by its Lesson, so this never fails to resolve just
// because the occasion carries no Lesson: an Open Slot is still an occasion Ed may want to
// write about.
export function sessionDetail(db: Db, occasion: Occasion): SessionDetail | null {
	const cls = classDetail(db, occasion.classId);
	if (!cls) return null;

	const [row] = db
		.select({ lessonId: schema.session.lessonId, note: schema.session.note })
		.from(schema.session)
		.where(atOccasion(occasion))
		.all();

	let lesson: SessionDetail['lesson'] = null;
	if (row?.lessonId) {
		const [lessonRow] = db
			.select({
				title: schema.lesson.title,
				body: schema.lesson.body,
				topicName: schema.topic.name
			})
			.from(schema.lesson)
			.innerJoin(schema.topic, eq(schema.topic.id, schema.lesson.topicId))
			.where(eq(schema.lesson.id, row.lessonId))
			.all();
		if (lessonRow) lesson = { ...lessonRow, links: linksOf(db, row.lessonId) };
	}

	return { ...occasion, classLabel: cls.label, lesson, note: row?.note ?? null };
}

// The Session panel's one write (issue #35): a free-text note against the occasion, never against
// the Lesson (ADR-0002). Upserts on the occasion's unique key without touching lessonId, so
// writing a note never disturbs the schedule — and an Open Slot, which has no Session row
// until now, gets one carrying no Lesson, purely to hold the note.
export function writeSessionNote(
	db: Db,
	{ note, ...occasion }: Occasion & { note: string | null }
) {
	db.insert(schema.session)
		.values({ ...occasion, lessonId: null, note })
		.onConflictDoUpdate({
			target: [schema.session.classId, schema.session.date, schema.session.period],
			set: { note }
		})
		.run();
}

// A Session marked as needing more time: its Lesson widens to occupy the next Available Slot too.
// The Session must already be taught (dated before today), since a Continuation is a reaction to
// how teaching actually went, not a plan.
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
		throw new Error(`No Session on ${occasion.date} P${occasion.period} for this Class.`);
	if (occasion.date >= today) {
		throw new Error(`The ${occasion.date} P${occasion.period} Session has not been taught yet.`);
	}

	db.insert(schema.continuation).values({ sessionId: existing.id }).run();

	return rederive(db, occasion.classId, today);
}
