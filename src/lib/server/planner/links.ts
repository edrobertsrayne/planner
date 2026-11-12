// Links — the URLs a Lesson or a Class points at (ADR-0032). Ordered within their owner, like
// Lessons within a Topic, and never a scheduling input: no Link write re-derives anything.
import { asc, eq } from 'drizzle-orm';
import * as schema from '../db/schema';
import { nextPosition, swapTargets, type Direction } from './ordering';
import { linkUrl, required } from './fields';
import { ownedBy, ownedRow, ownerColumns, requireOwner, type Owner } from './owner';
import type { Db } from './derive';

export function linksOf(db: Db, owner: Owner) {
	return db
		.select()
		.from(schema.link)
		.where(ownedBy(schema.link, owner))
		.orderBy(asc(schema.link.position))
		.all()
		.map(ownedRow);
}

// A PATCH reads the stored pair before merging the fields the body names. An unknown id returns
// undefined, the door's 404.
export function linkById(db: Db, id: string) {
	const [row] = db.select().from(schema.link).where(eq(schema.link.id, id)).all();
	return row && ownedRow(row);
}

// Appended at the next position in its owner's order, same as a Lesson within a Topic.
export function createLink(db: Db, input: Owner & { url: string; label: string }) {
	const label = required(input.label, 'A Link needs a label.');
	const url = linkUrl(input.url);
	requireOwner(db, input);
	const position = nextPosition(
		db
			.select({ position: schema.link.position })
			.from(schema.link)
			.where(ownedBy(schema.link, input))
			.all()
	);

	const [row] = db
		.insert(schema.link)
		.values({ ...ownerColumns(input), url, label, position })
		.returning()
		.all();
	return ownedRow(row);
}

export function updateLink(db: Db, { id, url, label }: { id: string; url: string; label: string }) {
	const [row] = db
		.update(schema.link)
		.set({ label: required(label, 'A Link needs a label.'), url: linkUrl(url) })
		.where(eq(schema.link.id, id))
		.returning()
		.all();
	return row && ownedRow(row);
}

export function deleteLink(db: Db, { id }: { id: string }) {
	const [row] = db.delete(schema.link).where(eq(schema.link.id, id)).returning().all();
	return row ?? null;
}

// Swaps position with the previous or next Link of the same owner. Off either end is a no-op —
// there is no wraparound and no error.
export function moveLink(
	db: Db,
	{ id, direction, ...owner }: Owner & { id: string; direction: Direction }
) {
	const swap = swapTargets(linksOf(db, owner), id, direction);
	if (!swap) return;

	const [a, b] = swap;
	db.update(schema.link).set({ position: b.position }).where(eq(schema.link.id, a.id)).run();
	db.update(schema.link).set({ position: a.position }).where(eq(schema.link.id, b.id)).run();
}
