/**
 * PROTOTYPE ONLY (issue #232) — wipe me.
 *
 * Fills local.db with a representative fortnight so the Agenda and the Session panel have real
 * density to judge the tag-rendering variants against: three Classes with three different Tones,
 * a Topic of Lessons each, and a Ready tick on some. Mirrors the shape of
 * src/lib/server/planner/fixtures.ts, against the dev database instead of a temp one.
 *
 *   DATABASE_URL=local.db bun scripts/prototype-seed-232.ts
 */
import { openDatabase } from '../src/lib/server/db/index.ts';
import * as schema from '../src/lib/server/db/schema.ts';
import {
	addSlot,
	assignTopic,
	createClass,
	createCourse,
	createLesson,
	createTopic,
	replaceTerms,
	setLessonStatus,
	setReadiness
} from '../src/lib/server/planner/index.ts';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is not set');

const TODAY = '2026-09-02';

const { client, db } = openDatabase(databaseUrl);

// The real 2026/27 calendar, as fixtures.ts uses.
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
		[
			'Speed, distance and time',
			'Distance-time graphs',
			'Balanced and unbalanced forces',
			'Practical: measuring friction',
			'Weight and mass',
			'End-of-topic assessment'
		]
	],
	[
		energy.id,
		[
			'Energy stores and pathways',
			'Practical: specific heat capacity',
			'Efficiency calculations',
			'Power station visit briefing',
			'Renewables debate',
			'Energy assessment review'
		]
	]
];

for (const [topicId, titles] of lessonsByTopic) {
	for (const title of titles) {
		const lesson = createLesson(db, { topicId, title, today: TODAY });
		if (lesson) setLessonStatus(db, lesson.id, 'planned');
	}
}

// createClass picks the next unused Tone by itself, so three Classes give three Tones.
const nine = createClass(db, { label: '9B/Sc1', courseId: science.id });
addSlot(db, { classId: nine.id, week: 'A', day: 1, period: 3 });
addSlot(db, { classId: nine.id, week: 'A', day: 3, period: 1 });
addSlot(db, { classId: nine.id, week: 'A', day: 4, period: 5 });
addSlot(db, { classId: nine.id, week: 'A', day: 4, period: 6 });
addSlot(db, { classId: nine.id, week: 'B', day: 2, period: 2 });
addSlot(db, { classId: nine.id, week: 'B', day: 5, period: 4 });

const tenC = createClass(db, { label: '10C/Ph2', courseId: physics.id });
addSlot(db, { classId: tenC.id, week: 'A', day: 1, period: 1 });
addSlot(db, { classId: tenC.id, week: 'A', day: 2, period: 4 });
addSlot(db, { classId: tenC.id, week: 'A', day: 4, period: 2 });
addSlot(db, { classId: tenC.id, week: 'B', day: 3, period: 4 });

const tenA = createClass(db, { label: '10A/Ph1', courseId: physics.id });
addSlot(db, { classId: tenA.id, week: 'A', day: 2, period: 1 });
addSlot(db, { classId: tenA.id, week: 'A', day: 3, period: 5 });
addSlot(db, { classId: tenA.id, week: 'A', day: 5, period: 2 });

assignTopic(db, { classId: nine.id, topicId: forces.id, today: TODAY });
assignTopic(db, { classId: tenC.id, topicId: energy.id, today: TODAY });
assignTopic(db, { classId: tenA.id, topicId: energy.id, today: TODAY });

// A few Ready ticks, so the Agenda's right-hand affordance is not uniformly empty.
const planned = db.select().from(schema.lesson).all();
setReadiness(db, planned[0].id, nine.id, true);
setReadiness(db, planned[6].id, tenC.id, true);
setReadiness(db, planned[6].id, tenA.id, true);

console.log('Seeded local.db for the issue #232 prototype.');
