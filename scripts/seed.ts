/**
 * Rebuilds the calendar tables (Term, Blocked Day, Teaching Week) from a seed file and prints the
 * generated Teaching Week table for Ed to check by eye against the school's published calendar.
 * Runs under bun, from the repo root so DATABASE_URL resolves:
 *
 *   DATABASE_URL=local.db bun scripts/seed.ts seed/2026-27.json
 *
 * Applies any pending migrations first (openDatabase/runMigrations, same as the app itself), so
 * this also works against a brand-new, empty database file — needed for running it before the app
 * has ever started, e.g. from a container entrypoint or a systemd ExecStartPre.
 * migrationsFolder defaults to 'drizzle' relative to cwd, so run this from wherever drizzle/ lives.
 *
 * Destructive: rebuilds the calendar tables from scratch every run, and refuses to run once any
 * Session exists — there is no --force. Use `bun db:studio` to inspect or fix the database by hand.
 */
import { readFileSync } from 'node:fs';
import * as schema from '../src/lib/server/db/schema.ts';
import { openDatabase, runMigrations } from '../src/lib/server/db/index.ts';
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

const { client, db } = openDatabase(databaseUrl);
runMigrations(client);

const existingSession = client.prepare('SELECT id FROM session LIMIT 1').get();
if (existingSession) {
	console.error('A Session already exists; refusing to rebuild the calendar. There is no --force.');
	console.error('Use `bun db:studio` to inspect or fix the database by hand.');
	process.exit(1);
}

const generatedWeeks = generateTeachingWeeks(terms, blockedDays);

client.run('BEGIN');
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

	client.run('COMMIT');
} catch (cause) {
	client.run('ROLLBACK');
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
