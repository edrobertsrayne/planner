import { describe, expect, onTestFinished, test } from 'vitest';
import { render } from 'vitest-browser-svelte';
import '../../routes/layout.css';
import BlockSlotDialog from './block-slot-dialog.svelte';

const pick = {
	classId: 'c1',
	classLabel: '9B/Sc1',
	slotIds: ['s1'],
	period: 3,
	date: '2026-11-03'
};

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

describe('the block-Slot dialog', () => {
	test('names the Class and Period, and posts the Slot it was opened on', async () => {
		const screen = await render(BlockSlotDialog, { pick });
		await expect.element(screen.getByRole('dialog', { name: 'Block 9B/Sc1, P3' })).toBeVisible();

		const hidden = [
			...document.querySelectorAll<HTMLInputElement>('[role=dialog] form input[type=hidden]')
		].map((i) => [i.name, i.value]);
		expect(hidden).toEqual([
			['classId', 'c1'],
			['date', '2026-11-03'],
			['slotId', 's1']
		]);
		expect(document.querySelector('[role=dialog] form')?.getAttribute('action')).toBe(
			'?/blockSlot'
		);
	});

	test('will not submit without a note, and submits with one', async () => {
		const screen = await render(BlockSlotDialog, { pick });
		const submits = countSubmits();

		await screen.getByRole('button', { name: 'Block', exact: true }).click();
		expect(submits.n).toBe(0);

		await screen.getByRole('textbox', { name: 'Block 9B/Sc1, P3' }).fill('Year 9 trip');
		await screen.getByRole('button', { name: 'Block', exact: true }).click();
		expect(submits.n).toBe(1);
	});

	test('says a Lesson moves on when the Slot holds one, and that nothing moves when it does not', async () => {
		const held = await render(BlockSlotDialog, { pick: { ...pick, lessonTitle: 'Speed' } });
		await expect
			.element(held.getByText(/“Speed” moves to this Class's next Available Slot/))
			.toBeVisible();
		await held.unmount();

		const open = await render(BlockSlotDialog, { pick: { ...pick, lessonTitle: null } });
		await expect
			.element(open.getByText('This Period has no Lesson, so nothing moves.'))
			.toBeVisible();
	});

	test('the Calendar, which names no Lesson, gets no line about one', async () => {
		const screen = await render(BlockSlotDialog, { pick });
		await expect.element(screen.getByRole('dialog')).toBeVisible();
		expect(document.body.textContent).not.toMatch(/moves to this Class|nothing moves/);
	});

	test('a double posts both its Slots and is named for both Periods', async () => {
		const screen = await render(BlockSlotDialog, {
			pick: { ...pick, slotIds: ['s1', 's2'], period: 5, periodTo: 6 }
		});
		await expect.element(screen.getByRole('dialog', { name: 'Block 9B/Sc1, P5–P6' })).toBeVisible();

		const slots = [...document.querySelectorAll<HTMLInputElement>('input[name=slotId]')].map(
			(i) => i.value
		);
		expect(slots).toEqual(['s1', 's2']);
	});

	test('is a plain block unless the teacher ticks "I\'m absent"', async () => {
		const screen = await render(BlockSlotDialog, { pick });
		const form = document.querySelector<HTMLFormElement>('[role=dialog] form')!;
		const box = screen.getByRole('checkbox', { name: /I'm absent/ });

		await expect.element(box).not.toBeChecked();
		expect(new FormData(form).has('absent')).toBe(false);
		await box.click();
		expect(new FormData(form).has('absent')).toBe(true);
	});
});
