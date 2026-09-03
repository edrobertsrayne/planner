import { test, expect } from '@playwright/test';
import { BEARER, standingKey, keysOf, openPage, type Page } from './helpers.ts';

// Covers the two Lesson endpoints over real HTTP (issue #159): creation with its defaults, the
// list order, PATCH's partial semantics, and the null-topicId detach that makes a Standalone
// Lesson (ADR-0015). Reads the Course the Course file created and the Topic the Topic file left
// in it; the Link file after it reads the Lessons this one leaves.
test.describe.serial('the Lesson endpoints', () => {
	let page: Page;
	let token = '';

	let courseId = '';
	let topicOneId = '';

	let lessonAId = '';
	let lessonBId = '';
	let lessonCId = '';

	test.beforeAll(async ({ browser }) => {
		page = await openPage(browser);
		token = await standingKey(page);

		// The Course and Topic the earlier files left behind, found by the names they are known by.
		const courses = await (
			await page.request.get('/api/courses', { headers: BEARER(token) })
		).json();
		courseId = courses.find((c: { name: string }) => c.name === 'API Test Course').id;
		const topics = await (
			await page.request.get(`/api/courses/${courseId}/topics`, { headers: BEARER(token) })
		).json();
		topicOneId = topics.find((t: { name: string }) => t.name === 'API Topic One').id;
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
			links: []
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
			'title',
			'topicId'
		]);
		expect(detailBody.links).toEqual([]);
		expect(detailBody.attachments).toEqual([]);

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
		// the reply is the Lesson without its links.
		const titleOnly = await request.patch(`/api/lessons/${lessonAId}`, {
			headers: BEARER(token),
			data: { title: 'API Lesson A Renamed' }
		});
		expect(titleOnly.status()).toBe(200);
		const renamed = await titleOnly.json();
		expect(keysOf(renamed)).toEqual([
			'body',
			'id',
			'length',
			'position',
			'status',
			'title',
			'topicId'
		]);
		expect(renamed).toMatchObject({
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
		expect(await cleared.json()).toMatchObject({ body: null });

		const set = await request.patch(`/api/lessons/${lessonBId}`, {
			headers: BEARER(token),
			data: { body: 'Rewritten' }
		});
		expect(set.status()).toBe(200);
		expect(await set.json()).toMatchObject({ body: 'Rewritten' });

		const lengthTwo = await request.patch(`/api/lessons/${lessonBId}`, {
			headers: BEARER(token),
			data: { length: 2 }
		});
		expect(lengthTwo.status()).toBe(200);
		expect(await lengthTwo.json()).toMatchObject({ length: 2, body: 'Rewritten' });

		// An empty PATCH is a no-op that returns the unchanged record.
		const noop = await request.patch(`/api/lessons/${lessonBId}`, {
			headers: BEARER(token),
			data: {}
		});
		expect(noop.status()).toBe(200);
		expect(await noop.json()).toMatchObject({ body: 'Rewritten', length: 2, status: 'planned' });

		const unknownField = await request.patch(`/api/lessons/${lessonBId}`, {
			headers: BEARER(token),
			data: { titel: 'A typo' }
		});
		expect(unknownField.status()).toBe(400);
		expect(await unknownField.json()).toEqual({ error: 'The field "titel" is not recognised.' });

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

	test('a Lesson detaches with a null topicId and re-attaches at the end of the target Topic', async ({
		request
	}) => {
		const detach = await request.patch(`/api/lessons/${lessonBId}`, {
			headers: BEARER(token),
			data: { topicId: null }
		});
		expect(detach.status()).toBe(200);
		const detached = await detach.json();
		expect(detached).toMatchObject({ topicId: null, title: 'API Lesson B', body: 'Rewritten' });
		expect(detached.links).toBeUndefined();

		const detailWhileDetached = await request.get(`/api/lessons/${lessonBId}`, {
			headers: BEARER(token)
		});
		expect((await detailWhileDetached.json()).topicId).toBeNull();

		const reattach = await request.patch(`/api/lessons/${lessonBId}`, {
			headers: BEARER(token),
			data: { topicId: topicOneId }
		});
		expect(reattach.status()).toBe(200);
		expect(await reattach.json()).toMatchObject({ topicId: topicOneId });

		const list = await request.get(`/api/topics/${topicOneId}/lessons`, { headers: BEARER(token) });
		expect((await list.json()).map((l: { id: string }) => l.id)).toEqual([
			lessonAId,
			lessonCId,
			lessonBId
		]);
	});
});
