import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect } from '@playwright/test';
import { BEARER, apiKey, keysOf, type Page } from './helpers.ts';

// Covers the two Attachment endpoints over real HTTP (issue #268): upload, the refusals, the
// Lesson GET's `attachments`, and removal from the row and the disk. Uses the Lesson the Lesson
// file left behind and removes what it creates, so the later files see nothing new.
test.describe.serial('the Attachment endpoints', () => {
	let page: Page;
	let token = '';
	let lessonAId = '';

	test.beforeAll(async ({ browser }) => {
		page = await browser.newPage();
		token = await apiKey(browser);

		const courses = await (
			await page.request.get('/api/courses', { headers: BEARER(token) })
		).json();
		const courseId = courses.find((c: { name: string }) => c.name === 'API Test Course').id;
		const topics = await (
			await page.request.get(`/api/courses/${courseId}/topics`, { headers: BEARER(token) })
		).json();
		const topicOneId = topics.find((t: { name: string }) => t.name === 'API Topic One').id;
		const lessons = await (
			await page.request.get(`/api/topics/${topicOneId}/lessons`, { headers: BEARER(token) })
		).json();
		lessonAId = lessons.find((l: { title: string }) => l.title === 'API Lesson A Renamed').id;
	});

	test.afterAll(async () => {
		await page.close();
	});

	test('an Attachment is uploaded, listed on its Lesson, refused when unfit, and removed', async ({
		request
	}) => {
		const pdf = {
			name: 'worksheet.pdf',
			mimeType: 'application/pdf',
			buffer: Buffer.from('%PDF-1.4 test')
		};

		const created = await request.post(`/api/lessons/${lessonAId}/attachments`, {
			headers: BEARER(token),
			multipart: { file: pdf }
		});
		expect(created.status()).toBe(201);
		const attachment = await created.json();
		expect(keysOf(attachment)).toEqual([
			'filename',
			'id',
			'lessonId',
			'mimeType',
			'position',
			'size'
		]);
		expect(attachment).toMatchObject({
			lessonId: lessonAId,
			filename: 'worksheet.pdf',
			mimeType: 'application/pdf',
			size: pdf.buffer.length,
			position: 0
		});

		const onDisk = join('attachments', attachment.id);
		expect(existsSync(onDisk)).toBe(true);

		const detail = await request.get(`/api/lessons/${lessonAId}`, { headers: BEARER(token) });
		expect((await detail.json()).attachments).toEqual([attachment]);

		const unsupported = await request.post(`/api/lessons/${lessonAId}/attachments`, {
			headers: BEARER(token),
			multipart: { file: { name: 'photo.png', mimeType: 'image/png', buffer: Buffer.from('x') } }
		});
		expect(unsupported.status()).toBe(400);
		expect(typeof (await unsupported.json()).error).toBe('string');

		const oversized = await request.post(`/api/lessons/${lessonAId}/attachments`, {
			headers: BEARER(token),
			multipart: {
				file: { ...pdf, buffer: Buffer.alloc(10 * 1024 * 1024 + 1) }
			}
		});
		expect(oversized.status()).toBe(400);
		expect(typeof (await oversized.json()).error).toBe('string');

		const noFile = await request.post(`/api/lessons/${lessonAId}/attachments`, {
			headers: BEARER(token),
			multipart: { note: 'no file here' }
		});
		expect(noFile.status()).toBe(400);

		const missingLesson = await request.post('/api/lessons/does-not-exist/attachments', {
			headers: BEARER(token),
			multipart: { file: pdf }
		});
		expect(missingLesson.status()).toBe(404);
		expect(await missingLesson.json()).toEqual({ error: 'Lesson not found.' });

		const after = await request.get(`/api/lessons/${lessonAId}`, { headers: BEARER(token) });
		expect((await after.json()).attachments).toHaveLength(1);

		const keyless = await request.post(`/api/lessons/${lessonAId}/attachments`, {
			multipart: { file: pdf }
		});
		expect(keyless.status()).toBe(401);
		const keylessDelete = await request.delete(`/api/attachments/${attachment.id}`);
		expect(keylessDelete.status()).toBe(401);

		const remove = await request.delete(`/api/attachments/${attachment.id}`, {
			headers: BEARER(token)
		});
		expect(remove.status()).toBe(204);
		expect(await remove.text()).toBe('');
		expect(existsSync(onDisk)).toBe(false);

		const gone = await request.get(`/api/lessons/${lessonAId}`, { headers: BEARER(token) });
		expect((await gone.json()).attachments).toEqual([]);

		const removeAgain = await request.delete(`/api/attachments/${attachment.id}`, {
			headers: BEARER(token)
		});
		expect(removeAgain.status()).toBe(404);
	});
});
