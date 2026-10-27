// Lessons — the plan itself. A Lesson is shared by every Class and is not itself a scheduling
// input, except its Length: a change to Length re-derives every Class that reaches the Lesson, on
// the same write (issue #31). Title, body, status and Topic never move a date (ADR-0014).
import { and, asc, eq, inArray } from 'drizzle-orm';
import { lessonDeleteText } from '$lib/delete-text';
import * as schema from '../db/schema';
import { inTransaction } from '../db';
import { combineReports, loadCalendar, rederive, type Db, type WriteReport } from './derive';
import { nextPosition, swapTargets, type Direction } from './ordering';
import { attachmentsOf, removeAttachmentFiles } from './attachments';
import { Refused } from './refused';
import { fixedOn } from './sequence';
import { lessonBody, lessonLength, lessonStatus, required, requireRow } from './fields';
import { linksOf } from './links';
import { attachedTags } from './tags';
import type { ConfirmQuestion } from './courses';

export function lessonsOf(db: Db, topicId: string) {
	return db
		.select()
		.from(schema.lesson)
		.where(eq(schema.lesson.topicId, topicId))
		.orderBy(asc(schema.lesson.position))
		.all();
}

// Where a new Lesson lands in its Topic's order (ADR-0026: Lessons, unlike Topics, are explicitly
// ordered) — at the end, both for a new Lesson and for one moved in from another Topic.
const endOfTopic = (db: Db, topicId: string) =>
	nextPosition(
		db
			.select({ position: schema.lesson.position })
			.from(schema.lesson)
			.where(eq(schema.lesson.topicId, topicId))
			.all()
	);

// A title alone is a complete Lesson — no draft state, no required second field. It joins no
// Sequence, so no Class's dates change (ADR-0026).
export function createLesson(
	db: Db,
	{
		topicId,
		title,
		body,
		length,
		status
	}: {
		topicId: string;
		title: string;
		body?: string | null;
		length?: number;
		status?: string;
	}
): { lesson: typeof schema.lesson.$inferSelect } {
	requireRow(db, schema.topic, topicId, 'Topic not found.');
	const [row] = db
		.insert(schema.lesson)
		.values({
			topicId,
			title: required(title, 'A Lesson needs a title.'),
			position: endOfTopic(db, topicId),
			...(body !== undefined ? { body: lessonBody(body) } : {}),
			...(length !== undefined ? { length: lessonLength(length) } : {}),
			...(status !== undefined ? { status: lessonStatus(status) } : {})
		})
		.returning()
		.all();
	return { lesson: row };
}

// The whole Lesson, for every reader that shows one: the row, its Topic and Course (both null for a
// Standalone Lesson or a Topic with no Course), its Links, its Tags with ids and its Attachments.
// The editor, the bearer-key API and the Session panel all read a Lesson through here, so a new
// part of a Lesson is added once (ADR-0025).
export type LessonDetail = typeof schema.lesson.$inferSelect & {
	topic: { id: string; name: string; courseId: string } | null;
	course: { id: string; name: string } | null;
	links: ReturnType<typeof linksOf>;
	tags: { id: string; name: string }[];
	attachments: ReturnType<typeof attachmentsOf>;
};

export function lessonDetail(db: Db, id: string): LessonDetail | null {
	const [row] = db.select().from(schema.lesson).where(eq(schema.lesson.id, id)).all();
	if (!row) return null;

	// Readiness stays out: a Lesson is shared by every Class, and Readiness belongs to one pairing
	// of Lesson and Class (ADR-0014).
	const [topic] = row.topicId
		? db
				.select({
					id: schema.topic.id,
					name: schema.topic.name,
					courseId: schema.topic.courseId
				})
				.from(schema.topic)
				.where(eq(schema.topic.id, row.topicId))
				.all()
		: [];
	const [course] = topic
		? db
				.select({ id: schema.course.id, name: schema.course.name })
				.from(schema.course)
				.where(eq(schema.course.id, topic.courseId))
				.all()
		: [];

	return {
		...row,
		topic: topic ?? null,
		course: course ?? null,
		links: linksOf(db, id),
		tags: attachedTags(db, id),
		attachments: attachmentsOf(db, id)
	};
}

// One change to one Lesson. The change names any of title, body, Length, status and Topic; a field
// it does not name keeps its value, and a `null` Topic is Detach. Every door that writes a Lesson
// calls this, so the Lesson editor and the API give the same answer to the same change (#356).
export type LessonChange = {
	title?: string;
	body?: string | null;
	length?: number;
	status?: string;
	topicId?: string | null;
};

// The rules for the change, all here:
// - The field rules in fields.ts run on each field the change names.
// - A Topic the change names but the database does not hold is `missing`. The check comes first,
//   so an unknown `topicId` answers 404 whatever the Lesson's own Topic (spec §3.4).
// - A move lands at the end of the new Topic's order: the Lesson has no position there yet.
//   Filing — another Topic, Detach, or a Topic for a Standalone Lesson — changes no Sequence,
//   re-derives nothing and keeps Readiness and Placements (ADR-0026).
// - A change that sets nothing writes nothing and reports nothing.
// - Length is the one scheduling input here. A change to it re-derives every Class that holds the
//   Lesson in its Sequence or by a Placement. Title, body and status never move a date
//   (ADR-0014), so they re-derive nothing.
// An unknown id returns undefined, the door's 404.
export function editLesson(
	db: Db,
	{ id, change, today }: { id: string; change: LessonChange; today: string }
): ({ lesson: typeof schema.lesson.$inferSelect } & WriteReport) | undefined {
	const [row] = db.select().from(schema.lesson).where(eq(schema.lesson.id, id)).all();
	if (!row) return undefined;

	const next: Partial<typeof schema.lesson.$inferInsert> = {};
	if (change.title !== undefined) next.title = required(change.title, 'A Lesson needs a title.');
	if (change.body !== undefined) next.body = lessonBody(change.body);
	if (change.length !== undefined) next.length = lessonLength(change.length);
	if (change.status !== undefined) next.status = lessonStatus(change.status);

	const { topicId } = change;
	const moves = topicId !== undefined && topicId !== row.topicId;
	if (moves && topicId !== null) {
		requireRow(db, schema.topic, topicId, 'Topic not found.');
		next.position = endOfTopic(db, topicId);
	}
	if (moves) next.topicId = topicId;

	const changed = Object.fromEntries(
		Object.entries(next).filter(([key, value]) => row[key as keyof typeof row] !== value)
	) as typeof next;
	if (Object.keys(changed).length === 0) return { lesson: row, placementsMoved: [] };

	// The row and every Class's re-derivation commit together: a stored Length whose Classes were
	// half re-derived is a schedule no reader may see, and nothing forward re-derives it away.
	const lengthChanged = 'length' in changed;
	return inTransaction(db.$client, () => {
		const [lesson] = db
			.update(schema.lesson)
			.set(changed)
			.where(eq(schema.lesson.id, id))
			.returning()
			.all();
		// Only a Length change moves dates, so only it re-derives the Classes that hold the Lesson.
		if (!lengthChanged) return { lesson, placementsMoved: [] };

		return { lesson, ...rederiveHolders(db, id, today) };
	});
}

// Re-derives, from today, every Class that holds the Lesson in its Sequence or by a Placement. The
// Calendar is loaded once and passed to each, so the work is one read rather than one per Class.
function rederiveHolders(db: Db, lessonId: string, today: string): WriteReport {
	const inSequence = db
		.select({ classId: schema.classLesson.classId })
		.from(schema.classLesson)
		.where(eq(schema.classLesson.lessonId, lessonId));
	const placed = db
		.select({ classId: schema.placement.classId })
		.from(schema.placement)
		.where(eq(schema.placement.lessonId, lessonId));
	const cal = loadCalendar(db);
	return combineReports(
		inSequence
			.union(placed)
			.all()
			.map((entry) => rederive(db, entry.classId, today, cal))
	);
}

// Removes a Lesson entirely, along with its Links, and re-derives every Class that held it.
// Refuses when a Lesson is Fixed for any Class (a Session on or before today, the rule in
// `fixedLessonIds`): the historical Session rows reference it (ADR-0002), so deleting it would
// erase part of the record of what happened — the taught-by block in the Lesson editor is what
// warns Ed before he tries this and it fails.
// Refuses too while any Placement names the Lesson (ADR-0022): the "no mark" answer to whether a
// Standalone Lesson is schedulable depends entirely on a `placement` row naming it, so deleting
// one out from under a live Placement would leave that row naming a Lesson that no longer exists.
// When a Sequence holds the Lesson, the caller must confirm first (ADR-0026): the answer is a
// `needsConfirm` question that names the Classes. The API has no confirm, so it turns that
// question into a 409. On confirm, the cascade takes the entries, Readiness and Teaching notes,
// and the Attachment rows; their files are unlinked only once the write has committed, so nothing
// a failed re-derivation rolls back loses a file.
// An unknown id returns undefined, the door's 404; every other refusal throws `Refused`.
export function deleteLesson(
	db: Db,
	{
		id,
		today,
		dir,
		confirmed = false
	}: { id: string; today: string; dir: string; confirmed?: boolean }
): ({ lesson: typeof schema.lesson.$inferSelect } & WriteReport) | ConfirmQuestion | undefined {
	const [row] = db.select().from(schema.lesson).where(eq(schema.lesson.id, id)).all();
	if (!row) return undefined;

	if (classesTaughtLesson(db, { lessonId: id, today }).length > 0) {
		throw new Refused(
			'conflict',
			'A Class has already been taught this Lesson, so it cannot be removed.'
		);
	}

	const [placedBy] = db
		.select({ id: schema.placement.id })
		.from(schema.placement)
		.where(eq(schema.placement.lessonId, id))
		.all();
	if (placedBy) {
		throw new Refused(
			'conflict',
			'A Placement names this Lesson, so it cannot be removed. Remove the Placement first.'
		);
	}

	const sequenceClasses = db
		.select({ id: schema.classes.id, label: schema.classes.label })
		.from(schema.classLesson)
		.innerJoin(schema.classes, eq(schema.classes.id, schema.classLesson.classId))
		.where(eq(schema.classLesson.lessonId, id))
		.orderBy(asc(schema.classes.label))
		.all();
	if (sequenceClasses.length > 0 && !confirmed) {
		return { needsConfirm: true, reason: lessonDeleteText(sequenceClasses.map((c) => c.label)) };
	}

	// Not-yet-taught Sessions carrying this Lesson are about to be replaced by the re-derivation
	// below — clear them, and their Continuations, before dropping the Lesson row itself.
	//
	// The rows go in one transaction with the re-derivation, and the Attachments' files are
	// unlinked only once it has committed (issue #417): a refusal, a constraint or a failed
	// re-derivation must leave the Lesson, every Session and every file where they were, since a
	// file is the one thing a rollback cannot restore. `attachmentsOf` is read first because the
	// join disappears with the rows.
	const { report, attachmentIds } = inTransaction(db.$client, () => {
		const attachmentIds = attachmentsOf(db, id).map((attachment) => attachment.id);

		db.delete(schema.continuation)
			.where(
				inArray(
					schema.continuation.sessionId,
					db
						.select({ id: schema.session.id })
						.from(schema.session)
						.where(eq(schema.session.lessonId, id))
				)
			)
			.run();
		db.delete(schema.session).where(eq(schema.session.lessonId, id)).run();

		db.delete(schema.link).where(eq(schema.link.lessonId, id)).run();
		if (attachmentIds.length > 0) {
			db.delete(schema.attachment).where(eq(schema.attachment.lessonId, id)).run();
		}
		db.delete(schema.lesson).where(eq(schema.lesson.id, id)).run();

		const cal = loadCalendar(db);
		const report = combineReports(sequenceClasses.map((c) => rederive(db, c.id, today, cal)));
		return { report, attachmentIds };
	});

	// Nothing names these files now that their rows are gone. A missing file is already the
	// desired end state, so the shared cleanup ignores only ENOENT.
	removeAttachmentFiles(dir, attachmentIds);

	return { lesson: row, ...report };
}

// Swaps position with the previous or next Lesson in the same Topic. Off either end is a no-op —
// there is no wraparound and no error, same as moveLink. It sets the Topic's Lesson order only;
// no Sequence changes, so nothing is re-derived (ADR-0026).
export function moveLesson(
	db: Db,
	{ topicId, id, direction }: { topicId: string; id: string; direction: Direction }
): void {
	const swap = swapTargets(lessonsOf(db, topicId), id, direction);
	if (!swap) return;

	const [a, b] = swap;
	db.update(schema.lesson).set({ position: b.position }).where(eq(schema.lesson.id, a.id)).run();
	db.update(schema.lesson).set({ position: a.position }).where(eq(schema.lesson.id, b.id)).run();
}

// Which Classes have this Lesson Fixed — a Session for it on or before `today`, the one rule in
// `fixedLessonIds`. It is the taught-by block in the Lesson editor, so Ed knows an edit here
// touches a plan already in use, and what makes deleteLesson refuse.
export function classesTaughtLesson(
	db: Db,
	{ lessonId, today }: { lessonId: string; today: string }
) {
	return db
		.selectDistinct({ id: schema.classes.id, label: schema.classes.label })
		.from(schema.classes)
		.innerJoin(schema.session, eq(schema.session.classId, schema.classes.id))
		.where(and(eq(schema.session.lessonId, lessonId), fixedOn(today)))
		.orderBy(asc(schema.classes.label))
		.all();
}
