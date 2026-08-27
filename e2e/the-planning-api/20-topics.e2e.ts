import { test, expect } from '@playwright/test';
import { BEARER, FIXTURE_COURSE, generateKey, keysOf, openPage, type Page } from './helpers.ts';

// Covers the two Topic endpoints over real HTTP (issue #159): the per-Course, case-insensitive
// collision rule, the list's sort, the rename collision, and the courseId refusal. The routes
// hang off a Course — a Topic is created under its Course — and the file runs directly after the
// Courses file, whose "API Test Course" holds these Topics; the Lessons file after it reads the
// Topics this one creates.
test.describe.serial('the Topic endpoints', () => {
	let page: Page;
	let token = '';

	let courseId = '';
	let emptyCourseId = '';
	let ks3CourseId = '';

	let topicOneId = '';
	let topicTwoId = '';

	test.beforeAll(async ({ browser }) => {
		page = await openPage(browser);
		token = await generateKey(page);

		// The Courses the earlier files left behind: the fixture Course the wizard data left, and
		// the two the Course file created for these Topics.
		const courses = await (
			await page.request.get('/api/courses', { headers: BEARER(token) })
		).json();
		ks3CourseId = courses.find((c: { name: string }) => c.name === FIXTURE_COURSE).id;
		courseId = courses.find((c: { name: string }) => c.name === 'API Test Course').id;
		emptyCourseId = courses.find((c: { name: string }) => c.name === 'API Empty Course').id;
	});

	test.afterAll(async () => {
		await page.close();
	});

	test('a Topic collides only within its own Course, case-insensitively', async ({ request }) => {
		const created = await request.post(`/api/courses/${courseId}/topics`, {
			headers: BEARER(token),
			data: { name: 'API Topic One' }
		});
		expect(created.status()).toBe(201);
		const topic = await created.json();
		topicOneId = topic.id;
		expect(keysOf(topic)).toEqual(['courseId', 'id', 'name']);
		expect(topic).toMatchObject({ name: 'API Topic One', courseId });

		const same = await request.post(`/api/courses/${courseId}/topics`, {
			headers: BEARER(token),
			data: { name: 'API Topic One' }
		});
		expect(same.status()).toBe(409);
		expect(await same.json()).toEqual({
			error: 'This Course already has a Topic called "API Topic One".'
		});

		const caseInsensitive = await request.post(`/api/courses/${courseId}/topics`, {
			headers: BEARER(token),
			data: { name: 'api topic one' }
		});
		expect(caseInsensitive.status()).toBe(409);

		// The fixture Course already holds "Forces" (teaching-flows.e2e.ts): "forces" collides
		// there, but not in this Course — Topic names are unique per Course, not globally.
		const fixtureCollision = await request.post(`/api/courses/${ks3CourseId}/topics`, {
			headers: BEARER(token),
			data: { name: 'forces' }
		});
		expect(fixtureCollision.status()).toBe(409);
		expect(await fixtureCollision.json()).toEqual({
			error: 'This Course already has a Topic called "Forces".'
		});

		const otherCourse = await request.post(`/api/courses/${courseId}/topics`, {
			headers: BEARER(token),
			data: { name: 'forces' }
		});
		expect(otherCourse.status()).toBe(201);

		const missingCourse = await request.post('/api/courses/does-not-exist/topics', {
			headers: BEARER(token),
			data: { name: 'Orphan' }
		});
		expect(missingCourse.status()).toBe(404);
	});

	test('a Topic reads back, lists sorted by name, renames, and rejects courseId', async ({
		request
	}) => {
		const created = await request.post(`/api/courses/${courseId}/topics`, {
			headers: BEARER(token),
			data: { name: 'API Topic Two' }
		});
		expect(created.status()).toBe(201);
		topicTwoId = (await created.json()).id;

		const one = await request.get(`/api/topics/${topicOneId}`, { headers: BEARER(token) });
		expect(one.status()).toBe(200);
		expect(await one.json()).toMatchObject({ id: topicOneId, name: 'API Topic One', courseId });

		const missing = await request.get('/api/topics/does-not-exist', { headers: BEARER(token) });
		expect(missing.status()).toBe(404);
		expect(await missing.json()).toEqual({ error: 'Topic not found.' });

		const list = await request.get(`/api/courses/${courseId}/topics`, { headers: BEARER(token) });
		expect(list.status()).toBe(200);
		const topics = await list.json();
		const names = topics.map((t: { name: string }) => t.name);
		expect([...names].sort((a, b) => a.localeCompare(b))).toEqual(names);
		for (const t of topics) {
			expect(keysOf(t)).toEqual(['courseId', 'id', 'name']);
		}

		const missingCourse = await request.get('/api/courses/does-not-exist/topics', {
			headers: BEARER(token)
		});
		expect(missingCourse.status()).toBe(404);

		const rename = await request.patch(`/api/topics/${topicTwoId}`, {
			headers: BEARER(token),
			data: { name: 'API Topic Two Renamed' }
		});
		expect(rename.status()).toBe(200);
		expect(await rename.json()).toMatchObject({ id: topicTwoId, name: 'API Topic Two Renamed' });

		const collision = await request.patch(`/api/topics/${topicTwoId}`, {
			headers: BEARER(token),
			data: { name: 'API Topic One' }
		});
		expect(collision.status()).toBe(409);
		expect(await collision.json()).toEqual({
			error: 'This Course already has a Topic called "API Topic One".'
		});

		// Moving a Topic between Courses is a scheduling act, so courseId is not a field.
		const courseIdField = await request.patch(`/api/topics/${topicTwoId}`, {
			headers: BEARER(token),
			data: { courseId: emptyCourseId }
		});
		expect(courseIdField.status()).toBe(400);
		expect(await courseIdField.json()).toEqual({
			error: 'The field "courseId" is not recognised.'
		});
	});
});
