/**
 * PROTOTYPE, throwaway (issue #372). Run after `demo-db.ts seed`, before the server starts:
 *
 *   bun scripts/prototype-sequence-seed.ts /tmp/demo.db
 *
 * Adds three Science Topics so 9B/Sc1 holds about 40 Lessons, and gives 9C/Sc2 more Lessons than
 * the year has Slots, so some Lessons sit past the end of the year. "Atomic structure" stays
 * unassigned on 9B/Sc1, for Assign Topic.
 */
import { eq } from 'drizzle-orm';
import { openDatabase } from '../src/lib/server/db/index.ts';
import * as schema from '../src/lib/server/db/schema.ts';
import { assignTopic, createLesson, createTopic } from '../src/lib/server/planner/index.ts';
import { today } from '../src/lib/date.ts';

const path = process.argv[2];
if (!path) throw new Error('Usage: prototype-sequence-seed.ts <db>');
const { client, db } = openDatabase(path);
const now = today();

const [science] = db
	.select()
	.from(schema.course)
	.where(eq(schema.course.name, 'Year 9 Science'))
	.all();
const classId = (label: string) =>
	db.select().from(schema.classes).where(eq(schema.classes.label, label)).all()[0].id;
const topicId = (name: string) =>
	db.select().from(schema.topic).where(eq(schema.topic.name, name)).all()[0].id;

const TOPICS: Record<string, Array<string | [string, number]>> = {
	Waves: [
		'Transverse and longitudinal waves',
		'Wave speed',
		['Ripple tank practical', 2],
		'Reflection',
		'Refraction',
		'The electromagnetic spectrum',
		'Uses of EM waves',
		'Dangers of EM waves',
		'Sound waves',
		'Ultrasound',
		'Waves assessment'
	],
	Energy: [
		'Energy stores',
		'Energy transfers',
		'Kinetic energy',
		'Gravitational potential energy',
		['Specific heat capacity practical', 2],
		'Power and efficiency',
		'Insulation',
		'Renewable resources',
		'Non-renewable resources',
		'Energy assessment'
	],
	'Atomic structure': [
		'Models of the atom',
		'Protons, neutrons and electrons',
		'Isotopes',
		'Radioactive decay',
		'Half-life',
		'Atomic structure assessment'
	],
	Space: [
		'The solar system',
		'Orbits',
		'Life cycle of a star',
		'Red-shift',
		'The Big Bang',
		['Model solar system project', 2],
		'Satellites',
		'Space assessment'
	]
};

for (const [name, lessons] of Object.entries(TOPICS)) {
	const topic = createTopic(db, { courseId: science.id, name });
	for (const lesson of lessons) {
		const [title, length] = typeof lesson === 'string' ? [lesson, 1] : lesson;
		createLesson(db, { topicId: topic.id, title, length, status: 'draft', today: now });
	}
}

const b = classId('9B/Sc1');
for (const name of ['Waves', 'Energy'])
	assignTopic(db, { classId: b, topicId: topicId(name), today: now });

const c = classId('9C/Sc2');
for (const name of ['Chemical reactions', 'Waves', 'Energy', 'Atomic structure', 'Space']) {
	assignTopic(db, { classId: c, topicId: topicId(name), today: now });
}

client.close();
console.log(`Added the prototype Topics to ${path}.`);
