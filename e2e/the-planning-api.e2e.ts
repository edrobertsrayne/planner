import { test, expect, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';

// Covers the nine route files under src/routes/api/ over real HTTP (issue #159), and the three
// Blocked Day endpoints beside them (issue #165): the key check, the status codes, the response
// shapes, PATCH's partial semantics, and Import's whole-or-nothing transaction, with the
// expected behaviour taken from docs/spec/planning-api.md. Runs after teaching-flows.e2e.ts —
// its Planning-tab counts assume only the lessons it created — and before
// user-settings-password.e2e.ts, which must stay last for the suite's single-worker ordering
// (see isolation.e2e.ts).
const EMAIL = 'teacher@example.com';
const PASSWORD = 'a-very-long-password';

// The Course the wizard-era fixture data left behind: two Classes follow it (created in
// teaching-flows.e2e.ts), which is what makes the delete route's Class refusal reachable.
const FIXTURE_COURSE = 'KS3 Science';
const FIXTURE_CLASS_LABEL = '9C/Sc1';

const BEARER = (token: string) => ({ Authorization: `Bearer ${token}` });

const keysOf = (body: Record<string, unknown>) => Object.keys(body).sort();

function plusDays(iso: string, days: number): string {
	const date = new Date(`${iso}T00:00:00Z`);
	date.setUTCDate(date.getUTCDate() + days);
	return date.toISOString().slice(0, 10);
}

function weekdayOf(iso: string): number {
	return new Date(`${iso}T00:00:00Z`).getUTCDay();
}

// The next Monday-to-Friday date on or after `iso`.
function nextWeekday(iso: string): string {
	let date = iso;
	while (weekdayOf(date) === 0 || weekdayOf(date) === 6) date = plusDays(date, 1);
	return date;
}

// The next Saturday on or after `iso`.
function nextSaturday(iso: string): string {
	let date = iso;
	while (weekdayOf(date) !== 6) date = plusDays(date, 1);
	return date;
}

function todayIso(): string {
	return new Date().toISOString().slice(0, 10);
}

function runFixture(...args: string[]): string {
	return execFileSync('node', ['scripts/e2e-fixtures.ts', ...args], {
		cwd: process.cwd(),
		env: { ...process.env, DATABASE_URL: 'e2e.db' },
		encoding: 'utf-8'
	});
}

async function login(page: Page, email: string, password: string) {
	await page.goto('/login');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill(password);
	await page.getByRole('button', { name: 'Log in' }).click();
	await expect(page).toHaveURL('/');
}

async function generateKey(page: Page, buttonName: 'Generate' | 'Regenerate'): Promise<string> {
	await page.goto('/settings');
	await page.getByRole('button', { name: buttonName }).click();
	await expect(page.getByRole('status').filter({ hasText: 'API key generated.' })).toBeVisible();
	return (await page.locator('code').filter({ hasText: /pln_/ }).innerText()).trim();
}

test.describe.serial('the planning HTTP API', () => {
	let page: Page;
	let token = '';

	let courseId = '';
	let emptyCourseId = '';
	let ks3CourseId = '';
	let assignedTopicId = '';

	let topicOneId = '';
	let topicTwoId = '';

	let lessonAId = '';
	let lessonBId = '';
	let lessonCId = '';

	test.beforeAll(async ({ browser }) => {
		page = await browser.newPage();
		await login(page, EMAIL, PASSWORD);
		token = await generateKey(page, 'Generate');

		// A Topic in the fixture Course, assigned to the fixture Class — the API cannot make that
		// assignment itself, so the fixture writes the row the delete refusal needs.
		const courses = await (
			await page.request.get('/api/courses', { headers: BEARER(token) })
		).json();
		ks3CourseId = courses.find((c: { name: string }) => c.name === FIXTURE_COURSE).id;
		const assigned = await (
			await page.request.post(`/api/courses/${ks3CourseId}/topics`, {
				headers: BEARER(token),
				data: { name: 'API Assigned Topic' }
			})
		).json();
		assignedTopicId = assigned.id;
		runFixture('assign-topic', FIXTURE_CLASS_LABEL, assignedTopicId);
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
			data: { url: 'ftp://example.com/file', label: 'FTP' }
		});
		expect(wrongScheme.status()).toBe(400);

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

	test('the refusals that protect the record answer 409, and the clean deletes answer 204', async ({
		request
	}) => {
		const topicWithLessons = await request.delete(`/api/topics/${topicOneId}`, {
			headers: BEARER(token)
		});
		expect(topicWithLessons.status()).toBe(409);
		expect(await topicWithLessons.json()).toEqual({
			error: 'This Topic still holds Lessons. Remove or detach them first.'
		});

		const topicAssigned = await request.delete(`/api/topics/${assignedTopicId}`, {
			headers: BEARER(token)
		});
		expect(topicAssigned.status()).toBe(409);
		expect(await topicAssigned.json()).toEqual({
			error: 'This Topic is assigned to a Class, so it cannot be removed.'
		});

		const topicMissing = await request.delete('/api/topics/does-not-exist', {
			headers: BEARER(token)
		});
		expect(topicMissing.status()).toBe(404);

		const emptyTopic = await request.post(`/api/courses/${emptyCourseId}/topics`, {
			headers: BEARER(token),
			data: { name: 'API Topic To Delete' }
		});
		const emptyTopicId = (await emptyTopic.json()).id;
		const removedTopic = await request.delete(`/api/topics/${emptyTopicId}`, {
			headers: BEARER(token)
		});
		expect(removedTopic.status()).toBe(204);
		expect(await removedTopic.text()).toBe('');

		const courseWithTopics = await request.delete(`/api/courses/${courseId}`, {
			headers: BEARER(token)
		});
		expect(courseWithTopics.status()).toBe(409);
		expect(await courseWithTopics.json()).toEqual({
			error: 'This Course still holds Topics. Remove them first.'
		});

		const courseFollowed = await request.post('/api/courses', {
			headers: BEARER(token),
			data: { name: 'API Followed Course' }
		});
		expect(courseFollowed.status()).toBe(201);
		const followedCourseId = (await courseFollowed.json()).id;
		runFixture('create-class', '9E/Sc1', followedCourseId);

		// A Course a Class follows cannot go — a 409, never the 500 a raw foreign-key failure
		// would give.
		const refused = await request.delete(`/api/courses/${followedCourseId}`, {
			headers: BEARER(token)
		});
		expect(refused.status()).toBe(409);
		expect(await refused.json()).toEqual({
			error: 'A Class follows this Course, so it cannot be removed.'
		});

		const removedLesson = await request.delete(`/api/lessons/${lessonCId}`, {
			headers: BEARER(token)
		});
		expect(removedLesson.status()).toBe(204);
		expect(await removedLesson.text()).toBe('');

		const lessonGone = await request.get(`/api/lessons/${lessonCId}`, { headers: BEARER(token) });
		expect(lessonGone.status()).toBe(404);

		const lessonMissing = await request.delete('/api/lessons/does-not-exist', {
			headers: BEARER(token)
		});
		expect(lessonMissing.status()).toBe(404);

		const removedCourse = await request.delete(`/api/courses/${emptyCourseId}`, {
			headers: BEARER(token)
		});
		expect(removedCourse.status()).toBe(204);
		expect(await removedCourse.text()).toBe('');

		const courseGone = await request.get(`/api/courses/${emptyCourseId}`, {
			headers: BEARER(token)
		});
		expect(courseGone.status()).toBe(404);
	});

	test('the Blocked Day endpoints list, add and remove by date', async ({ request }) => {
		// Every route requires the key.
		expect((await request.get('/api/blocked-days')).status()).toBe(401);
		expect(
			(await request.post('/api/blocked-days', { data: { date: '2026-09-03' } })).status()
		).toBe(401);
		expect((await request.delete('/api/blocked-days/2026-09-03')).status()).toBe(401);

		// The whole year, in date order, no ids — a Blocked Day is addressed by date.
		const empty = await request.get('/api/blocked-days', { headers: BEARER(token) });
		expect(empty.status()).toBe(200);
		expect(await empty.json()).toEqual({ blockedDays: [] });

		const today = new Date().toISOString().slice(0, 10);
		const inset = nextWeekday(plusDays(today, 90));

		// A date with no note at all: 201, the note null, and the Rewind's report beside it.
		const created = await request.post('/api/blocked-days', {
			headers: BEARER(token),
			data: { date: inset }
		});
		expect(created.status()).toBe(201);
		const report = await created.json();
		expect(report.blockedDay).toEqual({ date: inset, note: null });
		expect(report.atRisk).toEqual([]);

		// A weekend is a 400 where an already-blocked date is a 409 — the two must be
		// distinguishable, and the teacher is told which.
		const saturday = nextSaturday(plusDays(today, 95));
		const weekend = await request.post('/api/blocked-days', {
			headers: BEARER(token),
			data: { date: saturday }
		});
		expect(weekend.status()).toBe(400);
		expect(await weekend.json()).toEqual({
			error: `"${saturday}" falls on a weekend. A Blocked Day must be a Monday to Friday.`
		});

		const duplicate = await request.post('/api/blocked-days', {
			headers: BEARER(token),
			data: { date: inset, note: 'INSET' }
		});
		expect(duplicate.status()).toBe(409);
		expect(await duplicate.json()).toEqual({
			error: `"${inset}" is already a Blocked Day.`
		});

		// The note is capped at the existing name ceiling.
		const bankHoliday = nextWeekday(plusDays(today, 100));
		const capped = await request.post('/api/blocked-days', {
			headers: BEARER(token),
			data: { date: bankHoliday, note: 'x'.repeat(201) }
		});
		expect(capped.status()).toBe(400);
		expect((await capped.json()).error).toContain('at most 200');

		// Extra fields in a body are read and ignored.
		const withExtra = await request.post('/api/blocked-days', {
			headers: BEARER(token),
			data: { date: bankHoliday, note: 'Bank holiday', titel: 'extra' }
		});
		expect(withExtra.status()).toBe(201);
		expect((await withExtra.json()).blockedDay).toEqual({
			date: bankHoliday,
			note: 'Bank holiday'
		});

		const listed = await request.get('/api/blocked-days', { headers: BEARER(token) });
		expect(listed.status()).toBe(200);
		const list = (await listed.json()).blockedDays;
		expect(list.map((d: { date: string }) => d.date)).toEqual([inset, bankHoliday]);
		for (const day of list) {
			expect(keysOf(day)).toEqual(['date', 'note']);
		}

		// A date that is not blocked is a 404. A blocked one answers 200 with the report in the
		// body — not a bare 204.
		const missing = await request.delete(`/api/blocked-days/${saturday}`, {
			headers: BEARER(token)
		});
		expect(missing.status()).toBe(404);

		const removed = await request.delete(`/api/blocked-days/${inset}`, { headers: BEARER(token) });
		expect(removed.status()).toBe(200);
		expect((await removed.json()).atRisk).toEqual([]);

		const remaining = await request.get('/api/blocked-days', { headers: BEARER(token) });
		expect((await remaining.json()).blockedDays.map((d: { date: string }) => d.date)).toEqual([
			bankHoliday
		]);

		const again = await request.delete(`/api/blocked-days/${inset}`, { headers: BEARER(token) });
		expect(again.status()).toBe(404);
	});

	test('the Term endpoints read the year back and replace it as one document', async ({
		request
	}) => {
		// Both routes answer a missing key the way every other route does.
		expect((await request.get('/api/terms')).status()).toBe(401);
		expect((await request.put('/api/terms', { data: { terms: [] } })).status()).toBe(401);

		// The setup spec before this one cleared the year, so the read starts empty.
		const empty = await request.get('/api/terms', { headers: BEARER(token) });
		expect(empty.status()).toBe(200);
		expect(await empty.json()).toEqual({ terms: [] });

		// Six Terms spanning today, given in no particular order — the read derives the names
		// from position and answers 200 with the new six beside an empty at-risk report.
		const opens = [-84, -14, 70, 98, 126, 154].map((d) => plusDays(todayIso(), d));
		const closes = [-21, 56, 84, 112, 140, 168].map((d) => plusDays(todayIso(), d));
		const shuffled = [3, 0, 5, 1, 4, 2].map((i) => ({ opens: opens[i], closes: closes[i] }));

		const put = await request.put('/api/terms', {
			headers: BEARER(token),
			data: { terms: shuffled, note: 'an extra field the app never sends' }
		});
		expect(put.status()).toBe(200);
		const report = await put.json();
		expect(report.atRisk).toEqual([]);
		expect(report.terms.map((t: { name: string }) => t.name)).toEqual([
			'Autumn 1',
			'Autumn 2',
			'Spring 1',
			'Spring 2',
			'Summer 1',
			'Summer 2'
		]);
		for (const t of report.terms) {
			expect(keysOf(t)).toEqual(['closes', 'name', 'opens']);
		}

		const read = await request.get('/api/terms', { headers: BEARER(token) });
		expect(await read.json()).toEqual({ terms: report.terms });

		// Every Term rule is the seam's, and the first error wins: the wrong count, an unreal
		// date, a Term opening after it closes, and two that touch.
		const five = await request.put('/api/terms', {
			headers: BEARER(token),
			data: { terms: shuffled.slice(1) }
		});
		expect(five.status()).toBe(400);
		expect(await five.json()).toEqual({
			error: 'A year needs exactly six Terms, and 5 were given.'
		});

		const seven = await request.put('/api/terms', {
			headers: BEARER(token),
			data: {
				terms: [
					...shuffled,
					{ opens: plusDays(todayIso(), 200), closes: plusDays(todayIso(), 210) }
				]
			}
		});
		expect(seven.status()).toBe(400);
		expect(await seven.json()).toEqual({
			error: 'A year needs exactly six Terms, and 7 were given.'
		});

		const unreal = await request.put('/api/terms', {
			headers: BEARER(token),
			data: {
				terms: shuffled.map((t, i) => (i === 2 ? { opens: '2026-02-30', closes: t.closes } : t))
			}
		});
		expect(unreal.status()).toBe(400);
		expect(await unreal.json()).toEqual({ error: '"2026-02-30" is not a real date.' });

		const backwards = await request.put('/api/terms', {
			headers: BEARER(token),
			data: {
				terms: shuffled.map((t, i) => (i === 0 ? { opens: t.closes, closes: t.opens } : t))
			}
		});
		expect(backwards.status()).toBe(400);
		expect((await backwards.json()).error).toContain('A Term cannot open after it closes:');

		const touching = await request.put('/api/terms', {
			headers: BEARER(token),
			data: {
				terms: shuffled.map((t, i) => (i === 3 ? { opens: closes[0], closes: t.closes } : t))
			}
		});
		expect(touching.status()).toBe(400);
		expect((await touching.json()).error).toContain('Terms cannot overlap or touch:');
	});

	test('regenerating the key revokes the old token at once', async ({ request }) => {
		const oldToken = token;
		token = await generateKey(page, 'Regenerate');
		expect(token).not.toBe(oldToken);

		const revoked = await request.get('/api/courses', { headers: BEARER(oldToken) });
		expect(revoked.status()).toBe(401);

		const replacement = await request.get('/api/courses', { headers: BEARER(token) });
		expect(replacement.status()).toBe(200);
	});
});
