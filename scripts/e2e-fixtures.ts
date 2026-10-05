/**
 * Direct-DB fixtures for the e2e suite (issue #97), in the same spirit as the app's own write
 * paths: the Class page's "Last taught" only ever shows a Session dated before today, and the
 * app has no way to create one except letting real time pass. This writes that one row straight
 * into the database instead, against the suite's own scratch database:
 *
 *   DATABASE_URL=e2e.db bun scripts/e2e-fixtures.ts find-lesson-id <title>
 *   DATABASE_URL=e2e.db bun scripts/e2e-fixtures.ts mark-taught <classId> <date> <period> <lessonId> [note]
 *   DATABASE_URL=e2e.db bun scripts/e2e-fixtures.ts unmark-taught <classId> <date> <period>
 *   DATABASE_URL=e2e.db bun scripts/e2e-fixtures.ts set-terms '<terms JSON>'
 *   DATABASE_URL=e2e.db bun scripts/e2e-fixtures.ts assign-topic <classLabel> <topicId>
 *   DATABASE_URL=e2e.db bun scripts/e2e-fixtures.ts create-class <label> <courseId>
 *   DATABASE_URL=e2e.db bun scripts/e2e-fixtures.ts clear-terms
 *   DATABASE_URL=e2e.db bun scripts/e2e-fixtures.ts create-standalone-lesson <title>
 *   DATABASE_URL=e2e.db bun scripts/e2e-fixtures.ts place-lesson <lessonId> <classLabel> <date>
 *   DATABASE_URL=e2e.db bun scripts/e2e-fixtures.ts unplace-lesson <lessonId>
 */
import { and, eq } from 'drizzle-orm';
import { openDatabase } from '../src/lib/server/db/index.ts';
import * as schema from '../src/lib/server/db/schema.ts';
import { rederive } from '../src/lib/server/planner/derive.ts';
import { today } from '../src/lib/date.ts';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is not set');

const [command, ...args] = process.argv.slice(2);

const { db } = openDatabase(databaseUrl);

switch (command) {
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
	case 'set-terms': {
		const [termsJson] = args;
		if (!termsJson) throw new Error('Usage: set-terms <terms JSON>');
		const terms = JSON.parse(termsJson) as { opens: string; closes: string }[];
		for (const term of terms) db.insert(schema.term).values(term).run();
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
	default:
		throw new Error(`Unknown command: ${command}`);
}
