// Import — one Topic, with its Lessons and their Links, in one all-or-nothing transaction, and
// optionally its Course. Each step is the one-at-a-time writer, so every field runs the rule it
// runs on create; a refusal on the ninth Lesson leaves nothing behind.
import { eq, sql } from 'drizzle-orm';
import * as schema from '../db/schema';
import { inTransaction } from '../db';
import { Refused } from './refused';
import { required } from './fields';
import { createCourse, createTopic } from './courses';
import { createLesson } from './lessons';
import { createLink } from './links';
import type { Db } from './derive';

// What an Import asks for: the Course, named by its id or its name, one Topic, and that Topic's
// Lessons with their Links.
type ImportRequest = {
	courseId?: string;
	courseName?: string;
	topicName: string;
	lessons: Array<{
		title: string;
		body?: string | null;
		length?: number;
		status?: string;
		links?: Array<{ url: string; label: string }>;
	}>;
};

// What an Import made, so the door can answer 201 with it.
type ImportedTopic = {
	course: { id: string; name: string };
	courseCreated: boolean;
	topic: { id: string; name: string; courseId: string };
	lessons: Array<{
		id: string;
		title: string;
		position: number;
		links: Array<{ id: string; url: string; label: string; position: number }>;
	}>;
};

// The Course an Import targets: the one with that name, created when the name is new, or the one
// with that id, which must exist. The guard in importTopic promises exactly one of the two.
function importCourse(
	db: Db,
	{ id, name }: { id?: string; name?: string }
): { course: { id: string; name: string }; created: boolean } {
	if (name !== undefined) {
		const trimmed = required(name, 'A Course needs a name.');
		const [existing] = db
			.select({ id: schema.course.id, name: schema.course.name })
			.from(schema.course)
			.where(sql`lower(${schema.course.name}) = lower(${trimmed})`)
			.all();
		if (existing) return { course: existing, created: false };
		return { course: createCourse(db, { name: trimmed }), created: true };
	}
	const [found] = db
		.select({ id: schema.course.id, name: schema.course.name })
		.from(schema.course)
		.where(eq(schema.course.id, id ?? ''))
		.all();
	if (!found) throw new Refused('missing', 'Course not found.');
	return { course: found, created: false };
}

// Creates one Topic, with its Lessons and their Links, in a single all-or-nothing transaction —
// optionally creating its Course inline if it does not yet exist. Each step is the one-at-a-time
// writer called inside the transaction, so every field runs the rule it runs on create, and a
// refusal on the ninth Lesson leaves nothing behind: `Refused` rolls the write back on the way out
// through `inTransaction`, and every other throw rolls back too and propagates, so an unexpected
// fault reaches the door as the 500 it is, with nothing committed.
export function importTopic(
	db: Db,
	{ courseId, courseName, topicName, lessons }: ImportRequest
): ImportedTopic {
	if ((courseId === undefined) === (courseName === undefined)) {
		throw new Refused('invalid', 'The "course" field must carry exactly one of "id" or "name".');
	}

	return inTransaction(db.$client, () => {
		const { course, created: courseCreated } = importCourse(db, { id: courseId, name: courseName });
		const topic = createTopic(db, { courseId: course.id, name: topicName });
		const created: ImportedTopic['lessons'] = lessons.map((lesson) => {
			const { lesson: row } = createLesson(db, {
				topicId: topic.id,
				title: lesson.title,
				body: lesson.body,
				length: lesson.length,
				status: lesson.status
			});
			const links = (lesson.links ?? []).map((link) =>
				createLink(db, { lessonId: row.id, url: link.url, label: link.label })
			);
			return {
				id: row.id,
				title: row.title,
				position: row.position,
				links: links.map(({ id, url, label, position }) => ({ id, url, label, position }))
			};
		});

		return {
			course: { id: course.id, name: course.name },
			courseCreated,
			topic: { id: topic.id, name: topic.name, courseId: topic.courseId },
			lessons: created
		};
	});
}
