import type { Database } from 'bun:sqlite';
import { describe, expect, test } from 'vitest';
import { makeLessons, makeTopic, setUp, TERMS } from './fixtures';
import { assignTopic, replaceTerms, teachingWeeks, writeSessionNote } from './index';
import * as schema from '../db/schema';

describe('replacing the Terms', () => {
	// The six the suite was set up with, except Autumn 1 opening a week earlier — the same change
	// the Calendar test asserts re-letters the year. Given scrambled, the way a caller passing on
	// what the school published would send them.
	const NEW_TERMS = [
		{ opens: '2027-06-07', closes: '2027-07-19' },
		{ opens: '2026-08-27', closes: '2026-10-23' },
		{ opens: '2027-02-22', closes: '2027-03-26' },
		{ opens: '2026-11-02', closes: '2026-12-22' },
		{ opens: '2027-04-19', closes: '2027-05-28' },
		{ opens: '2027-01-05', closes: '2027-02-12' }
	];

	test('accepts the six in any order, and a Term change re-letters the year', () => {
		const { db, client } = setUp();

		const result = replaceTerms(db, client, { terms: NEW_TERMS, today: '2026-09-03' });

		if (!result.ok) throw new Error(result.reason);
		expect(result.atRisk).toEqual([]);

		// Autumn 1 opening a week earlier adds one Teaching Week before it, so that week and
		// every week after it re-letter: w/c 31 August becomes Week B.
		expect(teachingWeeks(db).find((w) => w.weekCommencing === '2026-08-31')?.letter).toBe('B');
	});

	test('refuses a set that is not exactly six Terms, leaving the old six in place', () => {
		const { db, client } = setUp();

		const five = replaceTerms(db, client, { terms: TERMS.slice(1), today: '2026-09-03' });
		expect(five).toMatchObject({
			ok: false,
			reason: 'A year needs exactly six Terms, and 5 were given.'
		});

		const seven = replaceTerms(db, client, {
			terms: [...TERMS, { opens: '2027-07-20', closes: '2027-07-30' }],
			today: '2026-09-03'
		});
		expect(seven).toMatchObject({
			ok: false,
			reason: 'A year needs exactly six Terms, and 7 were given.'
		});

		// Still the old year: w/c 7 September is the second Teaching Week, Week B — the new
		// dates would have re-lettered it to Week A.
		expect(teachingWeeks(db).find((w) => w.weekCommencing === '2026-09-07')?.letter).toBe('B');
	});

	test('refuses a malformed or unreal date', () => {
		const { db, client } = setUp();

		const unreal = NEW_TERMS.map((t, i) =>
			i === 1 ? { opens: '2026-02-30', closes: t.closes } : t
		);
		expect(replaceTerms(db, client, { terms: unreal, today: '2026-09-03' })).toMatchObject({
			ok: false,
			reason: '"2026-02-30" is not a real date.'
		});

		const malformed = NEW_TERMS.map((t, i) => (i === 3 ? { ...t, closes: '3 September' } : t));
		expect(replaceTerms(db, client, { terms: malformed, today: '2026-09-03' })).toMatchObject({
			ok: false,
			reason: '"3 September" is not a real date.'
		});
	});

	test('refuses a Term that opens after it closes', () => {
		const { db, client } = setUp();

		const backwards = NEW_TERMS.map((t, i) =>
			i === 0 ? { opens: '2027-07-19', closes: '2027-06-07' } : t
		);
		expect(replaceTerms(db, client, { terms: backwards, today: '2026-09-03' })).toMatchObject({
			ok: false,
			reason: 'A Term cannot open after it closes: opens 2027-07-19, closes 2027-06-07.'
		});
	});

	test('refuses Terms that overlap or touch, once sorted by opening date', () => {
		const { db, client } = setUp();

		// Summer 1 overruns into Summer 2.
		const overlapping = NEW_TERMS.map((t, i) => (i === 4 ? { ...t, closes: '2027-06-10' } : t));
		expect(replaceTerms(db, client, { terms: overlapping, today: '2026-09-03' })).toMatchObject({
			ok: false,
			reason: 'Terms cannot overlap or touch: one closes 2027-06-10, the next opens 2027-06-07.'
		});

		// Spring 1 ends the day Spring 2 opens — no break between them, so they are one Term.
		const abutting = NEW_TERMS.map((t, i) => (i === 5 ? { ...t, closes: '2027-02-22' } : t));
		expect(replaceTerms(db, client, { terms: abutting, today: '2026-09-03' })).toMatchObject({
			ok: false,
			reason: 'Terms cannot overlap or touch: one closes 2027-02-22, the next opens 2027-02-22.'
		});
	});

	test('does not police gap length or a Term boundary on a weekend', () => {
		const { db, client } = setUp();

		const relaxed = NEW_TERMS.map((t, i) => {
			if (i === 3) return { opens: '2026-10-31', closes: t.closes }; // a Saturday
			if (i === 0) return { opens: '2027-06-28', closes: t.closes }; // a month-long break
			return t;
		});

		const result = replaceTerms(db, client, { terms: relaxed, today: '2026-09-03' });
		expect(result).toMatchObject({ ok: true });
	});

	test('a failure part-way leaves the old six in place', () => {
		const { db, client } = setUp();

		// A COMMIT that never lands — the crash the transaction exists for. The delete, the six
		// inserts and the re-derivation have all run inside it by then; only the rollback
		// brings the old six back.
		const failing = {
			run: (sql: string) => {
				if (sql === 'COMMIT') throw new Error('COMMIT failed');
				client.run(sql);
			}
		};

		const result = replaceTerms(db, failing as unknown as Database, {
			terms: NEW_TERMS,
			today: '2026-09-03'
		});

		expect(result).toMatchObject({ ok: false, reason: 'Replacing the Terms failed.' });
		expect(teachingWeeks(db).find((w) => w.weekCommencing === '2026-09-07')?.letter).toBe('B');

		// The cause survives: the answer names why, instead of throwing it away.
		if (result.ok) throw new Error('expected failure');
		expect((result.cause as Error).message).toBe('COMMIT failed');
	});

	test('rewinds from the earliest Term opening across the old and the new sets, reporting noted Sessions put at risk', () => {
		const { db, client, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		const [lesson] = makeLessons(db, topic.id, 1);
		assignTopic(db, { classId: classA.id, topicId: topic.id, today: '2026-09-03' });
		writeSessionNote(db, {
			classId: classA.id,
			date: '2026-09-03',
			period: 5,
			note: 'went badly — redo the practical'
		});

		// Two weeks later, the school moves Autumn 1's opening a week earlier. The Rewind
		// reaches back past today to the earliest opening across the old and the new sets, so
		// the noted Session is relabelled and reported rather than silently changed.
		const result = replaceTerms(db, client, { terms: NEW_TERMS, today: '2026-09-14' });

		if (!result.ok) throw new Error(result.reason);
		expect(result.atRisk).toEqual([
			{
				classId: classA.id,
				classLabel: classA.label,
				date: '2026-09-03',
				period: 5,
				lessonTitle: lesson.title
			}
		]);
	});

	test('reports nothing at risk when no Session was put at risk', () => {
		const { db, client, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		makeLessons(db, topic.id, 1);
		assignTopic(db, { classId: classA.id, topicId: topic.id, today: '2026-09-03' });

		const result = replaceTerms(db, client, { terms: TERMS, today: '2026-09-14' });

		if (!result.ok) throw new Error(result.reason);
		expect(result.atRisk).toEqual([]);
	});

	test('a Blocked Day stranded outside every Term is not an error and is not reported', () => {
		const { db, client } = setUp();

		// The suite blocks 26–27 November (INSET). Autumn 2 closing the day before strands both.
		const shrunken = NEW_TERMS.map((t, i) => (i === 3 ? { ...t, closes: '2026-11-25' } : t));
		const result = replaceTerms(db, client, { terms: shrunken, today: '2026-09-03' });

		expect(result).toMatchObject({ ok: true, atRisk: [] });
		expect(
			db
				.select()
				.from(schema.blockedDay)
				.all()
				.map((d) => d.date)
		).toEqual(['2026-11-26', '2026-11-27']);
	});
});
