import { check, integer, sqliteTable, text, unique, uniqueIndex } from 'drizzle-orm/sqlite-core';
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
	name: text('name').notNull(),
	opens: text('opens').notNull(),
	closes: text('closes').notNull()
});

export const teachingWeek = sqliteTable('teaching_week', {
	id: id(),
	weekCommencing: text('week_commencing').notNull(),
	letter: text('letter', { enum: ['A', 'B'] }).notNull()
});

export const blockedDay = sqliteTable('blocked_day', {
	id: id(),
	date: text('date').notNull(),
	note: text('note')
});

export const apiKey = sqliteTable('api_key', {
	id: id(),
	name: text('name').notNull(),
	hash: text('hash').notNull().unique(),
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
