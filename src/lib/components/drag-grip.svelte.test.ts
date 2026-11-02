import { describe, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import DragGrip from './drag-grip.svelte';

describe('the drag grip', () => {
	test('is named for its row and starts a drag on a pointer press', async () => {
		const onstart = vi.fn();
		const screen = await render(DragGrip, { label: 'Speed', onstart });
		const grip = screen.getByRole('button', { name: 'Drag Speed' });
		await expect.element(grip).toHaveClass('touch-none');

		grip.element().dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
		expect(onstart).toHaveBeenCalledOnce();
	});

	test('with onmove, the up and down arrow keys move the row one place', async () => {
		const onmove = vi.fn();
		const screen = await render(DragGrip, { label: 'Speed', onstart: vi.fn(), onmove });
		const grip = screen.getByRole('button', { name: 'Drag Speed' });
		await expect.element(grip).toHaveAttribute('aria-keyshortcuts', 'ArrowUp ArrowDown');

		const key = (key: string) =>
			grip.element().dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
		key('ArrowUp');
		key('ArrowDown');
		key('Enter');
		expect(onmove.mock.calls).toEqual([['up'], ['down']]);
	});
});
