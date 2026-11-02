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
});
