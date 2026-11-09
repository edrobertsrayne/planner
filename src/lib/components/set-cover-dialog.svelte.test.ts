import { describe, expect, test } from 'vitest';
import { render } from 'vitest-browser-svelte';
import '../../routes/layout.css';
import SetCoverDialog from './set-cover-dialog.svelte';

const pick = {
	classId: 'c1',
	classLabel: '10C/Ph2',
	date: '2026-09-14',
	slotId: 's1',
	period: 1
};
const choices = [
	{ id: 'l1', title: 'Silent reading task' },
	{ id: 'l2', title: 'Forces recap worksheet' }
];

const formOf = () => document.querySelector<HTMLFormElement>('dialog form')!;

describe('the Set cover dialog', () => {
	test('names the Class and Period, and posts the Slot to setCover', async () => {
		const screen = await render(SetCoverDialog, { pick, choices });
		await expect
			.element(screen.getByRole('dialog', { name: 'Cover for 10C/Ph2, P1' }))
			.toBeVisible();

		expect(formOf().getAttribute('action')).toBe('?/setCover');
		expect([...new FormData(formOf())].filter(([k]) => k !== 'title')).toEqual([
			['classId', 'c1'],
			['date', '2026-09-14'],
			['slotId', 's1']
		]);
	});

	test('starts as a new Lesson titled for the Class, and posts no existing Lesson', async () => {
		await render(SetCoverDialog, { pick, choices });

		const data = new FormData(formOf());
		expect(data.get('title')).toBe('Cover: 10C/Ph2');
		expect(data.has('lessonId')).toBe(false);
	});

	test('can choose an existing Lesson instead, and then posts it and no title', async () => {
		const screen = await render(SetCoverDialog, { pick, choices });

		await screen.getByRole('button', { name: 'Existing Lesson' }).click();
		await screen.getByRole('radio', { name: 'Silent reading task' }).click();

		const data = new FormData(formOf());
		expect(data.get('lessonId')).toBe('l1');
		expect(data.has('title')).toBe(false);
	});

	test('says so when there is no Standalone Lesson to choose', async () => {
		const screen = await render(SetCoverDialog, { pick, choices: [] });

		await screen.getByRole('button', { name: 'Existing Lesson' }).click();
		await expect.element(screen.getByText(/No Standalone Lessons yet/)).toBeVisible();
	});
});
