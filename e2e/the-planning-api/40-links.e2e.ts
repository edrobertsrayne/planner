import { test, expect } from '@playwright/test';
import { BEARER, apiKey, createdId, keysOf, type Page } from './helpers.ts';
import { resetTo } from '../helpers.ts';

// Covers the two Link endpoints over real HTTP (issue #159): creation at the end of the order,
// the URL and scheme refusals, PATCH, and removal. Uses a Lesson of its own.

test.beforeAll(() => resetTo('standard'));

test.describe.serial('the Link endpoints', () => {
	let page: Page;
	let token = '';

	let lessonAId = '';

	test.beforeAll(async ({ browser }) => {
		page = await browser.newPage();
		token = await apiKey(browser);

		const courseId = await createdId(page.request, token, '/api/courses', {
			name: 'API Test Course'
		});
		const topicOneId = await createdId(page.request, token, `/api/courses/${courseId}/topics`, {
			name: 'API Topic One'
		});
		lessonAId = await createdId(page.request, token, `/api/topics/${topicOneId}/lessons`, {
			title: 'API Lesson A'
		});
	});

	test.afterAll(async () => {
		await page.close();
	});

	test('Links are created at the end of the order, patched, and removed', async ({ request }) => {
		const first = await request.post(`/api/lessons/${lessonAId}/links`, {
			headers: BEARER(token),
			data: { url: 'https://example.com/forces-sim', label: 'Forces simulation' }
		});
		expect(first.status()).toBe(201);
		const linkOne = await first.json();
		expect(linkOne).toEqual({
			id: linkOne.id,
			lessonId: lessonAId,
			url: 'https://example.com/forces-sim',
			label: 'Forces simulation',
			position: 0
		});

		const second = await request.post(`/api/lessons/${lessonAId}/links`, {
			headers: BEARER(token),
			data: { url: 'https://example.com/worksheet', label: 'Worksheet' }
		});
		expect(second.status()).toBe(201);
		const linkTwo = await second.json();
		expect(linkTwo).toMatchObject({ position: 1 });

		const noUrl = await request.post(`/api/lessons/${lessonAId}/links`, {
			headers: BEARER(token),
			data: { label: 'No address' }
		});
		expect(noUrl.status()).toBe(400);

		const notUrl = await request.post(`/api/lessons/${lessonAId}/links`, {
			headers: BEARER(token),
			data: { url: 'not-a-url', label: 'Broken' }
		});
		expect(notUrl.status()).toBe(400);

		const wrongScheme = await request.post(`/api/lessons/${lessonAId}/links`, {
			headers: BEARER(token),
			data: { url: 'javascript:alert(1)', label: 'Trap' }
		});
		expect(wrongScheme.status()).toBe(400);
		expect(await wrongScheme.json()).toEqual({ error: 'A Link must be an http(s) URL.' });

		const missingLesson = await request.post('/api/lessons/does-not-exist/links', {
			headers: BEARER(token),
			data: { url: 'https://example.com/', label: 'Orphan' }
		});
		expect(missingLesson.status()).toBe(404);

		const list = await request.get(`/api/lessons/${lessonAId}/links`, { headers: BEARER(token) });
		expect(list.status()).toBe(200);
		const links = await list.json();
		expect(links.map((l: { id: string }) => l.id)).toEqual([linkOne.id, linkTwo.id]);
		for (const l of links) {
			expect(keysOf(l)).toEqual(['id', 'label', 'lessonId', 'position', 'url']);
		}

		const missingList = await request.get('/api/lessons/does-not-exist/links', {
			headers: BEARER(token)
		});
		expect(missingList.status()).toBe(404);

		const detail = await request.get(`/api/lessons/${lessonAId}`, { headers: BEARER(token) });
		expect((await detail.json()).links.map((l: { id: string }) => l.id)).toEqual([
			linkOne.id,
			linkTwo.id
		]);

		const patch = await request.patch(`/api/links/${linkOne.id}`, {
			headers: BEARER(token),
			data: { label: 'Rewritten label' }
		});
		expect(patch.status()).toBe(200);
		expect(await patch.json()).toMatchObject({
			id: linkOne.id,
			url: 'https://example.com/forces-sim',
			label: 'Rewritten label'
		});

		const patchMissing = await request.patch('/api/links/does-not-exist', {
			headers: BEARER(token),
			data: { label: 'Ghost' }
		});
		expect(patchMissing.status()).toBe(404);
		expect(await patchMissing.json()).toEqual({ error: 'Link not found.' });

		const remove = await request.delete(`/api/links/${linkTwo.id}`, { headers: BEARER(token) });
		expect(remove.status()).toBe(204);
		expect(await remove.text()).toBe('');

		const detailAfter = await request.get(`/api/lessons/${lessonAId}`, { headers: BEARER(token) });
		expect((await detailAfter.json()).links).toHaveLength(1);

		const removeAgain = await request.delete(`/api/links/${linkTwo.id}`, {
			headers: BEARER(token)
		});
		expect(removeAgain.status()).toBe(404);
	});
});
