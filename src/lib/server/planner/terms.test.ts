import { describe, expect, test } from 'vitest';
import { eq, lt } from 'drizzle-orm';
import { failingCommit, makeLessons, makeTopic, refused, setUp, TERMS } from './fixtures';
import {
	assignTopic,
	classSchedule,
	editLesson,
	replaceTerms,
	sessionDetail,
	teachingWeeks,
	writeTeachingNote
} from './index';
import { teachingNoteOf } from './teaching-notes';
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
		const { db } = setUp();

		const result = replaceTerms(db, { terms: NEW_TERMS, today: '2026-09-03' });

		expect(result).toEqual({ placementsMoved: [] });

		// Autumn 1 opening a week earlier adds one Teaching Week before it, so that week and
		// every week after it re-letter: w/c 31 August becomes Week B.
		expect(teachingWeeks(db).find((w) => w.weekCommencing === '2026-08-31')?.letter).toBe('B');
	});

	test('refuses a set that is not exactly six Terms, leaving the old six in place', () => {
		const { db } = setUp();

		refused(
			() => replaceTerms(db, { terms: TERMS.slice(1), today: '2026-09-03' }),
			'invalid',
			'A year needs exactly six Terms, and 5 were given.'
		);

		refused(
			() =>
				replaceTerms(db, {
					terms: [...TERMS, { opens: '2027-07-20', closes: '2027-07-30' }],
					today: '2026-09-03'
				}),
			'invalid',
			'A year needs exactly six Terms, and 7 were given.'
		);

		// Still the old year: w/c 7 September is the second Teaching Week, Week B — the new
		// dates would have re-lettered it to Week A.
		expect(teachingWeeks(db).find((w) => w.weekCommencing === '2026-09-07')?.letter).toBe('B');
	});

	test('refuses a malformed or unreal date', () => {
		const { db } = setUp();

		const unreal = NEW_TERMS.map((t, i) =>
			i === 1 ? { opens: '2026-02-30', closes: t.closes } : t
		);
		refused(
			() => replaceTerms(db, { terms: unreal, today: '2026-09-03' }),
			'invalid',
			'"2026-02-30" is not a real date.'
		);

		const malformed = NEW_TERMS.map((t, i) => (i === 3 ? { ...t, closes: '3 September' } : t));
		refused(
			() => replaceTerms(db, { terms: malformed, today: '2026-09-03' }),
			'invalid',
			'"3 September" is not a real date.'
		);
	});

	test('refuses a Term that opens after it closes', () => {
		const { db } = setUp();

		const backwards = NEW_TERMS.map((t, i) =>
			i === 0 ? { opens: '2027-07-19', closes: '2027-06-07' } : t
		);
		refused(
			() => replaceTerms(db, { terms: backwards, today: '2026-09-03' }),
			'invalid',
			'A Term cannot open after it closes: opens 2027-07-19, closes 2027-06-07.'
		);
	});

	test('refuses Terms that overlap or touch, once sorted by opening date', () => {
		const { db } = setUp();

		// Summer 1 overruns into Summer 2.
		const overlapping = NEW_TERMS.map((t, i) => (i === 4 ? { ...t, closes: '2027-06-10' } : t));
		refused(
			() => replaceTerms(db, { terms: overlapping, today: '2026-09-03' }),
			'invalid',
			'Terms cannot overlap or touch: one closes 2027-06-10, the next opens 2027-06-07.'
		);

		// Spring 1 ends the day Spring 2 opens — no break between them, so they are one Term.
		const abutting = NEW_TERMS.map((t, i) => (i === 5 ? { ...t, closes: '2027-02-22' } : t));
		refused(
			() => replaceTerms(db, { terms: abutting, today: '2026-09-03' }),
			'invalid',
			'Terms cannot overlap or touch: one closes 2027-02-22, the next opens 2027-02-22.'
		);
	});

	test('does not police gap length or a Term boundary on a weekend', () => {
		const { db } = setUp();

		const relaxed = NEW_TERMS.map((t, i) => {
			if (i === 3) return { opens: '2026-10-31', closes: t.closes }; // a Saturday
			if (i === 0) return { opens: '2027-06-28', closes: t.closes }; // a month-long break
			return t;
		});

		const report = replaceTerms(db, { terms: relaxed, today: '2026-09-03' });
		expect(report).toEqual({ placementsMoved: [] });
	});

	test('a failure part-way throws, leaving the old six in place', () => {
		const { db } = setUp();

		// A COMMIT that never lands — the crash the transaction exists for. The delete, the six
		// inserts and the re-derivation have all run inside it by then; only the rollback
		// brings the old six back. The fault is not a refusal, so it propagates: the door
		// answers the 500 it is.
		expect(() =>
			replaceTerms(failingCommit(db), { terms: NEW_TERMS, today: '2026-09-03' })
		).toThrow('COMMIT failed');
		expect(teachingWeeks(db).find((w) => w.weekCommencing === '2026-09-07')?.letter).toBe('B');
	});

	test('rewinds from the earliest Term opening across the old and the new sets, keeping the Teaching note with its Lesson', () => {
		const { db, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		const [lesson] = makeLessons(db, topic.id, 1);
		assignTopic(db, { classId: classA.id, topicId: topic.id, today: '2026-09-03' });
		writeTeachingNote(db, {
			classId: classA.id,
			lessonId: lesson.id,
			date: '2026-09-03',
			period: 5,
			note: 'went badly — redo the practical'
		});

		// Two weeks later, the school moves Autumn 1's opening a week earlier. The Rewind
		// reaches back past today to the earliest opening across the old and the new sets. The
		// Lesson may change date, and its note goes with it.
		const result = replaceTerms(db, { terms: NEW_TERMS, today: '2026-09-14' });

		expect(result).toEqual({ placementsMoved: [] });
		expect(teachingNoteOf(db, classA.id, lesson.id)).toBe('went badly — redo the practical');
		const { history, scheduled } = classSchedule(db, { classId: classA.id, today: '2026-09-14' });
		const taught = [...history, ...scheduled].find((s) => s.lessonId === lesson.id)!;
		const detail = sessionDetail(db, {
			classId: classA.id,
			date: taught.date,
			period: taught.period,
			today: '2026-09-14'
		});
		expect(detail?.note).toBe('went badly — redo the practical');
	});

	test('saving the same six again re-derives nothing', () => {
		const { db, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		const [first] = makeLessons(db, topic.id, 4);
		assignTopic(db, { classId: classA.id, topicId: topic.id, today: '2026-09-03' });

		// Shorten a Lesson after it was taught. The record from September now disagrees with a
		// fresh derivation, so a whole-year Rewind would rewrite what was taught; a save that
		// changes no Term must leave it alone (ADR-0007).
		const taught = db
			.select()
			.from(schema.session)
			.where(eq(schema.session.classId, classA.id))
			.all();
		expect(taught.length).toBeGreaterThan(0);
		editLesson(db, { id: first.id, change: { length: 2 }, today: '2026-10-01' });
		const before = db
			.select()
			.from(schema.session)
			.where(eq(schema.session.classId, classA.id))
			.all();

		const report = replaceTerms(db, { terms: TERMS, today: '2026-10-01' });

		expect(report).toEqual({ placementsMoved: [] });
		expect(
			db.select().from(schema.session).where(eq(schema.session.classId, classA.id)).all()
		).toEqual(before);
	});

	test('a change to only Summer 2 leaves every Session before it untouched', () => {
		const { db, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		const [first] = makeLessons(db, topic.id, 20);
		assignTopic(db, { classId: classA.id, topicId: topic.id, today: '2026-09-03' });
		// As above: the taught September record now disagrees with a fresh derivation, so only a
		// Rewind that reaches back to September could rewrite it.
		editLesson(db, { id: first.id, change: { length: 2 }, today: '2026-10-01' });

		const before = db
			.select()
			.from(schema.session)
			.where(lt(schema.session.date, '2027-06-07'))
			.all();
		expect(before.length).toBeGreaterThan(0);

		// Summer 2 closes a week earlier. Letters are assigned forward from the first Term, so no
		// week before Summer 2 can change, and nothing taught before it may be rewritten.
		const summer2 = TERMS.map((term, i) => (i === 5 ? { ...term, closes: '2027-07-12' } : term));
		const report = replaceTerms(db, { terms: summer2, today: '2026-10-01' });

		expect(report).toEqual({ placementsMoved: [] });
		expect(
			db.select().from(schema.session).where(lt(schema.session.date, '2027-06-07')).all()
		).toEqual(before);
	});

	test('answers with the placementsMoved report only', () => {
		const { db, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		makeLessons(db, topic.id, 1);
		assignTopic(db, { classId: classA.id, topicId: topic.id, today: '2026-09-03' });

		const result = replaceTerms(db, { terms: TERMS, today: '2026-09-14' });

		expect(result).toEqual({ placementsMoved: [] });
	});

	test('a Blocked Day stranded outside every Term is not an error and is not reported', () => {
		const { db } = setUp();

		// The suite blocks 26–27 November (INSET). Autumn 2 closing the day before strands both.
		const shrunken = NEW_TERMS.map((t, i) => (i === 3 ? { ...t, closes: '2026-11-25' } : t));
		const result = replaceTerms(db, { terms: shrunken, today: '2026-09-03' });

		expect(result).toEqual({ placementsMoved: [] });
		expect(
			db
				.select()
				.from(schema.blockedDay)
				.all()
				.map((d) => d.date)
		).toEqual(['2026-11-26', '2026-11-27']);
	});
});
