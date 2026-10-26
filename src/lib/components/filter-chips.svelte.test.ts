import { beforeEach, describe, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import FilterChips from './filter-chips.svelte';

// The chips write their value to the query string. The navigation itself, and the page reading
// the value back after a reload, run end to end in teaching-flows.e2e.ts.
const { replaceQuery } = vi.hoisted(() => ({ replaceQuery: vi.fn() }));
vi.mock('$lib/client/enhance', () => ({ replaceQuery }));
vi.mock('$app/state', () => ({ page: { url: new URL('http://localhost/?horizon=28') } }));

const options = [
	{ value: 'Practical', label: 'Practical', count: 3 },
	{ value: 'Recap', label: 'Recap', count: 0 }
];

describe('the filter chips', () => {
	beforeEach(() => replaceQuery.mockClear());

	test('the All chip is on when no value is chosen, and each chip carries its count', async () => {
		const screen = await render(FilterChips, {
			param: 'tag',
			value: null,
			allLabel: 'All Lessons',
			label: 'Filter by Tag',
			options
		});
		await expect
			.element(screen.getByRole('button', { name: 'All Lessons' }))
			.toHaveAttribute('aria-pressed', 'true');
		await expect
			.element(screen.getByRole('button', { name: 'Practical 3' }))
			.toHaveAttribute('aria-pressed', 'false');
		await expect.element(screen.getByRole('button', { name: 'Recap 0' })).toBeVisible();
	});

	test('a chip that is off sets its value, keeping the other parameters', async () => {
		const screen = await render(FilterChips, {
			param: 'tag',
			value: null,
			allLabel: 'All Lessons',
			label: 'Filter by Tag',
			options
		});
		await screen.getByRole('button', { name: 'Practical 3' }).click();
		expect(replaceQuery).toHaveBeenCalledWith('/?horizon=28&tag=Practical');
	});

	test('a click on the chip that is on, or on the All chip, clears the value', async () => {
		const screen = await render(FilterChips, {
			param: 'tag',
			value: 'Practical',
			allLabel: 'All Lessons',
			label: 'Filter by Tag',
			options
		});
		await expect
			.element(screen.getByRole('button', { name: 'Practical 3' }))
			.toHaveAttribute('aria-pressed', 'true');
		await screen.getByRole('button', { name: 'Practical 3' }).click();
		await screen.getByRole('button', { name: 'All Lessons' }).click();
		expect(replaceQuery.mock.calls).toEqual([['/?horizon=28'], ['/?horizon=28']]);
	});

	test('with no options there is no row at all', async () => {
		const screen = await render(FilterChips, {
			param: 'tag',
			value: null,
			allLabel: 'All Lessons',
			label: 'Filter by Tag',
			options: []
		});
		expect(screen.getByRole('group').query()).toBeNull();
	});
});
