import { test, expect } from '@playwright/test';
import { BEARER, standingKey, keysOf, openPage, type Page } from './helpers.ts';

// Covers the two Course endpoints over real HTTP (issue #159): the key gate every route shares,
// probed here against the Course routes, then the status codes, the uniqueness and validation
// refusals, and the list's name order. Runs first in the directory: the Courses it creates —
// "API Test Course" and "API Empty Course" — are what the Topic, Lesson and refusal files read
// back by name.
test.describe.serial('the Course endpoints', () => {
	let page: Page;
	let token = '';

	let courseId = '';
	let emptyCourseId = '';

	test.beforeAll(async ({ browser }) => {
		page = await openPage(browser);
		token = await standingKey(page);
	});

	test.afterAll(async () => {
		await page.close();
	});

	test('no key and a bad key are both 401 JSON, never a redirect to /login', async ({
		request
	}) => {
		for (const headers of [undefined, BEARER('pln_not-a-real-key')]) {
			const response = await request.get('/api/courses', { headers });
			expect(response.status()).toBe(401);
			expect(response.headers()['content-type']).toContain('application/json');
			expect(await response.json()).toEqual({
				error: 'Give a valid API key in the Authorization header.'
			});
		}

		const write = await request.post('/api/courses', { data: { name: 'API Test Course' } });
		expect(write.status()).toBe(401);
	});

	test('a Course is created with 201, collides with 409, and answers the validation refusals', async ({
		request
	}) => {
		const created = await request.post('/api/courses', {
			headers: BEARER(token),
			data: { name: 'API Test Course' }
		});
		expect(created.status()).toBe(201);
		const course = await created.json();
		courseId = course.id;
		expect(course).toEqual({ id: courseId, name: 'API Test Course' });

		const duplicate = await request.post('/api/courses', {
			headers: BEARER(token),
			data: { name: 'API Test Course' }
		});
		expect(duplicate.status()).toBe(409);
		expect(await duplicate.json()).toEqual({
			error: 'A Course called "API Test Course" already exists.'
		});

		const empty = await request.post('/api/courses', {
			headers: BEARER(token),
			data: { name: '   ' }
		});
		expect(empty.status()).toBe(400);

		const unknown = await request.post('/api/courses', {
			headers: BEARER(token),
			data: { titel: 'A typo the API must not swallow' }
		});
		expect(unknown.status()).toBe(400);
		expect(await unknown.json()).toEqual({ error: 'The field "titel" is not recognised.' });
	});

	test('a Course reads back, lists ordered by name, renames, and 404s on an unknown id', async ({
		request
	}) => {
		const one = await request.get(`/api/courses/${courseId}`, { headers: BEARER(token) });
		expect(one.status()).toBe(200);
		expect(await one.json()).toEqual({ id: courseId, name: 'API Test Course' });

		const missing = await request.get('/api/courses/does-not-exist', { headers: BEARER(token) });
		expect(missing.status()).toBe(404);
		expect(await missing.json()).toEqual({ error: 'Course not found.' });

		const list = await request.get('/api/courses', { headers: BEARER(token) });
		expect(list.status()).toBe(200);
		const courses = await list.json();
		const names = courses.map((c: { name: string }) => c.name);
		expect([...names].sort()).toEqual(names);
		expect(courses.find((c: { id: string }) => c.id === courseId)).toEqual({
			id: courseId,
			name: 'API Test Course'
		});
		for (const c of courses) {
			expect(keysOf(c)).toEqual(['id', 'name']);
		}

		const empty = await request.post('/api/courses', {
			headers: BEARER(token),
			data: { name: 'API Empty Course' }
		});
		emptyCourseId = (await empty.json()).id;
		expect(empty.status()).toBe(201);

		const rename = await request.patch(`/api/courses/${emptyCourseId}`, {
			headers: BEARER(token),
			data: { name: 'API Test Course' }
		});
		expect(rename.status()).toBe(409);
		expect(await rename.json()).toEqual({
			error: 'A Course called "API Test Course" already exists.'
		});

		const patchMissing = await request.patch('/api/courses/does-not-exist', {
			headers: BEARER(token),
			data: { name: 'Whatever' }
		});
		expect(patchMissing.status()).toBe(404);
	});
});
