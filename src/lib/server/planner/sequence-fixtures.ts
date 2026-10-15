import { setUp, makeLessons, makeTopic } from './fixtures';
import { assignTopic, classSchedule } from './index';
import type { Db } from './derive';
import * as schema from '../db/schema';

export const today = '2026-09-01';

// The Lessons a Class teaches, in the order they fall on its calendar.
export function taughtOrder(db: Db, classId: string, on = today) {
	const { history, scheduled } = classSchedule(db, { classId, today: on });
	return [...history, ...scheduled].map((s) => s.lessonId);
}

export function sessionRows(db: Db, classId: string) {
	return db
		.select()
		.from(schema.session)
		.all()
		.filter((s) => s.classId === classId)
		.map(({ date, period, lessonId }) => ({ date, period, lessonId }));
}

// A Class with a Sequence of `count` Lessons from one Topic, laid out from `today`.
export function withSequence(count: number) {
	const set = setUp();
	const topic = makeTopic(set.db, set.course.id, 'Forces');
	const lessons = makeLessons(set.db, topic.id, count);
	assignTopic(set.db, { classId: set.classA.id, topicId: topic.id, today });
	return { ...set, lessons, ids: lessons.map((l) => l.id) };
}
