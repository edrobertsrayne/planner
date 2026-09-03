import { describe, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { SessionDetail } from '$lib/server/planner';
import SessionBody from './session-body.svelte';

// The Session panel's rendering seam (issue #243): it draws straight off the sessionDetail
// payload, so these stub the fetch it opens with rather than standing up a server.
function stubSessionFetch(detail: SessionDetail) {
	vi.stubGlobal(
		'fetch',
		vi.fn(async () => new Response(JSON.stringify(detail), { status: 200 }))
	);
}

const occasion = { classId: 'class-1', date: '2026-09-03', period: 5 };

const baseDetail: SessionDetail = {
	classId: occasion.classId,
	classLabel: '9B/Sc1',
	date: occasion.date,
	period: occasion.period,
	note: null,
	ready: null,
	lesson: null
};

describe('the Session panel', () => {
	test("lists the Lesson's Attachments read-only, each a download link with its size", async () => {
		stubSessionFetch({
			...baseDetail,
			ready: true,
			lesson: {
				title: 'Forces recap',
				topicName: 'Forces',
				body: 'Recap Newton I',
				links: [],
				attachments: [
					{
						id: 'att-1',
						lessonId: 'lesson-1',
						filename: 'worksheet.pdf',
						mimeType: 'application/pdf',
						size: 2048,
						position: 0
					},
					{
						id: 'att-2',
						lessonId: 'lesson-1',
						filename: 'slides.pdf',
						mimeType: 'application/pdf',
						size: 512,
						position: 1
					}
				]
			}
		});

		const screen = await render(SessionBody, { occasion });

		const worksheet = screen.getByRole('link', { name: 'worksheet.pdf' });
		await expect.element(worksheet).toBeVisible();
		await expect.element(worksheet).toHaveAttribute('href', '/attachments/att-1');
		await expect.element(screen.getByText('2.0 kB')).toBeVisible();

		const slides = screen.getByRole('link', { name: 'slides.pdf' });
		await expect.element(slides).toHaveAttribute('href', '/attachments/att-2');
		await expect.element(screen.getByText('512 B')).toBeVisible();

		// Download-only: no upload or delete control of its own.
		await expect.element(screen.getByRole('button', { name: /attach/i })).not.toBeInTheDocument();
		await expect.element(screen.getByRole('button', { name: /delete/i })).not.toBeInTheDocument();
	});

	test('an Open Slot — no Lesson on the Slot — shows no Attachments UI', async () => {
		stubSessionFetch({ ...baseDetail, ready: null, lesson: null });

		const screen = await render(SessionBody, { occasion });

		await expect.element(screen.getByText('Open Slot')).toBeVisible();
		await expect.element(screen.getByRole('link', { name: /\.pdf$/ })).not.toBeInTheDocument();
	});
});
