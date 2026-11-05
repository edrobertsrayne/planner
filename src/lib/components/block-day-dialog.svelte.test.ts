import { describe, expect, onTestFinished, test } from 'vitest';
import { render } from 'vitest-browser-svelte';
import '../../routes/layout.css';
import BlockDayDialog from './block-day-dialog.svelte';

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

describe('the block-day dialog', () => {
	test('names the day and posts its date to blockDay', async () => {
		const screen = await render(BlockDayDialog, { date: '2026-11-06', lessons: 1 });
		await expect
			.element(screen.getByRole('dialog', { name: 'Block Friday 6 November' }))
			.toBeVisible();

		const form = document.querySelector<HTMLFormElement>('[role=dialog] form')!;
		expect(form.getAttribute('action')).toBe('?/blockDay');
		expect(form.querySelector<HTMLInputElement>('input[name=date]')?.value).toBe('2026-11-06');
	});

	test('submits without a note: the note is optional', async () => {
		const screen = await render(BlockDayDialog, { date: '2026-11-06', lessons: 1 });
		const submits = countSubmits();

		await screen.getByRole('button', { name: 'Block day', exact: true }).click();
		expect(submits.n).toBe(1);
	});

	test('is a closure unless the teacher ticks "I\'m absent"', async () => {
		const screen = await render(BlockDayDialog, { date: '2026-11-06', lessons: 1 });
		countSubmits();
		const form = document.querySelector<HTMLFormElement>('[role=dialog] form')!;
		const box = screen.getByRole('checkbox', { name: /I'm absent/ });

		await expect.element(box).not.toBeChecked();
		expect(new FormData(form).has('absent')).toBe(false);
		await box.click();
		expect(new FormData(form).has('absent')).toBe(true);
	});

	test('says how many Lessons move, or that nothing does', async () => {
		const some = await render(BlockDayDialog, { date: '2026-11-06', lessons: 2 });
		await expect.element(some.getByText(/2 Lessons on this day move/)).toBeVisible();
		await some.unmount();

		const one = await render(BlockDayDialog, { date: '2026-11-06', lessons: 1 });
		await expect.element(one.getByText(/1 Lesson on this day moves/)).toBeVisible();
		await one.unmount();

		const none = await render(BlockDayDialog, { date: '2026-11-06', lessons: 0 });
		await expect.element(none.getByText(/Nothing is scheduled this day/)).toBeVisible();
	});
});
