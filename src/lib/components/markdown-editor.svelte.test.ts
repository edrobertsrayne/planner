import { describe, expect, test, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
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

describe('MarkdownEditor maths', () => {
	test('renders inline maths from stored text', async () => {
		const screen = await render(MarkdownEditor, { value: 'Speed $v = u + at$', label: 'Notes' });
		await vi.waitFor(() =>
			expect(screen.container.querySelector('[data-type="inline-math"] .katex')).not.toBeNull()
		);
	});

	test('renders block maths from stored text', async () => {
		const screen = await render(MarkdownEditor, { value: '$$\nF = ma\n$$', label: 'Notes' });
		await vi.waitFor(() =>
			expect(
				screen.container.querySelector('[data-type="block-math"] .katex-display')
			).not.toBeNull()
		);
	});

	test('escapes typed dollars so they reload as text', async () => {
		const onchange = vi.fn();
		const screen = await render(MarkdownEditor, { value: '', label: 'Notes', onchange });
		const box = screen.getByRole('textbox', { name: 'Notes' });
		await userEvent.click(box);
		await userEvent.type(box, '$5 and $10');
		await vi.waitFor(() => expect(onchange.mock.calls.at(-1)?.[0]).toBe('\\$5 and \\$10'));
	});
});

describe('MarkdownEditor formula prompts', () => {
	test('inserts a formula from the toolbar, then deletes it on an empty answer', async () => {
		const prompt = vi.spyOn(window, 'prompt').mockReturnValue('F = ma');
		const onchange = vi.fn();
		const screen = await render(MarkdownEditor, { value: '', label: 'Notes', onchange });
		await userEvent.click(screen.getByRole('textbox', { name: 'Notes' }));
		await screen.getByRole('button', { name: 'Formula', exact: true }).click();
		await vi.waitFor(() => expect(onchange.mock.calls.at(-1)?.[0]).toBe('$F = ma$'));

		prompt.mockReturnValue('');
		const node = await vi.waitFor(() => {
			const n = screen.container.querySelector<HTMLElement>('[data-type="inline-math"] .katex');
			expect(n).not.toBeNull();
			return n as HTMLElement;
		});
		node.click();
		await vi.waitFor(() =>
			expect(screen.container.querySelector('[data-type="inline-math"]')).toBeNull()
		);
		prompt.mockRestore();
	});
});
