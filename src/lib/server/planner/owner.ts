// What holds a Link or an Attachment: a Lesson or a Class, never both and never neither
// (ADR-0032). The database checks the same rule; this is the one place the seam turns an owner
// into the row's columns, the filter that finds its rows, and the missing-row refusal.
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema';
import { requireRow } from './fields';
import type { Db } from './derive';

export type Owner = { lessonId: string; classId?: never } | { classId: string; lessonId?: never };

// The owner's own key alone, so a caller's other fields never reach the row through it.
export function ownerColumns(owner: Owner) {
	return owner.classId !== undefined ? { classId: owner.classId } : { lessonId: owner.lessonId };
}

export function ownedBy(table: typeof schema.link | typeof schema.attachment, owner: Owner) {
	return owner.classId !== undefined
		? eq(table.classId, owner.classId)
		: eq(table.lessonId, owner.lessonId);
}

export function requireOwner(db: Db, owner: Owner): void {
	if (owner.classId !== undefined)
		requireRow(db, schema.classes, owner.classId, 'Class not found.');
	else requireRow(db, schema.lesson, owner.lessonId, 'Lesson not found.');
}

// A row as the seam hands it out: its one owner's key and never the other's null, so a Lesson's
// Link or Attachment reads exactly as it did before a Class could hold one (docs/api.md).
export function ownedRow<R extends { lessonId: string | null; classId: string | null }>({
	lessonId,
	classId,
	...rest
}: R): Omit<R, 'lessonId' | 'classId'> & Owner {
	return { ...rest, ...(classId !== null ? { classId } : { lessonId: lessonId as string }) };
}
