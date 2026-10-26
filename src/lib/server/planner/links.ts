// Links — the URLs a Lesson points at. Ordered within their Lesson, like Lessons within a Topic,
// and never a scheduling input: no Link write re-derives anything.
import { asc, eq } from 'drizzle-orm';
import * as schema from '../db/schema';
import { nextPosition, swapTargets, type Direction } from './ordering';
import { linkUrl, required } from './fields';
import type { Db } from './derive';

export function linksOf(db: Db, lessonId: string) {
	return db
		.select()
		.from(schema.link)
		.where(eq(schema.link.lessonId, lessonId))
		.orderBy(asc(schema.link.position))
		.all();
}

// A PATCH reads the stored pair before merging the fields the body names. An unknown id returns
// undefined, the door's 404.
export function linkById(db: Db, id: string) {
	const [row] = db.select().from(schema.link).where(eq(schema.link.id, id)).all();
	return row;
}

// Appended at the next position in its Lesson's order, same as a Lesson within a Topic.
export function createLink(
	db: Db,
	{ lessonId, url, label }: { lessonId: string; url: string; label: string }
) {
	label = required(label, 'A Link needs a label.');
	url = linkUrl(url);
	const position = nextPosition(
		db
			.select({ position: schema.link.position })
			.from(schema.link)
			.where(eq(schema.link.lessonId, lessonId))
			.all()
	);

	const [row] = db.insert(schema.link).values({ lessonId, url, label, position }).returning().all();
	return row;
}

export function updateLink(db: Db, { id, url, label }: { id: string; url: string; label: string }) {
	const [row] = db
		.update(schema.link)
		.set({ label: required(label, 'A Link needs a label.'), url: linkUrl(url) })
		.where(eq(schema.link.id, id))
		.returning()
		.all();
	return row;
}

export function deleteLink(db: Db, { id }: { id: string }) {
	const [row] = db.delete(schema.link).where(eq(schema.link.id, id)).returning().all();
	return row ?? null;
}

// Swaps position with the previous or next Link in the same Lesson. Off either end is a no-op —
// there is no wraparound and no error.
export function moveLink(
	db: Db,
	{ lessonId, id, direction }: { lessonId: string; id: string; direction: Direction }
) {
	const swap = swapTargets(linksOf(db, lessonId), id, direction);
	if (!swap) return;

	const [a, b] = swap;
	db.update(schema.link).set({ position: b.position }).where(eq(schema.link.id, a.id)).run();
	db.update(schema.link).set({ position: a.position }).where(eq(schema.link.id, b.id)).run();
}
