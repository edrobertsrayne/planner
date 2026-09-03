import { fail, type Actions } from '@sveltejs/kit';
import { today } from '$lib/date';
import { DATABASE_URL, db } from '$lib/server/db/client';
import { badRequest, trimmed } from '$lib/server/form';
import {
	AttachmentRejected,
	attachmentsDir,
	createAttachment,
	createLink,
	deleteAttachment,
	deleteLink,
	moveLessonToTopic,
	moveLink,
	setLessonStatus,
	updateLesson,
	updateLink
} from '$lib/server/planner';

// A Link's url is rendered as a real href — restricting it to http(s) keeps a javascript: URL
// from ever reaching an anchor, since the editor's own href-taking rows would otherwise execute it.
function isHttpUrl(url: string) {
	try {
		return ['http:', 'https:'].includes(new URL(url).protocol);
	} catch {
		return false;
	}
}

// The lesson-editing actions the Courses view and the Planning board share — the Lesson editor
// posts to the same nine actions whichever screen opens it over.
export const lessonActions = {
	updateLesson: async ({ request }) => {
		const data = await request.formData();
		const id = trimmed(data, 'id');
		const title = trimmed(data, 'title');
		if (!title) return fail(400, { error: 'A Lesson needs a title.' });
		const body = String(data.get('body') ?? '').trim() || null;
		const length = Math.max(1, Math.round(Number(data.get('length'))) || 1);
		const lesson = updateLesson(db, { id, title, body, length, today: today() });
		if (!lesson) return fail(404, { error: 'No such Lesson.' });
		return { lesson };
	},

	setLessonStatus: async ({ request }) => {
		const data = await request.formData();
		const id = trimmed(data, 'id');
		const status = trimmed(data, 'status');
		if (status !== 'draft' && status !== 'planned') {
			return fail(400, { error: 'Bad status.' });
		}
		const lesson = setLessonStatus(db, id, status);
		if (!lesson) return fail(404, { error: 'No such Lesson.' });
		return { lesson };
	},

	moveLessonToTopic: async ({ request }) => {
		const data = await request.formData();
		const id = trimmed(data, 'id');
		const topicId = trimmed(data, 'topicId');
		if (!topicId) return fail(400, { error: 'Pick a Topic.' });
		const lesson = moveLessonToTopic(db, { id, topicId, today: today() });
		if (!lesson) return fail(404, { error: 'No such Lesson.' });
		return { lesson };
	},

	createLink: async ({ request }) => {
		const data = await request.formData();
		const lessonId = trimmed(data, 'lessonId');
		const label = trimmed(data, 'label');
		const url = trimmed(data, 'url');
		if (!label) return fail(400, { error: 'A Link needs a label.' });
		if (!url) return fail(400, { error: 'A Link needs a url.' });
		if (!isHttpUrl(url)) return fail(400, { error: 'A Link must be an http(s) URL.' });
		return { link: createLink(db, { lessonId, label, url }) };
	},

	updateLink: async ({ request }) => {
		const data = await request.formData();
		const id = trimmed(data, 'id');
		const label = trimmed(data, 'label');
		const url = trimmed(data, 'url');
		if (!label) return fail(400, { error: 'A Link needs a label.' });
		if (!url) return fail(400, { error: 'A Link needs a url.' });
		if (!isHttpUrl(url)) return fail(400, { error: 'A Link must be an http(s) URL.' });
		const link = updateLink(db, { id, label, url });
		if (!link) return fail(404, { error: 'No such Link.' });
		return { link };
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

	// Thin over the seam's create: read the multipart form, call create, and let a validation
	// refusal ride the standard failure payload — its message is already written for Ed, and the
	// client's toast convention shows it as-is.
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
			// Only a validation refusal the seam has already written for Ed rides the standard
			// failure payload — anything else (a disk fault, a foreign-key violation) is a server
			// fault, not a bad request, and should reach the error page and the log like any other.
			if (error instanceof AttachmentRejected)
				return badRequest(error, 'Could not attach the file.');
			throw error;
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
