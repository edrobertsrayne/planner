import { describe, expect, onTestFinished, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import '../../routes/layout.css';
import RenameableRow from './renameable-row.svelte';

const props = { name: 'KS3 Science', action: '?/renameCourse', hidden: { courseId: 'c1' } };

// Counts the form submissions a step caused without letting one run: the submit never reaches
// `enhance`, which needs the app's router, so nothing is sent.
function countSubmits() {
	const count = { n: 0 };
	const listener = (e: Event) => {
		count.n++;
		e.preventDefault();
		e.stopPropagation();
	};
	document.addEventListener('submit', listener, { capture: true });
	onTestFinished(() => document.removeEventListener('submit', listener, { capture: true }));
	return count;
}

// The pencil is a row control (layout.css): hidden until its row is hovered or holds focus with a
// mouse. The touch case, where it always shows, stays in the-courses-layout.e2e.ts, which can
// emulate a coarse pointer.
describe('a renameable heading', () => {
	test('the pencil is hidden until the row is hovered', async () => {
		const screen = await render(RenameableRow, props);
		const pencil = screen.getByRole('button', { name: 'Rename KS3 Science' });
		await expect.element(pencil).toHaveStyle({ opacity: '0' });

		await userEvent.hover(screen.getByRole('heading', { name: 'KS3 Science' }));
		await expect.element(pencil).toHaveStyle({ opacity: '1' });
	});

	test('the pencil shows while it holds focus', async () => {
		const screen = await render(RenameableRow, props);
		const pencil = screen.getByRole('button', { name: 'Rename KS3 Science' });
		pencil.element().focus();
		await expect.element(pencil).toHaveStyle({ opacity: '1' });
	});

	test('the pencil opens the name for editing, and Escape puts the heading back', async () => {
		const screen = await render(RenameableRow, { ...props, field: 'label' as const });
		await screen.getByRole('button', { name: 'Rename KS3 Science' }).click();
		const input = screen.getByRole('textbox');
		await expect.element(input).toHaveValue('KS3 Science');
		await expect.element(input).toHaveAttribute('name', 'label');

		await userEvent.keyboard('{Escape}');
		await expect
			.element(screen.getByRole('heading', { level: 1, name: 'KS3 Science' }))
			.toBeVisible();
	});

	test('a changed name saves on blur, without Enter', async () => {
		const screen = await render(RenameableRow, props);
		await screen.getByRole('button', { name: 'Rename KS3 Science' }).click();
		const input = screen.getByRole('textbox');
		const submits = countSubmits();

		await input.fill('KS3 Physics');
		input.element().blur();

		expect(submits.n).toBe(1);
	});

	test('blur with the name unchanged closes the field and saves nothing', async () => {
		const screen = await render(RenameableRow, props);
		await screen.getByRole('button', { name: 'Rename KS3 Science' }).click();
		const submits = countSubmits();

		screen.getByRole('textbox').element().blur();

		expect(submits.n).toBe(0);
		await expect
			.element(screen.getByRole('heading', { level: 1, name: 'KS3 Science' }))
			.toBeVisible();
	});

	test('Escape abandons a typed name, even though closing the field takes the focus', async () => {
		const screen = await render(RenameableRow, props);
		await screen.getByRole('button', { name: 'Rename KS3 Science' }).click();
		const submits = countSubmits();

		await screen.getByRole('textbox').fill('KS3 Physics');
		await userEvent.keyboard('{Escape}');

		expect(submits.n).toBe(0);
		await expect
			.element(screen.getByRole('heading', { level: 1, name: 'KS3 Science' }))
			.toBeVisible();
	});

	test('a read-only heading has no pencil', async () => {
		const screen = await render(RenameableRow, { ...props, editable: false, level: 2 as const });
		await expect
			.element(screen.getByRole('heading', { level: 2, name: 'KS3 Science' }))
			.toBeVisible();
		expect(screen.getByRole('button').query()).toBeNull();
	});
});
