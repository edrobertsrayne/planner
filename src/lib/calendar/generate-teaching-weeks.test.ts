import { describe, expect, test } from 'vitest';
import { generateTeachingWeeks } from './generate-teaching-weeks';

// The real 2026/27 Terms.
const terms = [
	{ opens: '2026-09-03', closes: '2026-10-23' },
	{ opens: '2026-11-02', closes: '2026-12-22' },
	{ opens: '2027-01-05', closes: '2027-02-12' },
	{ opens: '2027-02-22', closes: '2027-03-26' },
	{ opens: '2027-04-19', closes: '2027-05-28' },
	{ opens: '2027-06-07', closes: '2027-07-19' }
];

describe('generateTeachingWeeks', () => {
	test('the year opening on Thursday 3 September 2026 makes the first Week A two days long', () => {
		const [first] = generateTeachingWeeks([terms[0], terms[1]], []);

		expect(first).toMatchObject({
			weekCommencing: '2026-08-31',
			letter: 'A',
			teachingDays: 2
		});
	});

	test('a Blocked Day removes teaching days from its week without removing the week from the cycle', () => {
		const autumn = [terms[0], terms[1]];
		const withoutInset = generateTeachingWeeks(autumn, []);
		const withInset = generateTeachingWeeks(autumn, [
			{ date: '2026-11-26' },
			{ date: '2026-11-27' }
		]);

		const weekLetters = withInset.map((week) => week.letter);
		expect(weekLetters).toEqual(withoutInset.map((week) => week.letter));

		const insetWeek = withInset.find((week) => week.weekCommencing === '2026-11-23');
		expect(insetWeek).toMatchObject({ teachingDays: 3 });
	});

	test('a week falling entirely inside a break takes no turn in the cycle', () => {
		const weeks = generateTeachingWeeks([terms[0], terms[1]], []);
		const weekCommencings = weeks.map((week) => week.weekCommencing);

		expect(weekCommencings).not.toContain('2026-10-26');
		expect(weekCommencings).toContain('2026-10-19');
	});

	test('letters alternate starting from A across every generated week', () => {
		const weeks = generateTeachingWeeks([terms[0], terms[1]], []);

		for (let index = 0; index < weeks.length; index++) {
			expect(weeks[index].letter).toBe(index % 2 === 0 ? 'A' : 'B');
		}
	});

	test('a Term is named by its position in the year, not by anything it carries', () => {
		const weeks = generateTeachingWeeks(terms, []);

		expect(weeks.find((w) => w.weekCommencing === '2026-08-31')).toMatchObject({
			termName: 'Autumn 1'
		});
		expect(weeks.find((w) => w.weekCommencing === '2026-11-02')).toMatchObject({
			termName: 'Autumn 2'
		});
		expect(weeks.find((w) => w.weekCommencing === '2027-01-04')).toMatchObject({
			termName: 'Spring 1'
		});
		expect(weeks.find((w) => w.weekCommencing === '2027-06-07')).toMatchObject({
			termName: 'Summer 2'
		});
	});
});
