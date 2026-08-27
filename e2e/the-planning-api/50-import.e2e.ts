import { test, expect } from '@playwright/test';
import { BEARER, generateKey, openPage, type Page } from './helpers.ts';

// Covers the one Import endpoint over real HTTP (issue #159): the whole-or-nothing transaction,
// Course reuse by name, the ambiguity and collision refusals, the rejected Import that leaves
// nothing behind, and the Lesson and Link caps. Brings its own Course and Topic, so it leans on
// no other file in the directory.
test.describe.serial('the Topic import', () => {
	let page: Page;
	let token = '';

	test.beforeAll(async ({ browser }) => {
		page = await openPage(browser);
		token = await generateKey(page);
	});

	test.afterAll(async () => {
		await page.close();
	});

	test('Import creates a whole Topic, reuses a Course by name, and refuses on collision', async ({
		request
	}) => {
		const created = await request.post('/api/import', {
			headers: BEARER(token),
			data: {
				course: { name: 'API Import Course' },
				topic: {
					name: 'API Import Topic',
					lessons: [
						{
							title: 'Imported with a Link',
							body: 'Body text',
							length: 2,
							status: 'planned',
							links: [{ url: 'https://example.com/imported', label: 'Imported link' }]
						},
						{ title: 'Revision' },
						{ title: 'Revision' }
					]
				}
			}
		});
		expect(created.status()).toBe(201);
		const report = await created.json();
		expect(report.course).toEqual({ id: report.course.id, name: 'API Import Course' });
		expect(report.courseCreated).toBe(true);
		expect(report.topic).toEqual({
			id: report.topic.id,
			name: 'API Import Topic',
			courseId: report.course.id
		});
		expect(
			report.lessons.map((l: { title: string; position: number }) => [l.title, l.position])
		).toEqual([
			['Imported with a Link', 0],
			['Revision', 1],
			['Revision', 2]
		]);
		// Two Lessons may share a title, so the response carries every id.
		const lessonIds = report.lessons.map((l: { id: string }) => l.id);
		expect(new Set(lessonIds).size).toBe(3);
		expect(report.lessons[0].links).toEqual([
			{
				id: report.lessons[0].links[0].id,
				url: 'https://example.com/imported',
				label: 'Imported link',
				position: 0
			}
		]);
		expect(report.lessons[1].links).toEqual([]);

		const reused = await request.post('/api/import', {
			headers: BEARER(token),
			data: {
				course: { name: 'API Import Course' },
				topic: { name: 'API Import Topic Two', lessons: [] }
			}
		});
		expect(reused.status()).toBe(201);
		const reusedReport = await reused.json();
		expect(reusedReport.courseCreated).toBe(false);
		expect(reusedReport.course.id).toBe(report.course.id);
		expect(reusedReport.lessons).toEqual([]);

		const missingCourse = await request.post('/api/import', {
			headers: BEARER(token),
			data: {
				course: { id: 'does-not-exist' },
				topic: { name: 'Orphan', lessons: [{ title: 'Orphan lesson' }] }
			}
		});
		expect(missingCourse.status()).toBe(404);
		expect(await missingCourse.json()).toEqual({ error: 'Course not found.' });

		const both = await request.post('/api/import', {
			headers: BEARER(token),
			data: {
				course: { id: report.course.id, name: 'API Import Course' },
				topic: { name: 'Ambiguous', lessons: [] }
			}
		});
		expect(both.status()).toBe(400);

		const neither = await request.post('/api/import', {
			headers: BEARER(token),
			data: { course: {}, topic: { name: 'Ambiguous', lessons: [] } }
		});
		expect(neither.status()).toBe(400);

		const collision = await request.post('/api/import', {
			headers: BEARER(token),
			data: {
				course: { name: 'API Import Course' },
				topic: { name: 'api import topic', lessons: [] }
			}
		});
		expect(collision.status()).toBe(409);
		expect(await collision.json()).toEqual({
			error: 'The Course "API Import Course" already holds a Topic called "API Import Topic".'
		});
	});

	test('a rejected Import leaves nothing behind, and the caps are refused', async ({ request }) => {
		// The second Lesson has no title, so the whole Import is refused — no Course, no Topic,
		// and no Lesson may survive a rejected Import.
		const rejected = await request.post('/api/import', {
			headers: BEARER(token),
			data: {
				course: { name: 'API Never Course' },
				topic: { name: 'API Never Topic', lessons: [{ title: 'Good' }, {}] }
			}
		});
		expect(rejected.status()).toBe(400);
		expect(await rejected.json()).toEqual({ error: 'Every Lesson needs a title.' });

		const list = await request.get('/api/courses', { headers: BEARER(token) });
		const names = (await list.json()).map((c: { name: string }) => c.name);
		expect(names).not.toContain('API Never Course');

		const tooManyLessons = await request.post('/api/import', {
			headers: BEARER(token),
			data: {
				course: { name: 'API Import Course' },
				topic: { name: 'Too Much', lessons: Array.from({ length: 201 }, () => ({ title: 'x' })) }
			}
		});
		expect(tooManyLessons.status()).toBe(400);

		const tooManyLinks = await request.post('/api/import', {
			headers: BEARER(token),
			data: {
				course: { name: 'API Import Course' },
				topic: {
					name: 'Too Linked',
					lessons: [
						{
							title: 'Overlinked',
							links: Array.from({ length: 21 }, (_, i) => ({
								url: `https://example.com/${i}`,
								label: `Link ${i}`
							}))
						}
					]
				}
			}
		});
		expect(tooManyLinks.status()).toBe(400);
	});
});
