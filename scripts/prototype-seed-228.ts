/**
 * PROTOTYPE ONLY (issue #228) — wipe me.
 *
 * Fills a scratch database with a real Teaching Week — three Classes with three Tones, a Topic of
 * Lessons each, so the Calendar has an honest week to place a Standalone Lesson onto and judge
 * the two-door variants against. Lifted from the issue #233 seed.
 *
 *   DATABASE_URL=prototype-228.db bun scripts/prototype-seed-228.ts
 */
import { openDatabase, runMigrations } from '../src/lib/server/db/index.ts';
import {
	addSlot,
	assignTopic,
	createClass,
	createCourse,
	createLesson,
	createTopic,
	replaceTerms,
	setLessonStatus
} from '../src/lib/server/planner/index.ts';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is not set');

const TODAY = '2026-09-02';

const { client, db } = openDatabase(databaseUrl);
runMigrations(client);

const terms = replaceTerms(db, client, {
	today: TODAY,
	terms: [
		{ opens: '2026-09-03', closes: '2026-10-23' },
		{ opens: '2026-11-02', closes: '2026-12-22' },
		{ opens: '2027-01-05', closes: '2027-02-12' },
		{ opens: '2027-02-22', closes: '2027-03-26' },
		{ opens: '2027-04-19', closes: '2027-05-28' },
		{ opens: '2027-06-07', closes: '2027-07-19' }
	]
});
if (!terms.ok) throw new Error(terms.reason);

const science = createCourse(db, { name: 'Year 9 Science' });
const physics = createCourse(db, { name: 'Year 10 Physics' });

const forces = createTopic(db, { courseId: science.id, name: 'Forces and Motion' });
const energy = createTopic(db, { courseId: physics.id, name: 'Energy Transfers' });

const lessonsByTopic: [string, string[]][] = [
	[
		forces.id,
		['Speed, distance and time', 'Distance-time graphs', 'Balanced and unbalanced forces']
	],
	[energy.id, ['Energy stores and pathways', 'Efficiency calculations', 'Renewables debate']]
];

for (const [topicId, titles] of lessonsByTopic) {
	for (const title of titles) {
		const lesson = createLesson(db, { topicId, title, today: TODAY });
		if (lesson) setLessonStatus(db, lesson.id, 'planned');
	}
}

const nine = createClass(db, { label: '9B/Sc1', courseId: science.id });
addSlot(db, { classId: nine.id, week: 'A', day: 1, period: 3 });
addSlot(db, { classId: nine.id, week: 'A', day: 3, period: 1 });
addSlot(db, { classId: nine.id, week: 'A', day: 4, period: 5 });

const tenC = createClass(db, { label: '10C/Ph2', courseId: physics.id });
addSlot(db, { classId: tenC.id, week: 'A', day: 1, period: 1 });
addSlot(db, { classId: tenC.id, week: 'A', day: 2, period: 4 });
addSlot(db, { classId: tenC.id, week: 'A', day: 4, period: 2 });

// Only nine gets a Topic; tenC's Slots stay Open, so the Calendar has real Open Slots to place
// a Standalone Lesson onto from day one.
assignTopic(db, { classId: nine.id, topicId: forces.id, today: TODAY });

console.log('Seeded for the issue #228 Placement-doors prototype.');
