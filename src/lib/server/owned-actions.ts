import type { Actions } from '@sveltejs/kit';
import { DATABASE_URL, db } from '$lib/server/db/client';
import { formAction, found, trimmed } from '$lib/server/form';
import {
	attachmentsDir,
	createAttachment,
	createLink,
	deleteAttachment,
	deleteLink,
	moveLink,
	Refused,
	updateLink,
	type Owner
} from '$lib/server/planner';

// The owner a Link or Attachment form names: a Class's forms send `classId`, a Lesson's
// `lessonId` (ADR-0032). Parsed once here, so every action below hands the seam one Owner.
function ownerOf(data: FormData): Owner {
	const classId = trimmed(data, 'classId');
	return classId ? { classId } : { lessonId: trimmed(data, 'lessonId') };
}

// The Link and Attachment actions, shared by every page that holds them: the Lesson editor and
// the Class page's Overview.
export const ownedActions = {
	createLink: formAction((data) => ({
		link: createLink(db, {
			...ownerOf(data),
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

	deleteLink: formAction((data) => {
		found(deleteLink(db, { id: trimmed(data, 'id') }), 'Link');
		return {};
	}),

	moveLink: formAction((data) => {
		const direction = trimmed(data, 'direction');
		if (direction !== 'up' && direction !== 'down') {
			throw new Refused('invalid', 'Bad direction.');
		}
		moveLink(db, { ...ownerOf(data), id: trimmed(data, 'id'), direction });
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
					...ownerOf(data),
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
