import { describe, expect, test } from 'vitest';
import { render } from 'vitest-browser-svelte';
import MarkdownEditor from './markdown-editor.svelte';

describe('MarkdownEditor', () => {
	test('parses its markdown value into rich content, not source', async () => {
		const screen = await render(MarkdownEditor, { value: '## Aims\n\n- one', label: 'Notes' });

		const box = screen.getByRole('textbox', { name: 'Notes' });
		await expect.element(box).toBeVisible();
		await expect.element(screen.getByRole('heading', { level: 2, name: 'Aims' })).toBeVisible();
		await expect.element(screen.getByRole('listitem')).toBeVisible();
		expect(screen.container.querySelector('li')?.textContent).toBe('one');
	});
});
