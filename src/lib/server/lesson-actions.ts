import { fail, type Actions } from '@sveltejs/kit';
import { today } from '$lib/date';
import { DATABASE_URL, db } from '$lib/server/db/client';
import { refusal, trimmed } from '$lib/server/form';
import {
	attachTag,
	attachmentsDir,
	createAttachment,
	createLink,
	deleteAttachment,
	deleteLesson,
	deleteLink,
	detachTag,
	editLesson,
	moveLink,
	updateLink
} from '$lib/server/planner';

// The lesson-editing actions the Lesson editor and Planning share.
export const lessonActions = {
	updateLesson: async ({ request }) => {
		const data = await request.formData();
		const id = trimmed(data, 'id');
		const title = String(data.get('title') ?? '');
		const body = String(data.get('body') ?? '');
		const length = Number(data.get('length'));
		try {
			const result = editLesson(db, { id, change: { title, body, length }, today: today() });
			if (!result) return fail(404, { error: 'No such Lesson.' });
			return result;
		} catch (error) {
			return refusal(error);
		}
	},

	setLessonStatus: async ({ request }) => {
		const data = await request.formData();
		const id = trimmed(data, 'id');
		const status = String(data.get('status') ?? '');
		try {
			const result = editLesson(db, { id, change: { status }, today: today() });
			if (!result) return fail(404, { error: 'No such Lesson.' });
			return result;
		} catch (error) {
			return refusal(error);
		}
	},

	moveLessonToTopic: async ({ request }) => {
		const data = await request.formData();
		const id = trimmed(data, 'id');
		const topicId = trimmed(data, 'topicId');
		if (!topicId) return fail(400, { error: 'Pick a Topic.' });
		try {
			const result = editLesson(db, { id, change: { topicId }, today: today() });
			if (!result) return fail(404, { error: 'No such Lesson.' });
			return result;
		} catch (error) {
			return refusal(error);
		}
	},

	// One-way: the Lesson keeps its title, plan, Tags, Links and Attachments and leaves its Topic.
	detachLesson: async ({ request }) => {
		const data = await request.formData();
		const id = trimmed(data, 'id');
		try {
			const result = editLesson(db, { id, change: { topicId: null }, today: today() });
			if (!result) return fail(404, { error: 'No such Lesson.' });
			return result;
		} catch (error) {
			return refusal(error);
		}
	},

	createLink: async ({ request }) => {
		const data = await request.formData();
		const lessonId = trimmed(data, 'lessonId');
		const label = String(data.get('label') ?? '');
		const url = String(data.get('url') ?? '');
		try {
			return { link: createLink(db, { lessonId, label, url }) };
		} catch (error) {
			return refusal(error);
		}
	},

	updateLink: async ({ request }) => {
		const data = await request.formData();
		const id = trimmed(data, 'id');
		const label = String(data.get('label') ?? '');
		const url = String(data.get('url') ?? '');
		try {
			const link = updateLink(db, { id, label, url });
			if (!link) return fail(404, { error: 'No such Link.' });
			return { link };
		} catch (error) {
			return refusal(error);
		}
	},

	// The seam writes the reason: a Lesson a Class has already been taught refuses with the Detach
	// hint, and one a Placement names with the Placement way out.
	deleteLesson: async ({ request }) => {
		const data = await request.formData();
		const id = trimmed(data, 'id');
		try {
			const lesson = deleteLesson(db, { id, today: today(), dir: attachmentsDir(DATABASE_URL) });
			if (!lesson) return fail(404, { error: 'No such Lesson.' });
			return {};
		} catch (error) {
			return refusal(error);
		}
	},

	deleteLink: async ({ request }) => {
		const data = await request.formData();
		const id = trimmed(data, 'id');
		const link = deleteLink(db, { id });
		if (!link) return fail(404, { error: 'No such Link.' });
		return {};
	},

	moveLink: async ({ request }) => {
		const data = await request.formData();
		const lessonId = trimmed(data, 'lessonId');
		const id = trimmed(data, 'id');
		const direction = trimmed(data, 'direction');
		if (direction !== 'up' && direction !== 'down') return fail(400, { error: 'Bad direction.' });
		moveLink(db, { lessonId, id, direction });
		return {};
	},

	attachTag: async ({ request }) => {
		const data = await request.formData();
		const lessonId = trimmed(data, 'lessonId');
		const name = trimmed(data, 'name');
		try {
			attachTag(db, { lessonId, name });
			return {};
		} catch (error) {
			return refusal(error);
		}
	},

	detachTag: async ({ request }) => {
		const data = await request.formData();
		const lessonId = trimmed(data, 'lessonId');
		const tagId = trimmed(data, 'tagId');
		detachTag(db, { lessonId, tagId });
		return {};
	},

	// Thin over the seam's create: read the multipart form, call create, and let a refusal ride
	// the standard failure payload — its message is already written for Ed, and the client's
	// toast convention shows it as-is. Anything else (a disk fault, a foreign-key violation) is a
	// server fault, not a bad request, and `refusal` rethrows it to reach the error page.
	createAttachment: async ({ request }) => {
		const data = await request.formData();
		const lessonId = trimmed(data, 'lessonId');
		const file = data.get('file');
		if (!(file instanceof File) || !file.name) {
			return fail(400, { error: 'Choose a file to attach.' });
		}
		try {
			return {
				attachment: createAttachment(
					db,
					{
						lessonId,
						filename: file.name,
						mimeType: file.type,
						bytes: new Uint8Array(await file.arrayBuffer())
					},
					attachmentsDir(DATABASE_URL)
				)
			};
		} catch (error) {
			return refusal(error);
		}
	},

	deleteAttachment: async ({ request }) => {
		const data = await request.formData();
		const id = trimmed(data, 'id');
		const attachment = deleteAttachment(db, id, attachmentsDir(DATABASE_URL));
		if (!attachment) return fail(404, { error: 'No such Attachment.' });
		return {};
	}
} satisfies Actions;
