import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import {
	createCourse,
	createLesson,
	createLink,
	createTopic,
	deleteLesson,
	lessonDetail,
	moveLessonToTopic
} from './authoring';
import {
	assignTopic,
	AttachmentRejected,
	attachmentById,
	attachmentsDir,
	attachmentsOf,
	classSchedule,
	createAttachment,
	deleteAttachment
} from './index';
import { makeLessons, makeTopic, setUp, setUpAuthoring } from './fixtures';
import * as schema from '../db/schema';

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

		// The files live at the derived path, named by each row's own id with no extension, and
		// they are the only files the create writes.
		expect(readFileSync(join(atDir, first.id)).equals(Buffer.from(bytes))).toBe(true);
		expect(readFileSync(join(atDir, second.id)).equals(Buffer.from(bytes))).toBe(true);
		expect(readdirSync(atDir).sort()).toEqual([first.id, second.id].sort());
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

	test("attachmentsOf returns a Lesson's Attachments in position order, the read the Lesson editor's load composes with lessonDetail", () => {
		const { db, lesson, atDir } = setUpLesson();
		const slides = createAttachment(
			db,
			{
				lessonId: lesson.id,
				filename: 'slides.pptx',
				mimeType: 'application/octet-stream',
				bytes: new Uint8Array(2)
			},
			atDir
		);
		const worksheet = createAttachment(
			db,
			{
				lessonId: lesson.id,
				filename: 'worksheet.pdf',
				mimeType: 'application/pdf',
				bytes: new Uint8Array(1)
			},
			atDir
		);
		createLink(db, { lessonId: lesson.id, label: 'PhET', url: 'https://phet.example' });

		expect(attachmentsOf(db, lesson.id).map((a) => a.id)).toEqual([slides.id, worksheet.id]);
		expect(lessonDetail(db, lesson.id)!.links).toHaveLength(1);
	});

	test('attachmentById resolves the row for a real id and is undefined for a lookup miss', () => {
		const { db, lesson, atDir } = setUpLesson();
		const worksheet = createAttachment(
			db,
			{
				lessonId: lesson.id,
				filename: 'worksheet.pdf',
				mimeType: 'application/pdf',
				bytes: new Uint8Array(1)
			},
			atDir
		);

		expect(attachmentById(db, worksheet.id)?.id).toBe(worksheet.id);
		expect(attachmentById(db, 'no-such-id')).toBeUndefined();
		expect(attachmentById(db, '../../package.json')).toBeUndefined();
	});

	test('the attachments directory is derived from the database path', () => {
		expect(attachmentsDir('/app/data/planner.db')).toBe('/app/data/attachments');
		expect(attachmentsDir('e2e.db')).toBe('attachments');
	});
});

describe('removing an Attachment', () => {
	test('a direct delete removes the row and unlinks the file', () => {
		const { db, lesson, atDir } = setUpLesson();
		const kept = createAttachment(
			db,
			{
				lessonId: lesson.id,
				filename: 'slides.pptx',
				mimeType: 'application/octet-stream',
				bytes: new Uint8Array(1)
			},
			atDir
		);
		const removed = createAttachment(
			db,
			{
				lessonId: lesson.id,
				filename: 'worksheet.pdf',
				mimeType: 'application/pdf',
				bytes: new Uint8Array(2)
			},
			atDir
		);

		const result = deleteAttachment(db, removed.id, atDir);

		expect(result?.id).toBe(removed.id);
		expect(attachmentsOf(db, lesson.id).map((a) => a.id)).toEqual([kept.id]);
		expect(existsSync(join(atDir, removed.id))).toBe(false);
		expect(existsSync(join(atDir, kept.id))).toBe(true);
	});

	test('a missing row is a no-op, and a missing file at delete time is swallowed', () => {
		const { db, lesson, atDir } = setUpLesson();
		expect(deleteAttachment(db, 'does-not-exist', atDir)).toBeUndefined();

		const attachment = createAttachment(
			db,
			{
				lessonId: lesson.id,
				filename: 'worksheet.pdf',
				mimeType: 'application/pdf',
				bytes: new Uint8Array(2)
			},
			atDir
		);
		// The file is already gone by some other means — ENOENT at unlink time is the desired
		// end state, not a failure to report.
		rmSync(join(atDir, attachment.id));

		expect(() => deleteAttachment(db, attachment.id, atDir)).not.toThrow();
		expect(attachmentsOf(db, lesson.id)).toEqual([]);
	});
});

describe("an Attachment's lifecycle follows its Lesson", () => {
	test('deleting a Lesson removes every Attachment row and unlinks every file', () => {
		const { db, lesson, atDir } = setUpLesson();
		const first = createAttachment(
			db,
			{
				lessonId: lesson.id,
				filename: 'slides.pptx',
				mimeType: 'application/octet-stream',
				bytes: new Uint8Array(1)
			},
			atDir
		);
		const second = createAttachment(
			db,
			{
				lessonId: lesson.id,
				filename: 'worksheet.pdf',
				mimeType: 'application/pdf',
				bytes: new Uint8Array(2)
			},
			atDir
		);

		const result = deleteLesson(db, { id: lesson.id, today: '2026-09-03', dir: atDir });

		expect(result.ok).toBe(true);
		expect(existsSync(join(atDir, first.id))).toBe(false);
		expect(existsSync(join(atDir, second.id))).toBe(false);
	});

	test('Detaching a Lesson, or moving it to another Topic, leaves its Attachments untouched', () => {
		const { db, lesson, atDir } = setUpLesson();
		const attachment = createAttachment(
			db,
			{
				lessonId: lesson.id,
				filename: 'worksheet.pdf',
				mimeType: 'application/pdf',
				bytes: new Uint8Array(2)
			},
			atDir
		);

		moveLessonToTopic(db, { id: lesson.id, topicId: null, today: '2026-09-03' });
		expect(attachmentsOf(db, lesson.id).map((a) => a.id)).toEqual([attachment.id]);
		expect(existsSync(join(atDir, attachment.id))).toBe(true);

		const [course] = db.select().from(schema.course).all();
		const otherTopic = createTopic(db, { courseId: course.id, name: 'Waves' });
		moveLessonToTopic(db, { id: lesson.id, topicId: otherTopic.id, today: '2026-09-03' });
		expect(attachmentsOf(db, lesson.id).map((a) => a.id)).toEqual([attachment.id]);
		expect(existsSync(join(atDir, attachment.id))).toBe(true);
	});

	test('a refused Lesson deletion leaves its Attachment rows and files untouched', () => {
		const { db, course, classA, dir } = setUp();
		const atDir = attachmentsDir(join(dir, 'test.db'));
		const topic = makeTopic(db, course.id, 'Forces');
		const [lesson] = makeLessons(db, topic.id, 1);
		assignTopic(db, { classId: classA.id, topicId: topic.id, today: '2026-09-03' });
		const attachment = createAttachment(
			db,
			{
				lessonId: lesson.id,
				filename: 'worksheet.pdf',
				mimeType: 'application/pdf',
				bytes: new Uint8Array(2)
			},
			atDir
		);

		// Far enough past the assignment date that 9B/Sc1's schedule has already reached and
		// taught this Lesson, so the delete is refused rather than confirmed.
		const result = deleteLesson(db, { id: lesson.id, today: '2026-09-10', dir: atDir });

		expect(result).toEqual({ ok: false, reason: 'taught' });
		expect(attachmentsOf(db, lesson.id).map((a) => a.id)).toEqual([attachment.id]);
		expect(existsSync(join(atDir, attachment.id))).toBe(true);
	});

	test('no Attachment write re-derives any Class schedule', () => {
		const { db, course, classA, dir } = setUp();
		const atDir = attachmentsDir(join(dir, 'test.db'));
		const topic = makeTopic(db, course.id, 'Forces');
		const [lesson] = makeLessons(db, topic.id, 1);
		assignTopic(db, { classId: classA.id, topicId: topic.id, today: '2026-09-03' });

		const today = '2026-09-10';
		const before = classSchedule(db, { classId: classA.id, today });

		const attachment = createAttachment(
			db,
			{
				lessonId: lesson.id,
				filename: 'worksheet.pdf',
				mimeType: 'application/pdf',
				bytes: new Uint8Array(2)
			},
			atDir
		);
		deleteAttachment(db, attachment.id, atDir);

		const after = classSchedule(db, { classId: classA.id, today });
		expect(after).toEqual(before);
	});
});
