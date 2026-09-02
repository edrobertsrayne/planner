import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { createCourse, createLesson } from './authoring';
import { AttachmentRejected, attachmentsDir, createAttachment } from './index';
import { makeTopic, setUpAuthoring } from './fixtures';

const MB = 1024 * 1024;

// A Lesson with its attachments directory derived exactly the way production derives it —
// from the fixture database's path — so every test proves rows and files together.
function setUpLesson() {
	const { db, dir } = setUpAuthoring();
	const atDir = attachmentsDir(join(dir, 'test.db'));
	const course = createCourse(db, { name: 'Year 9 Physics' });
	const topic = makeTopic(db, course.id, 'Forces');
	const lesson = createLesson(db, { topicId: topic.id, title: 'Newton I', today: '2026-09-03' });
	return { db, lesson, atDir };
}

describe('attachment storage', () => {
	test('a valid file is stored beside the database and its row appended in order', () => {
		const { db, lesson, atDir } = setUpLesson();
		const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);

		const first = createAttachment(
			db,
			{ lessonId: lesson.id, filename: 'worksheet.pdf', mimeType: 'application/pdf', bytes },
			atDir
		);
		const second = createAttachment(
			db,
			{ lessonId: lesson.id, filename: 'Worksheet.PDF', mimeType: 'Application/PDF', bytes },
			atDir
		);

		expect(first.filename).toBe('worksheet.pdf');
		expect(first.size).toBe(bytes.length);
		expect(first.position).toBe(0);
		expect(second.position).toBe(1);

		// The file lives at the derived path, named by the row's own id, with identical bytes.
		expect(readFileSync(join(atDir, first.id)).equals(Buffer.from(bytes))).toBe(true);
		expect(readFileSync(join(atDir, second.id)).equals(Buffer.from(bytes))).toBe(true);
		expect(existsSync(join(atDir, first.id + '.pdf'))).toBe(false);
	});

	test('exactly 10 MiB passes and one byte over refuses', () => {
		const { db, lesson, atDir } = setUpLesson();

		const at = createAttachment(
			db,
			{
				lessonId: lesson.id,
				filename: 'at-the-limit.pdf',
				mimeType: 'application/pdf',
				bytes: new Uint8Array(10 * MB)
			},
			atDir
		);
		expect(at.size).toBe(10 * MB);

		expect(() =>
			createAttachment(
				db,
				{
					lessonId: lesson.id,
					filename: 'over-the-limit.pdf',
					mimeType: 'application/pdf',
					bytes: new Uint8Array(10 * MB + 1)
				},
				atDir
			)
		).toThrow(AttachmentRejected);
		expect(existsSync(join(atDir, 'over-the-limit.pdf'))).toBe(false);
	});

	test('a disallowed extension is refused and leaves nothing behind, not even the directory', () => {
		const { db, lesson, atDir } = setUpLesson();

		expect(() =>
			createAttachment(
				db,
				{
					lessonId: lesson.id,
					filename: 'setup.exe',
					mimeType: 'application/octet-stream',
					bytes: new Uint8Array(4)
				},
				atDir
			)
		).toThrow(AttachmentRejected);
		expect(() =>
			createAttachment(
				db,
				{
					lessonId: lesson.id,
					filename: 'no-extension',
					mimeType: 'text/plain',
					bytes: new Uint8Array(4)
				},
				atDir
			)
		).toThrow(AttachmentRejected);

		expect(existsSync(atDir)).toBe(false);
	});

	test('a filename ending in an inherited object key is refused cleanly', () => {
		const { db, lesson, atDir } = setUpLesson();

		for (const filename of ['notes.constructor', 'notes.__proto__']) {
			expect(() =>
				createAttachment(
					db,
					{ lessonId: lesson.id, filename, mimeType: 'text/plain', bytes: new Uint8Array(4) },
					atDir
				)
			).toThrow(AttachmentRejected);
		}
		expect(existsSync(atDir)).toBe(false);
	});

	test('a file whose declared type disagrees with its extension is refused', () => {
		const { db, lesson, atDir } = setUpLesson();

		expect(() =>
			createAttachment(
				db,
				{
					lessonId: lesson.id,
					filename: 'notes.txt',
					mimeType: 'application/pdf',
					bytes: new Uint8Array(4)
				},
				atDir
			)
		).toThrow(AttachmentRejected);
		expect(() =>
			createAttachment(
				db,
				{
					lessonId: lesson.id,
					filename: 'worksheet.pdf',
					mimeType: 'text/plain',
					bytes: new Uint8Array(4)
				},
				atDir
			)
		).toThrow(AttachmentRejected);

		expect(existsSync(atDir)).toBe(false);
	});

	test('text and Office files the browser reports generically are accepted', () => {
		const { db, lesson, atDir } = setUpLesson();
		const bytes = new Uint8Array(4);

		const md = createAttachment(
			db,
			{
				lessonId: lesson.id,
				filename: 'notes.md',
				mimeType: 'application/octet-stream',
				bytes
			},
			atDir
		);
		// An empty reported type normalises to the generic one, so the serving route never
		// sends an empty Content-Type.
		const txt = createAttachment(
			db,
			{ lessonId: lesson.id, filename: 'notes.txt', mimeType: '', bytes },
			atDir
		);
		const docx = createAttachment(
			db,
			{
				lessonId: lesson.id,
				filename: 'test.docx',
				mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
				bytes
			},
			atDir
		);

		expect(md.mimeType).toBe('application/octet-stream');
		expect(txt.mimeType).toBe('application/octet-stream');
		expect(docx.mimeType).toBe(
			'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
		);
	});

	test('two Attachments with the same original filename coexist', () => {
		const { db, lesson, atDir } = setUpLesson();
		const bytes = new Uint8Array(4);

		const first = createAttachment(
			db,
			{ lessonId: lesson.id, filename: 'worksheet.pdf', mimeType: 'application/pdf', bytes },
			atDir
		);
		const second = createAttachment(
			db,
			{ lessonId: lesson.id, filename: 'worksheet.pdf', mimeType: 'application/pdf', bytes },
			atDir
		);

		expect(first.id).not.toBe(second.id);
		expect(existsSync(join(atDir, first.id))).toBe(true);
		expect(existsSync(join(atDir, second.id))).toBe(true);
	});

	test('a create that fails halfway leaves neither row nor file', () => {
		const { db, atDir } = setUpLesson();

		expect(() =>
			createAttachment(
				db,
				{
					lessonId: 'does-not-exist',
					filename: 'worksheet.pdf',
					mimeType: 'application/pdf',
					bytes: new Uint8Array(4)
				},
				atDir
			)
		).toThrow();

		expect(readdirSync(atDir)).toEqual([]);
	});

	test('the attachments directory is derived from the database path', () => {
		expect(attachmentsDir('/app/data/planner.db')).toBe('/app/data/attachments');
		expect(attachmentsDir('e2e.db')).toBe('attachments');
	});
});
