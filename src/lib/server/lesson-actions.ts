import type { Actions } from '@sveltejs/kit';
import { today } from '$lib/date';
import { DATABASE_URL, db } from '$lib/server/db/client';
import { formAction, found, trimmed } from '$lib/server/form';
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
	Refused,
	reportOf,
	updateLink,
	type LessonChange,
	type WriteReport
} from '$lib/server/planner';

// A Lesson write answers with the Lesson and its Rewind report as one `report` field.
const edited = <L>(result: { lesson: L } & WriteReport) => ({
	lesson: result.lesson,
	report: reportOf(result)
});

// The four edits differ only in the change they send; the read, the 404 and the answer are the
// same write. One body, so a new edit cannot forget the report or the missing-row answer.
const editAction = (change: (data: FormData) => LessonChange) =>
	formAction((data) => {
		const result = editLesson(db, {
			id: trimmed(data, 'id'),
			change: change(data),
			today: today()
		});
		return edited(found(result, 'Lesson'));
	});

// The lesson-editing actions the Lesson editor posts. Planning shares only setLessonStatus, the
// one status toggle its rows carry.
export const lessonActions = {
	updateLesson: editAction((data) => ({
		title: String(data.get('title') ?? ''),
		body: String(data.get('body') ?? ''),
		length: Number(data.get('length'))
	})),

	setLessonStatus: editAction((data) => ({ status: String(data.get('status') ?? '') })),

	moveLessonToTopic: editAction((data) => ({ topicId: trimmed(data, 'topicId') })),

	// The Lesson keeps its title, plan, Tags, Links and Attachments and leaves its Topic; a Topic
	// can take it again (ADR-0026).
	detachLesson: editAction(() => ({ topicId: null })),

	createLink: formAction((data) => ({
		link: createLink(db, {
			lessonId: trimmed(data, 'lessonId'),
			label: String(data.get('label') ?? ''),
			url: String(data.get('url') ?? '')
		})
	})),

	updateLink: formAction((data) => ({
		link: found(
			updateLink(db, {
				id: trimmed(data, 'id'),
				label: String(data.get('label') ?? ''),
				url: String(data.get('url') ?? '')
			}),
			'Link'
		)
	})),

	// The seam writes the reason: a Lesson a Class has already been taught refuses with the Detach
	// hint, and one a Placement names with the Placement way out. A Lesson that a Sequence holds
	// throws an `unconfirmed` refusal, which the page's dialog asks again with `confirmed`.
	deleteLesson: formAction((data) => ({
		report: reportOf(
			found(
				deleteLesson(db, {
					id: trimmed(data, 'id'),
					today: today(),
					dir: attachmentsDir(DATABASE_URL),
					confirmed: trimmed(data, 'confirmed') === 'true'
				}),
				'Lesson'
			)
		)
	})),

	deleteLink: formAction((data) => {
		found(deleteLink(db, { id: trimmed(data, 'id') }), 'Link');
		return {};
	}),

	moveLink: formAction((data) => {
		const direction = trimmed(data, 'direction');
		if (direction !== 'up' && direction !== 'down') {
			throw new Refused('invalid', 'Bad direction.');
		}
		moveLink(db, { lessonId: trimmed(data, 'lessonId'), id: trimmed(data, 'id'), direction });
		return {};
	}),

	attachTag: formAction((data) => {
		// The seam trims what it stores (ADR-0025).
		attachTag(db, {
			lessonId: trimmed(data, 'lessonId'),
			name: String(data.get('name') ?? '')
		});
		return {};
	}),

	detachTag: formAction((data) => {
		detachTag(db, { lessonId: trimmed(data, 'lessonId'), tagId: trimmed(data, 'tagId') });
		return {};
	}),

	// Thin over the seam's create: read the multipart form, call create, and let a refusal ride
	// the standard failure payload — its message is already written for Ed, and the client's
	// toast convention shows it as-is. Anything else (a disk fault, a foreign-key violation) is a
	// server fault, not a bad request, and the wrapper rethrows it to reach the error page.
	createAttachment: formAction(async (data) => {
		const file = data.get('file');
		if (!(file instanceof File) || !file.name) {
			throw new Refused('invalid', 'Choose a file to attach.');
		}
		return {
			attachment: createAttachment(
				db,
				{
					lessonId: trimmed(data, 'lessonId'),
					filename: file.name,
					mimeType: file.type,
					bytes: new Uint8Array(await file.arrayBuffer())
				},
				attachmentsDir(DATABASE_URL)
			)
		};
	}),

	deleteAttachment: formAction((data) => {
		found(deleteAttachment(db, trimmed(data, 'id'), attachmentsDir(DATABASE_URL)), 'Attachment');
		return {};
	})
} satisfies Actions;
