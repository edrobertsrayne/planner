import { test, expect, type Page } from '@playwright/test';
import { apiKey, createdId } from './helpers.ts';
import {
	BEARER,
	FIXTURE_CLASS_LABEL,
	FIXTURE_COURSE,
	isoDate,
	resetTo,
	runFixture
} from '../helpers.ts';

// Covers the refusals that protect the record over real HTTP (issue #159): the deletes that
// answer 409 because a Course still holds Topics, a Topic still holds Lessons, a Class's Sequence
// holds a Lesson, or a Class follows the Course — and the clean deletes that answer 204. Spans
// three resources, so it has a file of its own, and creates the records it refuses to delete.
// The Lesson it needs in a Sequence is assigned here, by fixture: the API cannot make that
// assignment itself.
//
// It also holds the refusals the door itself makes (issue #425): a body that is not a JSON
// object, an upload that is not multipart, a Term that is not an object, a body over the size
// limit, and an Import whose Lessons field is not an array. Each is a 4xx with an `error` field,
// never the framework's 500. The taught and placed Lesson refusals are here too (issue #441):
// only the fixture can create the Session or the Placement they answer to.

test.beforeAll(() => resetTo('standard'));

test.describe.serial('the refusals that protect the record', () => {
	let page: Page;
	let token = '';

	let courseId = '';
	let emptyCourseId = '';
	let ks3CourseId = '';
	let sequencedLessonId = '';

	let topicOneId = '';
	let lessonCId = '';

	// A POST with a string body is sent as typed: Playwright would JSON-encode an object, which is
	// exactly the well-formed request these tests must not make.
	const rawBody = (body: string) => ({
		headers: { ...BEARER(token), 'content-type': 'application/json' },
		data: body
	});

	test.beforeAll(async ({ browser }) => {
		page = await browser.newPage();
		token = await apiKey(browser);

		// Records of this file's own: a Course with a Topic that holds a Lesson, and an empty Course.
		const courses = await (
			await page.request.get('/api/courses', { headers: BEARER(token) })
		).json();
		ks3CourseId = courses.find((c: { name: string }) => c.name === FIXTURE_COURSE).id;
		courseId = await createdId(page.request, token, '/api/courses', { name: 'API Test Course' });
		emptyCourseId = await createdId(page.request, token, '/api/courses', {
			name: 'API Empty Course'
		});
		topicOneId = await createdId(page.request, token, `/api/courses/${courseId}/topics`, {
			name: 'API Topic One'
		});
		lessonCId = await createdId(page.request, token, `/api/topics/${topicOneId}/lessons`, {
			title: 'API Lesson C'
		});

		// A Topic in the fixture Course with one Lesson, assigned to the fixture Class — the fixture
		// writes the Sequence entry the delete refusal needs.
		const sequencedTopicId = await createdId(
			page.request,
			token,
			`/api/courses/${ks3CourseId}/topics`,
			{ name: 'API Sequenced Topic' }
		);
		sequencedLessonId = await createdId(
			page.request,
			token,
			`/api/topics/${sequencedTopicId}/lessons`,
			{ title: 'API Sequenced Lesson' }
		);
		runFixture('assign-topic', FIXTURE_CLASS_LABEL, sequencedTopicId);
	});

	test.afterAll(async () => {
		await page.close();
	});

	test('the refusals that protect the record answer 409, and the clean deletes answer 204', async ({
		request
	}) => {
		const topicWithLessons = await request.delete(`/api/topics/${topicOneId}`, {
			headers: BEARER(token)
		});
		expect(topicWithLessons.status()).toBe(409);
		expect(await topicWithLessons.json()).toEqual({
			error:
				'Delete API Topic One? Its 1 Lesson becomes a Standalone Lesson. Every Class keeps it in its Sequence.'
		});

		// A Lesson that a Class's Sequence holds is refused, naming the Class. The API has no
		// confirm.
		const lessonInSequence = await request.delete(`/api/lessons/${sequencedLessonId}`, {
			headers: BEARER(token)
		});
		expect(lessonInSequence.status()).toBe(409);
		expect(await lessonInSequence.json()).toEqual({
			error: `This Lesson is in ${FIXTURE_CLASS_LABEL}'s Sequence. Delete it?`
		});
		expect(
			(await request.get(`/api/lessons/${sequencedLessonId}`, { headers: BEARER(token) })).status()
		).toBe(200);

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
			error:
				'Delete API Test Course? Its 1 Topic goes. Its 1 Lesson becomes a Standalone Lesson. Every Class keeps it in its Sequence.'
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

	test('a body that is not a JSON object is a 400 with an error, never a 500', async ({
		request
	}) => {
		// `{` does not parse, `null` parses to something that is not an object, and `[]` parses to
		// an array: three shapes, one refusal.
		for (const body of ['{', 'null', '[]']) {
			const posted = await request.post('/api/courses', rawBody(body));
			expect(posted.status()).toBe(400);
			expect(await posted.json()).toEqual({ error: 'The body must be a JSON object.' });

			const patched = await request.patch(`/api/courses/${ks3CourseId}`, rawBody(body));
			expect(patched.status()).toBe(400);
			expect(await patched.json()).toEqual({ error: 'The body must be a JSON object.' });
		}
	});

	test('an upload that is not multipart is a 400 with the file message', async ({ request }) => {
		const response = await request.post(`/api/lessons/${sequencedLessonId}/attachments`, {
			headers: { ...BEARER(token), 'content-type': 'application/json' },
			data: { file: 'not a file part' }
		});
		expect(response.status()).toBe(400);
		expect(await response.json()).toEqual({
			error: 'Send a "file" field with the file to attach.'
		});
	});

	test('a Term that is not an object and a "lessons" that is not an array are refused', async ({
		request
	}) => {
		const nulls = await request.put('/api/terms', {
			headers: BEARER(token),
			data: { terms: [null, null, null, null, null, null] }
		});
		expect(nulls.status()).toBe(400);
		expect(await nulls.json()).toEqual({
			error: 'The "terms" field must be an array of Term objects.'
		});

		// The year it tried to replace is still there.
		const terms = await request.get('/api/terms', { headers: BEARER(token) });
		expect((await terms.json()).terms).toHaveLength(6);

		// A present `lessons` that is not an array is a mistake to report, not an empty Topic.
		const notAnArray = await request.post('/api/import', {
			headers: BEARER(token),
			data: {
				course: { name: 'API Import Course' },
				topic: { name: 'API Import Topic', lessons: 'Revision' }
			}
		});
		expect(notAnArray.status()).toBe(400);
		expect(await notAnArray.json()).toEqual({
			error: 'The "lessons" field must be an array.'
		});

		const courses = await request.get('/api/courses', { headers: BEARER(token) });
		expect((await courses.json()).map((c: { name: string }) => c.name)).not.toContain(
			'API Import Course'
		);
	});

	test('a body over the size limit is a 413 with an error, not an HTML page', async ({
		request
	}) => {
		const response = await request.post('/api/courses', {
			headers: BEARER(token),
			data: { name: 'x'.repeat(13 * 1024 * 1024) }
		});
		expect(response.status()).toBe(413);
		expect(await response.json()).toEqual({ error: 'The request body is too large.' });
	});

	test('a taught or placed Lesson is refused, and a taught Lesson still detaches', async ({
		request
	}) => {
		// The standard state has taught Speed to 9B/Sc1: its Session is dated before today, so the
		// Lesson is Fixed and the delete is refused. Only the fixture can write that Session.
		const taughtId = runFixture('find-lesson-id', 'Speed').trim();
		const taught = await request.delete(`/api/lessons/${taughtId}`, { headers: BEARER(token) });
		expect(taught.status()).toBe(409);
		expect(await taught.json()).toEqual({
			error: 'A Class has already been taught this Lesson, so it cannot be removed.'
		});
		expect(
			(await request.get(`/api/lessons/${taughtId}`, { headers: BEARER(token) })).status()
		).toBe(200);

		// A Placement naming the Lesson refuses the delete too (ADR-0022), and the Placement is the
		// fixture's because the API has no Placement endpoint.
		const placedCourseId = await createdId(page.request, token, '/api/courses', {
			name: 'API Placed Course'
		});
		const placedTopicId = await createdId(
			page.request,
			token,
			`/api/courses/${placedCourseId}/topics`,
			{ name: 'API Placed Topic' }
		);
		const placedLessonId = await createdId(
			page.request,
			token,
			`/api/topics/${placedTopicId}/lessons`,
			{ title: 'API Placed Lesson' }
		);
		runFixture('place-lesson', placedLessonId, FIXTURE_CLASS_LABEL, isoDate(1));

		const placed = await request.delete(`/api/lessons/${placedLessonId}`, {
			headers: BEARER(token)
		});
		expect(placed.status()).toBe(409);
		expect(await placed.json()).toEqual({
			error: 'A Placement names this Lesson, so it cannot be removed. Remove the Placement first.'
		});

		// Detach is allowed on a taught Lesson and changes no Sequence (ADR-0015), so the delete
		// refusal still finds the Session that taught it.
		const detach = await request.patch(`/api/lessons/${taughtId}`, {
			headers: BEARER(token),
			data: { topicId: null }
		});
		expect(detach.status()).toBe(200);
		expect((await detach.json()).lesson).toMatchObject({ topicId: null });

		const stillTaught = await request.delete(`/api/lessons/${taughtId}`, {
			headers: BEARER(token)
		});
		expect(stillTaught.status()).toBe(409);
		expect(await stillTaught.json()).toEqual({
			error: 'A Class has already been taught this Lesson, so it cannot be removed.'
		});

		// Take the Placement back out, then the Lesson is removable and leaves nothing behind.
		runFixture('unplace-lesson', placedLessonId);
		const unplaced = await request.delete(`/api/lessons/${placedLessonId}`, {
			headers: BEARER(token)
		});
		expect(unplaced.status()).toBe(204);
	});
});
