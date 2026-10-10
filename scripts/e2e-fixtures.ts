/**
 * Direct-DB fixtures for the e2e suite (issue #97), in the same spirit as the app's own write
 * paths: the Class page's "Last taught" only ever shows a Session dated before today, and the
 * app has no way to create one except letting real time pass. This writes that one row straight
 * into the database instead, against the suite's own scratch database:
 *
 *   DATABASE_URL=e2e.db bun scripts/e2e-fixtures.ts find-lesson-id <title>
 *   DATABASE_URL=e2e.db bun scripts/e2e-fixtures.ts find-class-id <label>
 *   DATABASE_URL=e2e.db bun scripts/e2e-fixtures.ts mark-taught <classId> <date> <period> <lessonId> [note]
 *   DATABASE_URL=e2e.db bun scripts/e2e-fixtures.ts unmark-taught <classId> <date> <period>
 *   DATABASE_URL=e2e.db bun scripts/e2e-fixtures.ts reset <empty|standard> <origin>
 *   DATABASE_URL=e2e.db bun scripts/e2e-fixtures.ts add-attachment <lessonId> <filename> <mimeType> <content>
 *   DATABASE_URL=e2e.db bun scripts/e2e-fixtures.ts assign-topic <classLabel> <topicId>
 *   DATABASE_URL=e2e.db bun scripts/e2e-fixtures.ts create-class <label> <courseId>
 *   DATABASE_URL=e2e.db bun scripts/e2e-fixtures.ts delete-class <label>
 *   DATABASE_URL=e2e.db bun scripts/e2e-fixtures.ts clear-terms
 *   DATABASE_URL=e2e.db bun scripts/e2e-fixtures.ts create-standalone-lesson <title>
 *   DATABASE_URL=e2e.db bun scripts/e2e-fixtures.ts place-lesson <lessonId> <classLabel> <date>
 *   DATABASE_URL=e2e.db bun scripts/e2e-fixtures.ts unplace-lesson <lessonId>
 */
import { rmSync } from 'node:fs';
import { and, eq } from 'drizzle-orm';
import { inTransaction, openDatabase } from '../src/lib/server/db/index.ts';
import * as schema from '../src/lib/server/db/schema.ts';
import { defaultWeek, rederive, teachingWeeks } from '../src/lib/server/planner/derive.ts';
import {
	assignTopic,
	attachmentsDir,
	createAttachment,
	createClass,
	createCourse,
	createLesson,
	createTopic,
	takeSlot
} from '../src/lib/server/planner/index.ts';
import { today } from '../src/lib/date.ts';
import { EMAIL, PASSWORD, isoDate } from '../e2e/helpers.ts';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is not set');

const [command, ...args] = process.argv.slice(2);

const { client, db } = openDatabase(databaseUrl);

async function createUser(origin: string) {
	const body = new URLSearchParams({
		name: 'Test Teacher',
		email: EMAIL,
		password: PASSWORD,
		confirmPassword: PASSWORD
	});
	// SvelteKit refuses a form POST whose Origin is not its own. Asked for JSON, the action answers
	// with its result rather than a 303.
	const response = await fetch(`${origin}/setup`, {
		method: 'POST',
		body,
		headers: { origin, accept: 'application/json' }
	});
	const result = (await response.json()) as { type: string; location?: string };
	if (result.location !== '/') {
		throw new Error(`/setup answered ${response.status}: ${JSON.stringify(result)}`);
	}
}

function seedStandard() {
	const now = today();
	// A calendar spanning well before and after whatever real date the suite runs on, so no file
	// depends on the real date. Six Terms; only the second, straddling today, is load-bearing.
	// The Week letters are derived from these dates. Terms go in without a rederive.
	for (const [opens, closes] of [
		[-84, -21],
		[-14, 56],
		[70, 84],
		[98, 112],
		[126, 140],
		[154, 168]
	]) {
		db.insert(schema.term)
			.values({ opens: isoDate(opens), closes: isoDate(closes) })
			.run();
	}
	// Two Lessons, so the past Session below can consume the first and leave the second queued as
	// Next Up.
	const course = createCourse(db, { name: 'KS3 Science' });
	const forces = createTopic(db, { courseId: course.id, name: 'Forces' });
	const speed = createLesson(db, { topicId: forces.id, title: 'Speed', today: now }).lesson;
	createLesson(db, { topicId: forces.id, title: 'Motion', today: now });
	const classA = createClass(db, { label: '9B/Sc1', courseId: course.id });
	const classB = createClass(db, { label: '9C/Sc1', courseId: course.id });
	// The Week letter the Calendar opens on (the one covering today), so the Slots land on a
	// Calendar cell visible without navigating the ribbon.
	const weeks = teachingWeeks(db);
	const opening = defaultWeek(weeks, now);
	const letter = weeks.find((w) => w.weekCommencing === opening)!.letter;
	// Three periods a week, Mon, Wed and Fri P1: a realistic KS3 cadence, and enough future
	// Available Slots for the Planning test to page against. The Timetable grid posts `from` =
	// the date it shows, which is today.
	for (const day of [1, 3, 5]) {
		takeSlot(db, { classId: classA.id, week: letter, day, period: 1, from: now, today: now });
	}
	assignTopic(db, { classId: classA.id, topicId: forces.id, today: now });
	// Tuesday P3, a day 9B leaves untouched, in BOTH letters: whatever the run date, a Tuesday
	// sits within the Agenda's This Week horizon, and the week the Calendar test loads carries one.
	for (const week of ['A', 'B'] as const) {
		takeSlot(db, { classId: classB.id, week, day: 2, period: 3, from: now, today: now });
	}
	// A Session dated before today: the only way "Last taught" is ever populated. Written last so
	// no rederive sweeps it away as an orphan.
	db.insert(schema.session)
		.values({ classId: classA.id, date: isoDate(-10), period: 6, lessonId: speed.id })
		.run();
	rederive(db, classA.id, now);
}

switch (command) {
	case 'find-class-id': {
		const [label] = args;
		if (!label) throw new Error('Usage: find-class-id <label>');
		const [row] = db
			.select({ id: schema.classes.id })
			.from(schema.classes)
			.where(eq(schema.classes.label, label))
			.all();
		if (!row) throw new Error(`No Class labelled ${label}`);
		process.stdout.write(row.id);
		break;
	}
	case 'find-lesson-id': {
		const [title] = args;
		if (!title) throw new Error('Usage: find-lesson-id <title>');
		const [row] = db
			.select({ id: schema.lesson.id })
			.from(schema.lesson)
			.where(eq(schema.lesson.title, title))
			.all();
		if (!row) throw new Error(`No Lesson titled ${title}`);
		process.stdout.write(row.id);
		break;
	}
	case 'mark-taught': {
		const [classId, date, periodRaw, lessonId, note] = args;
		if (!classId || !date || !periodRaw || !lessonId) {
			throw new Error('Usage: mark-taught <classId> <date> <period> <lessonId> [note]');
		}
		db.insert(schema.session)
			.values({ classId, date, period: Number(periodRaw), lessonId, note })
			.run();
		// A taught Lesson is delivered: the queue from today relabels to match, as every
		// scheduling write in the app rederives (ADR-0007). Without this the materialized
		// Sessions ahead of today disagree with the derivation the Agenda reads.
		rederive(db, classId, today());
		break;
	}
	// Takes a past Session back out, so a later file's Term save has no noted Session to report.
	case 'unmark-taught': {
		const [classId, date, periodRaw] = args;
		if (!classId || !date || !periodRaw) {
			throw new Error('Usage: unmark-taught <classId> <date> <period>');
		}
		db.delete(schema.session)
			.where(
				and(
					eq(schema.session.classId, classId),
					eq(schema.session.date, date),
					eq(schema.session.period, Number(periodRaw))
				)
			)
			.run();
		// The delivery it carried comes back: relabel the queue, as mark-taught does.
		rederive(db, classId, today());
		break;
	}
	// An assignment the API under test cannot make: the API has no Class endpoints, and the spec
	// needs a Topic the delete route must refuse because a Class follows it.
	case 'assign-topic': {
		const [classLabel, topicId] = args;
		if (!classLabel || !topicId) throw new Error('Usage: assign-topic <classLabel> <topicId>');
		const [row] = db
			.select({ id: schema.classes.id })
			.from(schema.classes)
			.where(eq(schema.classes.label, classLabel))
			.all();
		if (!row) throw new Error(`No Class labelled ${classLabel}`);
		db.insert(schema.assignedTopic).values({ classId: row.id, topicId, position: 0 }).run();
		break;
	}
	// A Class following one Course, for the delete-Course refusal the API cannot set up either:
	// a Class is created in the browser only, and its Course is fixed at creation.
	case 'create-class': {
		const [label, courseId] = args;
		if (!label || !courseId) throw new Error('Usage: create-class <label> <courseId>');
		db.insert(schema.classes).values({ label, courseId }).run();
		break;
	}
	// Takes a fixture Class back out by label, so a test that grows the Class list to make a
	// chip row overflow leaves nothing behind. Deletes straight, without a re-derive: the
	// make-shift fixture Classes carry no Slots, so they reach no derivation.
	case 'delete-class': {
		const [label] = args;
		if (!label) throw new Error('Usage: delete-class <label>');
		db.delete(schema.classes).where(eq(schema.classes.label, label)).run();
		break;
	}
	// The planner with no year in it — the state the setup mode opens by itself on. There is no
	// way to un-set the six Terms through the app once they are saved.
	case 'clear-terms': {
		db.delete(schema.term).run();
		break;
	}
	// A Standalone Lesson with no Placement, for the Lesson editor's Standalone Lesson form. The
	// app makes one only by placing a Lesson and removing the Placement again.
	case 'create-standalone-lesson': {
		const [title] = args;
		if (!title) throw new Error('Usage: create-standalone-lesson <title>');
		const [row] = db.insert(schema.lesson).values({ title, position: 0 }).returning().all();
		process.stdout.write(row.id);
		break;
	}
	// A Placement on the Class's first Slot, written without a re-derive: only the refusal to
	// delete a placed Lesson is under test.
	case 'place-lesson': {
		const [lessonId, classLabel, date] = args;
		if (!lessonId || !classLabel || !date) {
			throw new Error('Usage: place-lesson <lessonId> <classLabel> <date>');
		}
		const [slot] = db
			.select({ id: schema.slot.id, classId: schema.slot.classId })
			.from(schema.slot)
			.innerJoin(schema.classes, eq(schema.classes.id, schema.slot.classId))
			.where(eq(schema.classes.label, classLabel))
			.all();
		if (!slot) throw new Error(`No Slot for Class ${classLabel}`);
		db.insert(schema.placement)
			.values({ classId: slot.classId, slotId: slot.id, date, lessonId })
			.run();
		break;
	}
	case 'unplace-lesson': {
		const [lessonId] = args;
		if (!lessonId) throw new Error('Usage: unplace-lesson <lessonId>');
		db.delete(schema.placement).where(eq(schema.placement.lessonId, lessonId)).run();
		break;
	}
	case 'add-attachment': {
		const [lessonId, filename, mimeType, content] = args;
		if (!lessonId || !filename || !mimeType || !content) {
			throw new Error('Usage: add-attachment <lessonId> <filename> <mimeType> <content>');
		}
		createAttachment(
			db,
			{ lessonId, filename, mimeType, bytes: new TextEncoder().encode(content) },
			attachmentsDir(databaseUrl)
		);
		break;
	}
	// Clears every table and the Attachment files, then writes one known state. `standard` takes
	// the origin of the running server, because /setup is the one path that creates the user
	// (ADR-0011).
	case 'reset': {
		const [state, origin] = args;
		if ((state !== 'empty' && state !== 'standard') || !origin) {
			throw new Error('Usage: reset <empty|standard> <origin>');
		}
		const tables = client
			.query(
				`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name != '__drizzle_migrations'`
			)
			.all() as { name: string }[];
		// The pragma is ignored inside a transaction, so it brackets one.
		client.run('PRAGMA foreign_keys = OFF');
		inTransaction(client, () => {
			for (const { name } of tables) client.run(`DELETE FROM "${name}"`);
		});
		client.run('PRAGMA foreign_keys = ON');
		// The server makes the folder again on the next upload.
		rmSync(attachmentsDir(databaseUrl), { recursive: true, force: true });
		if (state === 'standard') {
			await createUser(origin);
			seedStandard();
		}
		break;
	}
	default:
		throw new Error(`Unknown command: ${command}`);
}
