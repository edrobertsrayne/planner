/**
 * Direct-DB fixtures for the e2e suite (issue #97), in the same spirit as the app's own write
 * paths: the Class page's "Last taught" only ever shows a Session dated before today, and the
 * app has no way to create one except letting real time pass. This writes that one row straight
 * into the database instead, against the suite's own scratch database:
 *
 *   DATABASE_URL=e2e.db node scripts/e2e-fixtures.ts find-lesson-id <title>
 *   DATABASE_URL=e2e.db node scripts/e2e-fixtures.ts mark-taught <classId> <date> <period> <lessonId>
 *   DATABASE_URL=e2e.db node scripts/e2e-fixtures.ts set-terms '<terms JSON>'
 *   DATABASE_URL=e2e.db node scripts/e2e-fixtures.ts assign-topic <classLabel> <topicId>
 *   DATABASE_URL=e2e.db node scripts/e2e-fixtures.ts create-class <label> <courseId>
 */
import { DatabaseSync } from 'node:sqlite';
import { drizzle } from 'drizzle-orm/node-sqlite';
import { eq } from 'drizzle-orm';
import * as schema from '../src/lib/server/db/schema.ts';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is not set');

const [command, ...args] = process.argv.slice(2);

const client = new DatabaseSync(databaseUrl);
client.exec('PRAGMA foreign_keys = ON');
client.exec('PRAGMA journal_mode = WAL');
client.exec('PRAGMA busy_timeout = 5000');
const db = drizzle({ client });

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
		const [classId, date, periodRaw, lessonId] = args;
		if (!classId || !date || !periodRaw || !lessonId) {
			throw new Error('Usage: mark-taught <classId> <date> <period> <lessonId>');
		}
		db.insert(schema.session)
			.values({ classId, date, period: Number(periodRaw), lessonId })
			.run();
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
	default:
		throw new Error(`Unknown command: ${command}`);
}
