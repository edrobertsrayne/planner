// PROTOTYPE, throwaway (issue #372). Reads one Class's Sequence as it would be stored, and lays
// out any proposed order with the real engine. It never writes: every move, Add Lesson, Remove
// Lesson and Assign Topic in the prototype lives in the browser, and only asks for dates here.
import { and, asc, eq, isNotNull } from 'drizzle-orm';
import * as schema from '$lib/server/db/schema';
import { loadCalendar, type Db } from '$lib/server/planner/derive';
import { schedule, type LessonInput } from '$lib/server/planner/engine';

export interface ProtoEntry {
	id: string;
	title: string;
	topicId: string | null;
	topicName: string | null;
	length: number;
	status: 'draft' | 'planned';
	// Keyed (Class, Lesson), as decided in #371: the note rides with its Lesson through a move.
	note: string | null;
	// Readiness is keyed (Class, Lesson) too: a Remove loses it (#379).
	ready: boolean;
}

export interface ProtoPart {
	date: string;
	period: number;
}

export interface ProtoLayout {
	// Every dated part of each Lesson: taught (before today) and scheduled (today on).
	parts: Record<string, ProtoPart[]>;
	// Parts with no Slot left this year.
	unplaced: Record<string, number>;
	// Lessons with a Session on or before today: locked (#371).
	locked: string[];
	lastSlot: string | null;
	// Every Slot from today to the end of the year, in order. The order of the Lessons never
	// changes this stream; a move only changes which Lesson each Slot holds.
	stream: { date: string; period: number }[];
	// Teaching Weeks with their letter. A week missing here is a holiday.
	weeks: { weekCommencing: string; letter: 'A' | 'B' }[];
}

export interface ProtoTopic {
	id: string;
	name: string;
	lessons: ProtoEntry[];
}

function lessonsOf(db: Db, classId: string): ProtoEntry[] {
	return db
		.select({
			id: schema.lesson.id,
			title: schema.lesson.title,
			topicId: schema.topic.id,
			topicName: schema.topic.name,
			length: schema.lesson.length,
			status: schema.lesson.status
		})
		.from(schema.assignedTopic)
		.innerJoin(schema.topic, eq(schema.topic.id, schema.assignedTopic.topicId))
		.innerJoin(schema.lesson, eq(schema.lesson.topicId, schema.topic.id))
		.where(eq(schema.assignedTopic.classId, classId))
		.orderBy(asc(schema.assignedTopic.position), asc(schema.lesson.position))
		.all()
		.map((l) => ({ ...l, note: null, ready: false }));
}

// Today's notes live on the Session; the prototype gathers them onto the (Class, Lesson) entry.
function notesOf(db: Db, classId: string): Map<string, string> {
	const rows = db
		.select({ lessonId: schema.session.lessonId, note: schema.session.note })
		.from(schema.session)
		.where(and(eq(schema.session.classId, classId), isNotNull(schema.session.note)))
		.all();
	const notes = new Map<string, string>();
	for (const r of rows) if (r.lessonId && r.note) notes.set(r.lessonId, r.note);
	return notes;
}

function readyOf(db: Db, classId: string): Set<string> {
	return new Set(
		db
			.select({ lessonId: schema.readiness.lessonId })
			.from(schema.readiness)
			.where(eq(schema.readiness.classId, classId))
			.all()
			.map((r) => r.lessonId)
	);
}

export function prototypeSequence(db: Db, classId: string, courseId: string) {
	const notes = notesOf(db, classId);
	const ready = readyOf(db, classId);
	const sequence = lessonsOf(db, classId).map((l) => ({
		...l,
		note: notes.get(l.id) ?? null,
		ready: ready.has(l.id)
	}));

	// To show the overlap mark, the last untaught Lesson of the last Topic starts "removed", as
	// if the teacher had taken it out of this Class's Sequence earlier.
	const lastTopic = sequence.at(-1)?.topicId;
	const removedId = sequence.findLast((l) => l.topicId === lastTopic)?.id;
	const kept = sequence.filter((l) => l.id !== removedId);
	// A demo note near the end, so a Lesson pushed past the end of the year shows one.
	const late = kept.at(-3);
	if (late && !late.note) late.note = 'Book the computer room. (demo note)';

	const topics: ProtoTopic[] = db
		.select({ id: schema.topic.id, name: schema.topic.name })
		.from(schema.topic)
		.where(eq(schema.topic.courseId, courseId))
		.all()
		.map((t) => ({
			...t,
			lessons: db
				.select({
					id: schema.lesson.id,
					title: schema.lesson.title,
					topicId: schema.lesson.topicId,
					length: schema.lesson.length,
					status: schema.lesson.status
				})
				.from(schema.lesson)
				.where(eq(schema.lesson.topicId, t.id))
				.orderBy(asc(schema.lesson.position))
				.all()
				.map((l) => ({ ...l, topicName: t.name, note: null, ready: false }))
		}));

	return { sequence: kept, topics };
}

export function prototypeLayout(
	db: Db,
	{ classId, today, lessons }: { classId: string; today: string; lessons: LessonInput[] }
): ProtoLayout {
	const cal = loadCalendar(db);
	const sessions = db
		.select({
			classId: schema.session.classId,
			date: schema.session.date,
			period: schema.session.period,
			lessonId: schema.session.lessonId
		})
		.from(schema.session)
		.where(eq(schema.session.classId, classId))
		.all()
		.filter((s): s is typeof s & { lessonId: string } => s.lessonId !== null);
	const continuations = db
		.select({ classId: schema.session.classId, lessonId: schema.session.lessonId })
		.from(schema.continuation)
		.innerJoin(schema.session, eq(schema.session.id, schema.continuation.sessionId))
		.where(eq(schema.session.classId, classId))
		.all()
		.filter((c): c is typeof c & { lessonId: string } => c.lessonId !== null);

	const result = schedule({
		cal,
		lessons,
		classId,
		sessions,
		continuations,
		placements: [],
		boundary: today
	});

	const parts: Record<string, ProtoPart[]> = {};
	for (const s of [...result.history, ...result.scheduled]) {
		(parts[s.lessonId] ??= []).push({ date: s.date, period: s.period });
	}
	const unplaced: Record<string, number> = {};
	for (const u of result.unplaced) unplaced[u.lessonId] = (unplaced[u.lessonId] ?? 0) + 1;

	const locked = Object.entries(parts)
		.filter(([, ps]) => ps.some((p) => p.date <= today))
		.map(([id]) => id);

	const stream = [...result.scheduled, ...result.openSlots]
		.map((s) => ({ date: s.date, period: s.period }))
		.sort((a, b) => a.date.localeCompare(b.date) || a.period - b.period);
	const lastSlot = stream.at(-1)?.date ?? null;

	return { parts, unplaced, locked, lastSlot, stream, weeks: cal.teachingWeeks };
}
