/**
 * Rebuilds the calendar tables (Term, Blocked Day, Teaching Week) from a seed file and prints the
 * generated Teaching Week table for Ed to check by eye against the school's published calendar.
 * Runs under plain node (not bun — bun has no node:sqlite), from the repo root so DATABASE_URL
 * resolves:
 *
 *   DATABASE_URL=local.db node scripts/seed.ts seed/2026-27.json
 *
 * Destructive: rebuilds the calendar tables from scratch every run, and refuses to run once any
 * Session exists — there is no --force. Use `bun db:studio` to inspect or fix the database by hand.
 */
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { drizzle } from 'drizzle-orm/node-sqlite';
import * as schema from '../src/lib/server/db/schema.ts';
import { seedFileSchema } from '../src/lib/server/calendar/seed-file.schema.ts';
import { generateTeachingWeeks } from '../src/lib/server/calendar/generate-teaching-weeks.ts';

const databaseUrl = process.env.DATABASE_URL;
const file = process.argv[2];

if (!databaseUrl) throw new Error('DATABASE_URL is not set');
if (!file) throw new Error('Usage: bun run seed <file>');

const raw = JSON.parse(readFileSync(file, 'utf-8'));
const parsed = seedFileSchema.safeParse(raw);
if (!parsed.success) {
	console.error(`${file} does not match the seed file shape:`);
	for (const issue of parsed.error.issues) {
		console.error(`  ${issue.path.join('.')}: ${issue.message}`);
	}
	process.exit(1);
}
const { academicYear, terms, blockedDays } = parsed.data;

const client = new DatabaseSync(databaseUrl);
client.exec('PRAGMA foreign_keys = ON');
client.exec('PRAGMA journal_mode = WAL');
client.exec('PRAGMA busy_timeout = 5000');
const db = drizzle({ client });

const existingSession = client.prepare('SELECT id FROM session LIMIT 1').get();
if (existingSession) {
	console.error('A Session already exists; refusing to rebuild the calendar. There is no --force.');
	console.error('Use `bun db:studio` to inspect or fix the database by hand.');
	process.exit(1);
}

const generatedWeeks = generateTeachingWeeks(terms, blockedDays);

client.exec('BEGIN');
try {
	db.delete(schema.teachingWeek).run();
	db.delete(schema.blockedDay).run();
	db.delete(schema.term).run();

	for (const term of terms) {
		db.insert(schema.term).values(term).run();
	}
	for (const blockedDay of blockedDays) {
		db.insert(schema.blockedDay).values(blockedDay).run();
	}
	for (const week of generatedWeeks) {
		db.insert(schema.teachingWeek)
			.values({ weekCommencing: week.weekCommencing, letter: week.letter })
			.run();
	}

	client.exec('COMMIT');
} catch (cause) {
	client.exec('ROLLBACK');
	throw new Error(`Seeding ${academicYear} failed: ${(cause as Error).message}`, { cause });
}

const letterWidth = 8;
const weekWidth = 18;
const termWidth = Math.max(4, ...terms.map((term) => term.name.length));

console.log(`${academicYear}\n`);
console.log(
	'Letter'.padEnd(letterWidth) +
		'Week commencing'.padEnd(weekWidth) +
		'Term'.padEnd(termWidth + 2) +
		'Teaching days'
);
for (const week of generatedWeeks) {
	console.log(
		week.letter.padEnd(letterWidth) +
			week.weekCommencing.padEnd(weekWidth) +
			week.termName.padEnd(termWidth + 2) +
			String(week.teachingDays)
	);
}

const totalDays = generatedWeeks.reduce((sum, week) => sum + week.teachingDays, 0);
const countA = generatedWeeks.filter((week) => week.letter === 'A').length;
const countB = generatedWeeks.filter((week) => week.letter === 'B').length;

console.log(
	`\n${generatedWeeks.length} Teaching Weeks, ${countA} A, ${countB} B, ${totalDays} teaching days`
);
