import {
	check,
	integer,
	primaryKey,
	sqliteTable,
	text,
	unique,
	uniqueIndex
} from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

const id = () =>
	text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID());

// Planning

export const course = sqliteTable(
	'course',
	{
		id: id(),
		name: text('name').notNull()
	},
	(table) => [uniqueIndex('course_name_unique').on(sql`${table.name} COLLATE NOCASE`)]
);

export const topic = sqliteTable(
	'topic',
	{
		id: id(),
		name: text('name').notNull(),
		courseId: text('course_id')
			.notNull()
			.references(() => course.id)
	},
	(table) => [
		uniqueIndex('topic_name_per_course').on(sql`${table.courseId}, ${table.name} COLLATE NOCASE`)
	]
);

export const lesson = sqliteTable(
	'lesson',
	{
		id: id(),
		topicId: text('topic_id').references(() => topic.id),
		title: text('title').notNull(),
		body: text('body'),
		status: text('status', { enum: ['draft', 'planned'] })
			.notNull()
			.default('draft'),
		length: integer('length').notNull().default(1),
		position: integer('position').notNull()
	},
	(table) => [check('lesson_status', sql`${table.status} in ('draft','planned')`)]
);

export const link = sqliteTable('link', {
	id: id(),
	lessonId: text('lesson_id')
		.notNull()
		.references(() => lesson.id),
	url: text('url').notNull(),
	label: text('label').notNull(),
	position: integer('position').notNull()
});

// A Tag is a short, user-typed label a Lesson may carry zero or more of — freely created, never
// drawn from a fixed set. Names are unique across the planner, case-insensitive, mirroring
// course.name's COLLATE NOCASE pattern. A Tag with zero Lessons still exists: detaching it from
// a Lesson never deletes the row.
export const tag = sqliteTable(
	'tag',
	{
		id: id(),
		name: text('name').notNull()
	},
	(table) => [uniqueIndex('tag_name_unique').on(sql`${table.name} COLLATE NOCASE`)]
);

// The Lesson/Tag attachment. The composite primary key makes attaching idempotent — attaching a
// Tag a Lesson already carries is a no-op, not a duplicate row. Both sides cascade: deleting a
// Lesson drops its attachments, and deleting a Tag drops the attachments that named it — but
// deleting a Lesson never cascades into `tag` itself, so an untagged Tag survives.
export const lessonTag = sqliteTable(
	'lesson_tag',
	{
		lessonId: text('lesson_id')
			.notNull()
			.references(() => lesson.id, { onDelete: 'cascade' }),
		tagId: text('tag_id')
			.notNull()
			.references(() => tag.id, { onDelete: 'cascade' })
	},
	(table) => [primaryKey({ columns: [table.lessonId, table.tagId] })]
);
export const attachment = sqliteTable('attachment', {
	id: id(),
	lessonId: text('lesson_id')
		.notNull()
		.references(() => lesson.id),
	filename: text('filename').notNull(),
	mimeType: text('mime_type').notNull(),
	size: integer('size').notNull(),
	position: integer('position').notNull()
});

export const readiness = sqliteTable(
	'readiness',
	{
		id: id(),
		lessonId: text('lesson_id')
			.notNull()
			.references(() => lesson.id, { onDelete: 'cascade' }),
		classId: text('class_id')
			.notNull()
			.references(() => classes.id, { onDelete: 'cascade' })
	},
	(table) => [unique('readiness_pairing').on(table.lessonId, table.classId)]
);

// Scheduling

export const classes = sqliteTable('class', {
	id: id(),
	label: text('label').notNull(),
	courseId: text('course_id')
		.notNull()
		.references(() => course.id),
	tone: integer('tone').notNull().default(0)
});

export const assignedTopic = sqliteTable('assigned_topic', {
	id: id(),
	classId: text('class_id')
		.notNull()
		.references(() => classes.id),
	topicId: text('topic_id')
		.notNull()
		.references(() => topic.id),
	position: integer('position').notNull()
});

export const slot = sqliteTable(
	'slot',
	{
		id: id(),
		classId: text('class_id')
			.notNull()
			.references(() => classes.id),
		week: text('week', { enum: ['A', 'B'] }).notNull(),
		day: integer('day').notNull(),
		period: integer('period').notNull(),
		holdsFrom: text('holds_from'),
		holdsTo: text('holds_to')
	},
	(table) => [
		check('slot_day_range', sql`${table.day} between 1 and 5`),
		check('slot_period_range', sql`${table.period} between 1 and 6`)
	]
);

export const session = sqliteTable(
	'session',
	{
		id: id(),
		classId: text('class_id')
			.notNull()
			.references(() => classes.id),
		date: text('date').notNull(),
		period: integer('period').notNull(),
		lessonId: text('lesson_id').references(() => lesson.id),
		note: text('note')
	},
	(table) => [unique('session_occasion').on(table.classId, table.date, table.period)]
);

export const continuation = sqliteTable('continuation', {
	id: id(),
	sessionId: text('session_id')
		.notNull()
		.references(() => session.id)
});

// Calendar

export const term = sqliteTable('term', {
	id: id(),
	opens: text('opens').notNull(),
	closes: text('closes').notNull()
});

export const blockedDay = sqliteTable('blocked_day', {
	id: id(),
	date: text('date').notNull(),
	note: text('note')
});

export const apiKey = sqliteTable('api_key', {
	id: id(),
	token: text('token').notNull().unique(),
	createdAt: integer('created_at')
		.notNull()
		.$defaultFn(() => Date.now()),
	lastUsedAt: integer('last_used_at')
});

export const blockedSlot = sqliteTable('blocked_slot', {
	id: id(),
	classId: text('class_id')
		.notNull()
		.references(() => classes.id),
	date: text('date').notNull(),
	slotId: text('slot_id')
		.notNull()
		.references(() => slot.id),
	note: text('note').notNull()
});

export * from './auth.schema.ts';
