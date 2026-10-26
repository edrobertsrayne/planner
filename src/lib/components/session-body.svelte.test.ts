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
	lesson: null,
	placement: null,
	canPlace: false,
	continuations: 0
};

// The Lesson the panel draws: the seam's whole-Lesson read, its parts at their simplest unless a
// test names them.
function lesson(
	overrides: Partial<NonNullable<SessionDetail['lesson']>> = {}
): NonNullable<SessionDetail['lesson']> {
	return {
		id: 'lesson-1',
		topicId: null,
		title: 'Forces recap',
		body: null,
		status: 'draft',
		length: 1,
		position: 0,
		topic: null,
		course: null,
		links: [],
		tags: [],
		attachments: [],
		...overrides
	};
}

describe('the Session panel', () => {
	test("lists the Lesson's Attachments read-only, each a download link with its size", async () => {
		stubSessionFetch({
			...baseDetail,
			ready: true,
			lesson: lesson({
				body: 'Recap Newton I',
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
			})
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

	test('renders the Lesson body as markdown, not source', async () => {
		stubSessionFetch({
			...baseDetail,
			ready: true,
			lesson: lesson({ body: '## Aims\n\n- Recap **Newton I**' })
		});

		const screen = await render(SessionBody, { occasion });

		await expect.element(screen.getByRole('heading', { level: 2, name: 'Aims' })).toBeVisible();
		await expect.element(screen.getByRole('listitem')).toBeVisible();
		expect(screen.container.querySelector('.markdown li')?.textContent).toBe('Recap Newton I');
		expect(screen.container.querySelector('.markdown strong')?.textContent).toBe('Newton I');
	});

	test('an Open Slot open to Placing shows the Place-a-Lesson card', async () => {
		stubSessionFetch({ ...baseDetail, canPlace: true });

		const screen = await render(SessionBody, { occasion });

		await expect.element(screen.getByText('Place a Lesson')).toBeVisible();
		await expect.element(screen.getByRole('textbox', { name: 'Lesson title' })).toBeVisible();
	});

	test('an Open Slot not open to Placing shows no Place-a-Lesson card', async () => {
		stubSessionFetch({ ...baseDetail, canPlace: false });

		const screen = await render(SessionBody, { occasion });

		await expect.element(screen.getByText('Open Slot')).toBeVisible();
		await expect.element(screen.getByText('Place a Lesson')).not.toBeInTheDocument();
	});

	// The mid-Topic throw-in (issue #256): the card shows over a Topic Lesson too, and says what
	// Placing there moves.
	test('an occasion holding a Topic Lesson shows the Place-a-Lesson card and what it moves', async () => {
		stubSessionFetch({
			...baseDetail,
			canPlace: true,
			ready: false,
			lesson: lesson()
		});

		const screen = await render(SessionBody, { occasion });

		await expect.element(screen.getByText('Place a Lesson')).toBeVisible();
		await expect.element(screen.getByRole('textbox', { name: 'Lesson title' })).toBeVisible();
		await expect
			.element(screen.getByText(/Forces recap and every Lesson after it move/))
			.toBeVisible();
	});

	test('a placed Lesson shows "Standalone Lesson · Placed" and a Remove-placement button', async () => {
		stubSessionFetch({
			...baseDetail,
			placement: { id: 'placement-1' },
			lesson: lesson({ title: 'Assembly' })
		});

		const screen = await render(SessionBody, { occasion });

		await expect.element(screen.getByText('Standalone Lesson · Placed')).toBeVisible();
		await expect.element(screen.getByRole('button', { name: 'Remove placement' })).toBeVisible();
	});

	test('a placed Lesson shows its title and plan read-only, with no field to write them', async () => {
		stubSessionFetch({
			...baseDetail,
			placement: { id: 'placement-1' },
			lesson: lesson({ title: 'Assembly', body: 'Hand out the **slides**.' })
		});

		const screen = await render(SessionBody, { occasion });

		await expect.element(screen.getByRole('heading', { name: 'Assembly' })).toBeVisible();
		await expect.element(screen.getByText('slides')).toBeVisible();
		await expect
			.element(screen.getByRole('textbox', { name: 'Lesson title' }))
			.not.toBeInTheDocument();
		await expect.element(screen.getByRole('radio', { name: 'Planned' })).not.toBeInTheDocument();
	});

	test('the Place button stays disabled for a blank or whitespace-only title', async () => {
		stubSessionFetch({ ...baseDetail, canPlace: true });

		const screen = await render(SessionBody, { occasion });
		const input = screen.getByRole('textbox', { name: 'Lesson title' });
		const button = screen.getByRole('button', { name: 'Place' });

		await expect.element(button).toBeDisabled();
		await input.fill('   ');
		await expect.element(button).toBeDisabled();
		await input.fill('Assembly');
		await expect.element(button).not.toBeDisabled();
	});

	test('an occasion that names no Session says so', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response('', { status: 404 }))
		);
		const screen = await render(SessionBody, { occasion });
		await expect.element(screen.getByText('No such Session.')).toBeVisible();
	});

	test('a load that failed says so, not that the Session is missing', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response('', { status: 500 }))
		);
		const screen = await render(SessionBody, { occasion });
		await expect.element(screen.getByText("Couldn't load this Session.")).toBeVisible();
		await expect.element(screen.getByText('No such Session.')).not.toBeInTheDocument();
	});

	test('a failed Place surfaces the error and leaves the card usable again', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ ...baseDetail, canPlace: true }), { status: 200 })
			)
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ message: 'That Slot is no longer Available.' }), {
					status: 400
				})
			);
		vi.stubGlobal('fetch', fetchMock);

		const screen = await render(SessionBody, { occasion });
		await screen.getByRole('textbox', { name: 'Lesson title' }).fill('Assembly');
		await screen.getByRole('button', { name: 'Place' }).click();

		await expect.element(screen.getByText('That Slot is no longer Available.')).toBeVisible();
		await expect.element(screen.getByRole('button', { name: 'Place' })).not.toBeDisabled();
	});

	test('a failed Remove-placement surfaces the error and leaves the button usable again', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						...baseDetail,
						placement: { id: 'placement-1' },
						lesson: lesson({ title: 'Assembly' })
					}),
					{ status: 200 }
				)
			)
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ message: 'No such Placement.' }), { status: 404 })
			);
		vi.stubGlobal('fetch', fetchMock);

		const screen = await render(SessionBody, { occasion });
		await screen.getByRole('button', { name: 'Remove placement' }).click();

		await expect.element(screen.getByText('No such Placement.')).toBeVisible();
		await expect
			.element(screen.getByRole('button', { name: 'Remove placement' }))
			.not.toBeDisabled();
	});

	// The editor seeds its text once, on mount, so the panel remounts it when the occasion's
	// Lesson changes. Placing a Lesson over a Topic Lesson must show the placed Lesson's own
	// note — here none — never the text of the Lesson it replaced, which the next keystroke
	// would otherwise save under the wrong Lesson (issue #409).
	test('a Place that changes the Lesson shows the new Lesson its own note', async () => {
		const topicLesson = lesson({
			title: 'Motion',
			topic: { id: 'topic-1', name: 'Forces', courseId: 'course-1' },
			course: { id: 'course-1', name: 'KS3 Science' }
		});
		const placed = { ...topicLesson, id: 'lesson-2', title: 'Assembly', topic: null, course: null };
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						...baseDetail,
						canPlace: true,
						note: 'Ratio tables went well',
						lesson: topicLesson
					}),
					{ status: 200 }
				)
			)
			.mockResolvedValue(
				new Response(
					JSON.stringify({ ...baseDetail, placement: { id: 'placement-1' }, lesson: placed }),
					{ status: 200 }
				)
			);
		vi.stubGlobal('fetch', fetchMock);

		const screen = await render(SessionBody, { occasion });
		// The editor's own content, read straight off the DOM: the note is markdown, so its text
		// is what the teacher sees in the box, not the payload's string.
		const noteText = () =>
			screen.container.querySelector('[aria-label="How it went"]')?.textContent?.trim();
		await vi.waitFor(() => expect(noteText()).toBe('Ratio tables went well'));

		await screen.getByRole('textbox', { name: 'Lesson title' }).fill('Assembly');
		await screen.getByRole('button', { name: 'Place' }).click();

		await expect.element(screen.getByRole('heading', { name: 'Assembly' })).toBeVisible();
		await vi.waitFor(() => expect(noteText()).toBe(''));
	});
});
