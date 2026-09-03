/**
 * PROTOTYPE ONLY (issue #233) — wipe me.
 *
 * Fills a scratch database with a real Teaching Week so the Calendar grid has honest density to
 * judge the tag-rendering variants against: three Classes with three different Tones, a Topic of
 * Lessons each, two double Lessons (a tile two Periods tall), a Blocked Day and a Blocked Slot.
 * Lifted from the issue #232 seed. Mirrors src/lib/server/planner/fixtures.ts, against a dev
 * database instead of a temp one.
 *
 *   DATABASE_URL=prototype-233.db bun scripts/prototype-seed-233.ts
 */
import { openDatabase } from '../src/lib/server/db/index.ts';
import * as schema from '../src/lib/server/db/schema.ts';
import { eq } from 'drizzle-orm';
import {
	addSlot,
	assignTopic,
	blockDay,
	blockSlot,
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
		// A double Lesson gives the grid a tile two Periods tall — the only Calendar tile with
		// vertical room to spare, so the variants can be judged at both densities.
		const length = title.startsWith('Practical') ? 2 : 1;
		const lesson = createLesson(db, { topicId, title, length, today: TODAY });
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

// A Blocked Day and a Blocked Slot inside the Week A on show (week commencing 2026-09-14, the
// first fully-in-term Week A): the hatched tiles a tag chip must not be confused with. The
// Blocked Slot names 10C/Ph2's Monday P1 Slot, so the date it removes must be that Monday.
const blockedFriday = blockDay(db, { date: '2026-09-18', note: 'Staff training', today: TODAY });
if (!blockedFriday.ok) throw new Error(blockedFriday.reason);

const [tenCMondaySlot] = db
	.select()
	.from(schema.slot)
	.where(eq(schema.slot.classId, tenC.id))
	.all();
blockSlot(db, {
	classId: tenC.id,
	date: '2026-09-14',
	slotId: tenCMondaySlot.id,
	note: 'Trip',
	today: TODAY
});

// A few Ready ticks, so the Session panel's affordance is not uniformly empty.
const planned = db.select().from(schema.lesson).all();
setReadiness(db, planned[0].id, nine.id, true);
setReadiness(db, planned[6].id, tenC.id, true);
setReadiness(db, planned[6].id, tenA.id, true);

console.log('Seeded for the issue #233 Calendar prototype.');
