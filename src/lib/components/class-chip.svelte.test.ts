import { describe, expect, test } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ClassChip from './class-chip.svelte';

describe('the Class chip', () => {
	test('opens its Class page', async () => {
		const screen = await render(ClassChip, { classId: 'class-1', label: '9B/Sc1', tone: 0 });
		await expect
			.element(screen.getByRole('link', { name: '9B/Sc1' }))
			.toHaveAttribute('href', '/classes/class-1');
	});
});
