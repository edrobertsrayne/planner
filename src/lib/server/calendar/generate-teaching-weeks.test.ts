import { describe, expect, test } from 'vitest';
import { generateTeachingWeeks } from './generate-teaching-weeks';

const terms = [
	{ name: 'Autumn 1', opens: '2026-09-03', closes: '2026-10-23' },
	{ name: 'Autumn 2', opens: '2026-11-02', closes: '2026-12-22' }
];

describe('generateTeachingWeeks', () => {
	test('the year opening on Thursday 3 September 2026 makes the first Week A two days long', () => {
		const [first] = generateTeachingWeeks(terms, []);

		expect(first).toMatchObject({
			weekCommencing: '2026-08-31',
			letter: 'A',
			teachingDays: 2
		});
	});

	test('a Blocked Day removes teaching days from its week without removing the week from the cycle', () => {
		const withoutInset = generateTeachingWeeks(terms, []);
		const withInset = generateTeachingWeeks(terms, [
			{ date: '2026-11-26' },
			{ date: '2026-11-27' }
		]);

		const weekLetters = withInset.map((week) => week.letter);
		expect(weekLetters).toEqual(withoutInset.map((week) => week.letter));

		const insetWeek = withInset.find((week) => week.weekCommencing === '2026-11-23');
		expect(insetWeek).toMatchObject({ teachingDays: 3 });
	});

	test('a week falling entirely inside a break takes no turn in the cycle', () => {
		const weeks = generateTeachingWeeks(terms, []);
		const weekCommencings = weeks.map((week) => week.weekCommencing);

		expect(weekCommencings).not.toContain('2026-10-26');
		expect(weekCommencings).toContain('2026-10-19');
	});

	test('letters alternate starting from A across every generated week', () => {
		const weeks = generateTeachingWeeks(terms, []);

		for (let index = 0; index < weeks.length; index++) {
			expect(weeks[index].letter).toBe(index % 2 === 0 ? 'A' : 'B');
		}
	});
});
