import { asc, eq } from 'drizzle-orm';
import { classSchedule } from './index';
import type { Db } from './derive';
import * as schema from '../db/schema';

export const TODAY = '2026-09-03';

// The Lessons a Class's Sequence holds, in teaching order.
export const sequenceOf = (db: Db, classId: string) =>
	db
		.select()
		.from(schema.classLesson)
		.where(eq(schema.classLesson.classId, classId))
		.orderBy(asc(schema.classLesson.position))
		.all()
		.map((row) => row.lessonId);

// Which Lesson a Class teaches on which date and Period, from TODAY.
export const datesOf = (db: Db, classId: string) =>
	classSchedule(db, { classId, today: TODAY }).scheduled.map(
		(s) => `${s.date}|${s.period}|${s.lessonId}`
	);
