import { test, expect } from '@playwright/test';
import { BEARER, apiKey, createdId, keysOf, type Page } from './helpers.ts';
import { resetTo } from '../helpers.ts';

// Covers the two Lesson endpoints over real HTTP (issue #159): creation with its defaults, the
// list order, PATCH's partial semantics, and the null-topicId detach that makes a Standalone
// Lesson (ADR-0015). Detach is one-way (ADR-0022):
// re-attaching a Standalone Lesson to a Topic is refused, never a 200.

test.beforeAll(() => resetTo('standard'));

test.describe.serial('the Lesson endpoints', () => {
	let page: Page;
	let token = '';

	let courseId = '';
	let topicOneId = '';

	let lessonAId = '';
	let lessonBId = '';
	let lessonCId = '';

	test.beforeAll(async ({ browser }) => {
		page = await browser.newPage();
		token = await apiKey(browser);

		courseId = await createdId(page.request, token, '/api/courses', { name: 'API Test Course' });
		topicOneId = await createdId(page.request, token, `/api/courses/${courseId}/topics`, {
			name: 'API Topic One'
		});
	});

	test.afterAll(async () => {
		await page.close();
	});

	test('a Lesson is created with its defaults, listed in order, and only read in full with its Links', async ({
		request
	}) => {
		const bare = await request.post(`/api/topics/${topicOneId}/lessons`, {
			headers: BEARER(token),
			data: { title: 'API Lesson A' }
		});
		expect(bare.status()).toBe(201);
		const lessonA = await bare.json();
		lessonAId = lessonA.id;
		expect(lessonA).toEqual({
			id: lessonAId,
			topicId: topicOneId,
			title: 'API Lesson A',
			body: null,
			status: 'draft',
			length: 1,
			position: 0,
			links: [],
			report: { atRisk: [], placementsMoved: [] }
		});

		const full = await request.post(`/api/topics/${topicOneId}/lessons`, {
			headers: BEARER(token),
			data: { title: 'API Lesson B', body: 'Some text', length: 3, status: 'planned' }
		});
		expect(full.status()).toBe(201);
		const lessonB = await full.json();
		lessonBId = lessonB.id;
		expect(lessonB).toMatchObject({ position: 1, body: 'Some text', length: 3, status: 'planned' });

		const spare = await request.post(`/api/topics/${topicOneId}/lessons`, {
			headers: BEARER(token),
			data: { title: 'API Lesson C' }
		});
		expect(spare.status()).toBe(201);
		lessonCId = (await spare.json()).id;

		const noTitle = await request.post(`/api/topics/${topicOneId}/lessons`, {
			headers: BEARER(token),
			data: {}
		});
		expect(noTitle.status()).toBe(400);

		const badLength = await request.post(`/api/topics/${topicOneId}/lessons`, {
			headers: BEARER(token),
			data: { title: 'Overlong', length: 25 }
		});
		expect(badLength.status()).toBe(400);

		const badStatus = await request.post(`/api/topics/${topicOneId}/lessons`, {
			headers: BEARER(token),
			data: { title: 'Mislabeled', status: 'archived' }
		});
		expect(badStatus.status()).toBe(400);
		expect(await badStatus.json()).toEqual({ error: 'A Lesson must be Draft or Planned.' });

		const missingTopic = await request.post('/api/topics/does-not-exist/lessons', {
			headers: BEARER(token),
			data: { title: 'Orphan' }
		});
		expect(missingTopic.status()).toBe(404);

		const list = await request.get(`/api/topics/${topicOneId}/lessons`, {
			headers: BEARER(token)
		});
		expect(list.status()).toBe(200);
		const lessons = await list.json();
		expect(lessons.map((l: { id: string }) => l.id)).toEqual([lessonAId, lessonBId, lessonCId]);
		for (const l of lessons) {
			expect(keysOf(l)).toEqual(['body', 'id', 'length', 'position', 'status', 'title', 'topicId']);
		}

		const missingList = await request.get('/api/topics/does-not-exist/lessons', {
			headers: BEARER(token)
		});
		expect(missingList.status()).toBe(404);

		// GET /api/lessons/:id is the one read that includes children — a Lesson without its
		// Links is not the plan.
		const detail = await request.get(`/api/lessons/${lessonAId}`, { headers: BEARER(token) });
		expect(detail.status()).toBe(200);
		const detailBody = await detail.json();
		expect(keysOf(detailBody)).toEqual([
			'attachments',
			'body',
			'id',
			'length',
			'links',
			'position',
			'status',
			'tags',
			'title',
			'topicId'
		]);
		expect(detailBody.links).toEqual([]);
		expect(detailBody.attachments).toEqual([]);
		expect(detailBody.tags).toEqual([]);

		const missingDetail = await request.get('/api/lessons/does-not-exist', {
			headers: BEARER(token)
		});
		expect(missingDetail.status()).toBe(404);
		expect(await missingDetail.json()).toEqual({ error: 'Lesson not found.' });
	});

	test('PATCH is partial: absent leaves a field alone, null clears or detaches it', async ({
		request
	}) => {
		// Absent body, absent length: a title-only PATCH changes the title and nothing else, and
		// the reply is the Lesson without its links, beside the Rewind report of the change.
		const titleOnly = await request.patch(`/api/lessons/${lessonAId}`, {
			headers: BEARER(token),
			data: { title: 'API Lesson A Renamed' }
		});
		expect(titleOnly.status()).toBe(200);
		const renamed = await titleOnly.json();
		expect(keysOf(renamed)).toEqual(['lesson', 'report']);
		expect(keysOf(renamed.lesson)).toEqual([
			'body',
			'id',
			'length',
			'position',
			'status',
			'title',
			'topicId'
		]);
		expect(renamed.lesson).toMatchObject({
			title: 'API Lesson A Renamed',
			body: null,
			length: 1,
			status: 'draft'
		});

		// {"body": null} clears; {"body": "…"} sets.
		const cleared = await request.patch(`/api/lessons/${lessonBId}`, {
			headers: BEARER(token),
			data: { body: null }
		});
		expect(cleared.status()).toBe(200);
		expect((await cleared.json()).lesson).toMatchObject({ body: null });

		const set = await request.patch(`/api/lessons/${lessonBId}`, {
			headers: BEARER(token),
			data: { body: 'Rewritten' }
		});
		expect(set.status()).toBe(200);
		expect((await set.json()).lesson).toMatchObject({ body: 'Rewritten' });

		const lengthTwo = await request.patch(`/api/lessons/${lessonBId}`, {
			headers: BEARER(token),
			data: { length: 2 }
		});
		expect(lengthTwo.status()).toBe(200);
		expect((await lengthTwo.json()).lesson).toMatchObject({ length: 2, body: 'Rewritten' });

		// An empty PATCH, or one that names the Lesson's own Topic, is a no-op that returns the
		// unchanged record and an empty report.
		for (const data of [{}, { topicId: topicOneId }]) {
			const noop = await request.patch(`/api/lessons/${lessonBId}`, {
				headers: BEARER(token),
				data
			});
			expect(noop.status()).toBe(200);
			expect(await noop.json()).toMatchObject({
				lesson: { body: 'Rewritten', length: 2, status: 'planned', topicId: topicOneId },
				report: { atRisk: [], placementsMoved: [] }
			});
		}

		const blankTitle = await request.patch(`/api/lessons/${lessonBId}`, {
			headers: BEARER(token),
			data: { title: '   ' }
		});
		expect(blankTitle.status()).toBe(400);
		expect(await blankTitle.json()).toEqual({ error: 'A Lesson needs a title.' });

		const missingLesson = await request.patch('/api/lessons/does-not-exist', {
			headers: BEARER(token),
			data: { title: 'Ghost' }
		});
		expect(missingLesson.status()).toBe(404);

		const missingTopic = await request.patch(`/api/lessons/${lessonBId}`, {
			headers: BEARER(token),
			data: { topicId: 'does-not-exist' }
		});
		expect(missingTopic.status()).toBe(404);
		expect(await missingTopic.json()).toEqual({ error: 'Topic not found.' });
	});

	test('a Lesson detaches with a null topicId, and re-attaching it is refused', async ({
		request
	}) => {
		const detach = await request.patch(`/api/lessons/${lessonBId}`, {
			headers: BEARER(token),
			data: { topicId: null }
		});
		expect(detach.status()).toBe(200);
		const detached = (await detach.json()).lesson;
		expect(detached).toMatchObject({ topicId: null, title: 'API Lesson B', body: 'Rewritten' });
		expect(detached.links).toBeUndefined();

		// Detaching a Standalone Lesson again is a no-op, not an error.
		const again = await request.patch(`/api/lessons/${lessonBId}`, {
			headers: BEARER(token),
			data: { topicId: null }
		});
		expect(again.status()).toBe(200);
		expect((await again.json()).lesson).toMatchObject({ topicId: null });

		const detailWhileDetached = await request.get(`/api/lessons/${lessonBId}`, {
			headers: BEARER(token)
		});
		expect((await detailWhileDetached.json()).topicId).toBeNull();

		const reattach = await request.patch(`/api/lessons/${lessonBId}`, {
			headers: BEARER(token),
			data: { topicId: topicOneId }
		});
		expect(reattach.status()).toBe(409);
		expect(await reattach.json()).toEqual({ error: 'A Standalone Lesson cannot rejoin a Topic.' });

		const list = await request.get(`/api/topics/${topicOneId}/lessons`, { headers: BEARER(token) });
		expect((await list.json()).map((l: { id: string }) => l.id)).toEqual([lessonAId, lessonCId]);
	});
});
