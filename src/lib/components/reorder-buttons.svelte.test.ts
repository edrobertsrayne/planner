import { describe, expect, test } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ReorderButtons from './reorder-buttons.svelte';

describe('the reorder buttons', () => {
	test('each direction posts its own form, and the move off an end is disabled', async () => {
		const screen = await render(ReorderButtons, {
			action: '?/moveLesson',
			fields: { lessonId: 'l1' },
			label: 'Speed',
			first: true,
			last: false
		});
		const up = screen.getByRole('button', { name: 'Move Speed up' });
		const down = screen.getByRole('button', { name: 'Move Speed down' });
		await expect.element(up).toBeDisabled();
		await expect.element(down).toBeEnabled();

		const form = down.element().closest('form')!;
		expect(form.getAttribute('action')).toBe('?/moveLesson');
		expect(Object.fromEntries(new FormData(form))).toEqual({ lessonId: 'l1', direction: 'down' });
	});
});
