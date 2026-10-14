import { test, expect } from '@playwright/test';
import {
	BEARER,
	FIXTURE_CLASS_LABEL,
	FIXTURE_COURSE,
	apiKey,
	createdId,
	type Page
} from './helpers.ts';
import { resetTo, runFixture } from '../helpers.ts';

// Covers the refusals that protect the record over real HTTP (issue #159): the deletes that
// answer 409 because a Course still holds Topics, a Topic still holds Lessons, a Class's Sequence
// holds a Lesson, or a Class follows the Course — and the clean deletes that answer 204. Spans
// three resources, so it has a file of its own, and creates the records it refuses to delete.
// The Lesson it needs in a Sequence is assigned here, by fixture: the API cannot make that
// assignment itself.

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
			error: 'This Topic still holds Lessons. Remove or detach them first.'
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
});
