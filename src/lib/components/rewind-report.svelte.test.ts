import { describe, expect, test } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { formatDate } from '$lib/date';
import type { PlacementMoved } from '$lib/server/planner';
import RewindReport from './rewind-report.svelte';

const moved: PlacementMoved = {
	placementId: 'p1',
	classId: 'c1',
	classLabel: '9C/Sc1',
	lessonTitle: 'Forces recap',
	anchorDate: '2026-11-03',
	anchorPeriod: 3,
	date: '2026-11-10',
	period: 3
};

// A write's report: the Placements it moved, or the caller's plain `none` when it moved none.
// The flow that moves a Placement runs end to end in teaching-placement.e2e.ts; these cover the
// wording of each case.
describe('the write report', () => {
	test('no report shows nothing', async () => {
		const screen = await render(RewindReport, { report: null, none: 'No date changed.' });
		expect(screen.container.textContent?.trim()).toBe('');
	});

	test('a report with no moved Placement shows the caller’s `none`', async () => {
		const screen = await render(RewindReport, {
			report: { placementsMoved: [] },
			none: 'No date changed.'
		});
		await expect.element(screen.getByRole('status')).toHaveTextContent('No date changed.');
		expect(screen.getByRole('alert').query()).toBeNull();
	});

	test('one moved Placement names its old and new Slot', async () => {
		const screen = await render(RewindReport, {
			report: { placementsMoved: [moved] },
			none: 'No date changed.'
		});
		await expect
			.element(screen.getByText('A Placement moved because its Slot stopped being Available.'))
			.toBeVisible();
		await expect
			.element(screen.getByRole('listitem'))
			.toHaveTextContent(
				`9C/Sc1 · Forces recap — was ${formatDate('2026-11-03')} P3, now ${formatDate('2026-11-10')} P3`
			);
		expect(screen.getByRole('status').query()).toBeNull();
	});

	test('several moved Placements are counted, and a stranded one has nowhere left to go', async () => {
		const screen = await render(RewindReport, {
			report: {
				placementsMoved: [
					moved,
					{ ...moved, placementId: 'p2', lessonTitle: 'Moments', stranded: true }
				]
			}
		});
		await expect
			.element(screen.getByText('2 Placements moved because their Slots stopped being Available.'))
			.toBeVisible();
		await expect
			.element(screen.getByRole('listitem').nth(1))
			.toHaveTextContent(/Moments — was .* P3, now has nowhere left to go/);
	});
});
