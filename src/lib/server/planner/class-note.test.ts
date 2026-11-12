import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { makeTopic, refused, setUp } from './fixtures';
import {
	attachmentsOf,
	classDetail,
	createAttachment,
	createLesson,
	createLink,
	deleteClass,
	linksOf,
	moveLink,
	setClassNote
} from './index';
import * as schema from '../db/schema';

const pdf = (filename: string) => ({
	filename,
	mimeType: 'application/pdf',
	bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46])
});

describe('the Class note (ADR-0032)', () => {
	test('is one markdown entry the Class reads back as typed', () => {
		const { db, classA, classB } = setUp();

		setClassNote(db, { classId: classA.id, note: '## Room\n\n- Lab S4 on **Mon**\n' });

		expect(classDetail(db, classA.id)?.note).toBe('## Room\n\n- Lab S4 on **Mon**\n');
		expect(classDetail(db, classB.id)?.note).toBeNull();
	});

	test('a new note replaces the old, and a blank one clears it', () => {
		const { db, classA } = setUp();

		setClassNote(db, { classId: classA.id, note: 'First' });
		setClassNote(db, { classId: classA.id, note: 'Second' });
		expect(classDetail(db, classA.id)?.note).toBe('Second');

		setClassNote(db, { classId: classA.id, note: '  \n ' });
		expect(classDetail(db, classA.id)?.note).toBeNull();
	});

	test('refuses a Class that is not there', () => {
		const { db } = setUp();
		refused(
			() => setClassNote(db, { classId: 'missing', note: 'x' }),
			'missing',
			'Class not found.'
		);
	});
});

describe("a Class's own Links and Attachments (ADR-0032)", () => {
	test('a Class holds Links in its own order, apart from any Lesson', () => {
		const { db, course, classA, classB } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		const { lesson } = createLesson(db, { topicId: topic.id, title: 'Newton I' });
		createLink(db, { lessonId: lesson.id, label: 'Lesson link', url: 'https://a.example' });

		const folder = createLink(db, {
			classId: classA.id,
			label: 'Class folder',
			url: 'https://drive.example'
		});
		const seneca = createLink(db, {
			classId: classA.id,
			label: 'Seneca',
			url: 'https://seneca.example'
		});
		moveLink(db, { classId: classA.id, id: seneca.id, direction: 'up' });

		expect(linksOf(db, { classId: classA.id }).map((l) => l.label)).toEqual([
			'Seneca',
			'Class folder'
		]);
		expect(folder).toMatchObject({ classId: classA.id });
		expect(folder).not.toHaveProperty('lessonId');
		expect(linksOf(db, { classId: classB.id })).toEqual([]);
		expect(linksOf(db, { lessonId: lesson.id }).map((l) => l.label)).toEqual(['Lesson link']);
	});

	test('a Link for a Class that is not there is refused', () => {
		const { db } = setUp();
		refused(
			() => createLink(db, { classId: 'missing', label: 'x', url: 'https://x.example' }),
			'missing',
			'Class not found.'
		);
	});

	test('a Class holds Attachments, stored beside the database like a Lesson’s', () => {
		const { db, classA, atDir } = setUp();

		const row = createAttachment(db, { classId: classA.id, ...pdf('Seating plan.pdf') }, atDir);

		expect(row).toMatchObject({ classId: classA.id, position: 0 });
		expect(row).not.toHaveProperty('lessonId');
		expect(attachmentsOf(db, { classId: classA.id }).map((a) => a.filename)).toEqual([
			'Seating plan.pdf'
		]);
		expect(existsSync(join(atDir, row.id))).toBe(true);
	});

	test('the database refuses a Link or an Attachment with no owner, or with two', () => {
		const { db, course, classA } = setUp();
		const topic = makeTopic(db, course.id, 'Forces');
		const { lesson } = createLesson(db, { topicId: topic.id, title: 'Newton I' });
		const base = { url: 'https://x.example', label: 'x', position: 0 };

		// Drizzle wraps the driver's error; the refusal itself is the cause.
		const refusal = (insert: () => unknown) => {
			try {
				insert();
			} catch (error) {
				return String((error as Error).cause);
			}
		};
		expect(refusal(() => db.insert(schema.link).values(base).run())).toMatch(/CHECK/);
		expect(
			refusal(() =>
				db
					.insert(schema.link)
					.values({ ...base, lessonId: lesson.id, classId: classA.id })
					.run()
			)
		).toMatch(/CHECK/);
		expect(
			refusal(() =>
				db
					.insert(schema.attachment)
					.values({ filename: 'a.pdf', mimeType: 'application/pdf', size: 1, position: 0 })
					.run()
			)
		).toMatch(/CHECK/);
	});

	test('deleting a Class asks first, naming its note, Links and Attachments', () => {
		const { db, classA, atDir } = setUp();
		setClassNote(db, { classId: classA.id, note: 'Lab S4' });
		createLink(db, { classId: classA.id, label: 'Folder', url: 'https://drive.example' });
		createLink(db, { classId: classA.id, label: 'Seneca', url: 'https://seneca.example' });
		createAttachment(db, { classId: classA.id, ...pdf('Seating plan.pdf') }, atDir);

		refused(
			() => deleteClass(db, { id: classA.id, today: '2026-09-14', dir: atDir }),
			'unconfirmed',
			'Its timetable, its 0 Sessions and its 0 Teaching notes go with it. ' +
				'So do its Class note, its 2 Links and its 1 Attachment.'
		);
	});

	test('deleting a Class takes its note, Links and Attachments, files included', () => {
		const { db, classA, classB, atDir } = setUp();
		setClassNote(db, { classId: classA.id, note: 'Lab S4' });
		createLink(db, { classId: classA.id, label: 'Folder', url: 'https://drive.example' });
		const gone = createAttachment(db, { classId: classA.id, ...pdf('Seating plan.pdf') }, atDir);
		const kept = createAttachment(db, { classId: classB.id, ...pdf('Other.pdf') }, atDir);

		deleteClass(db, { id: classA.id, today: '2026-09-14', confirmed: true, dir: atDir });

		expect(db.select().from(schema.link).all()).toEqual([]);
		expect(
			db
				.select()
				.from(schema.attachment)
				.all()
				.map((a) => a.id)
		).toEqual([kept.id]);
		expect(readdirSync(atDir)).toEqual([kept.id]);
		expect(existsSync(join(atDir, gone.id))).toBe(false);
	});
});
