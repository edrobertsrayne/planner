// Bell Schedules: the clock times of the day (ADR-0033). They are read only by the views, so no
// write here re-derives a Class. Exactly one is the default once any exists, and a Class follows
// one from the moment the first is made.
import { and, asc, desc, eq, isNull, ne } from 'drizzle-orm';
import * as schema from '../db/schema';
import { inTransaction } from '../db';
import { TIMED_POSITIONS, type Bell, type BellSchedule, type BellTime } from '$lib/bell';
import type { Db } from './derive';
import { required, requireRow, sameName } from './fields';
import { Refused } from './refused';

const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;

const positionWord = (p: number) => (p === 8 ? 'Break' : p === 9 ? 'Lunch' : `P${p}`);

// Every Bell Schedule with its eight times, the default first and the rest by name.
export function listBellSchedules(db: Db): BellSchedule[] {
	const times = db.select().from(schema.bellTime).all();
	return db
		.select()
		.from(schema.bellSchedule)
		.orderBy(desc(schema.bellSchedule.isDefault), asc(schema.bellSchedule.name))
		.all()
		.map((s) => ({
			id: s.id,
			name: s.name,
			isDefault: s.isDefault,
			times: Object.fromEntries(
				times
					.filter((t) => t.scheduleId === s.id)
					.map((t) => [t.position, { starts: t.starts, ends: t.ends }])
			)
		}));
}

// What the Agenda, the Calendar and the Event page read to time their rows.
export function bellOf(db: Db): Bell {
	const classSchedules: Record<string, string> = {};
	for (const c of db
		.select({ id: schema.classes.id, scheduleId: schema.classes.scheduleId })
		.from(schema.classes)
		.all()) {
		if (c.scheduleId) classSchedules[c.id] = c.scheduleId;
	}
	return { schedules: listBellSchedules(db), classSchedules };
}

// Every time a real `HH:MM`, each ending after it starts, none overlapping another, and the
// Periods in their own order: anything else draws a day the school does not have.
function bellTimes(times: Record<number, BellTime>): Record<number, BellTime> {
	for (const p of TIMED_POSITIONS) {
		const t = times[p];
		if (!t || !CLOCK.test(t.starts) || !CLOCK.test(t.ends)) {
			throw new Refused('invalid', `${positionWord(p)} needs a start and an end time, as HH:MM.`);
		}
		if (t.starts >= t.ends) {
			throw new Refused('invalid', `${positionWord(p)} must end after it starts.`);
		}
	}
	for (let p = 2; p <= 6; p++) {
		if (times[p].starts < times[p - 1].starts) {
			throw new Refused('invalid', `P${p} cannot start before P${p - 1}.`);
		}
	}
	const sorted = [...TIMED_POSITIONS].sort((a, b) =>
		times[a].starts.localeCompare(times[b].starts)
	);
	for (let i = 1; i < sorted.length; i++) {
		const [before, after] = [sorted[i - 1], sorted[i]];
		if (times[before].ends > times[after].starts) {
			throw new Refused(
				'invalid',
				`${positionWord(before)} and ${positionWord(after)} overlap: one ends ${times[before].ends}, the next starts ${times[after].starts}.`
			);
		}
	}
	return times;
}

function writeTimes(db: Db, scheduleId: string, times: Record<number, BellTime>) {
	db.delete(schema.bellTime).where(eq(schema.bellTime.scheduleId, scheduleId)).run();
	for (const position of TIMED_POSITIONS) {
		db.insert(schema.bellTime)
			.values({ scheduleId, position, ...times[position] })
			.run();
	}
}

function uniqueName(db: Db, name: string, id: string | null) {
	const clash = db
		.select({ id: schema.bellSchedule.id })
		.from(schema.bellSchedule)
		.where(
			and(sameName(schema.bellSchedule.name, name), id ? ne(schema.bellSchedule.id, id) : undefined)
		)
		.all()[0];
	if (clash) throw new Refused('conflict', `A Bell Schedule called "${name}" already exists.`);
}

// Makes a Bell Schedule. The first one made is the default, and every Class follows it.
export function createBellSchedule(
	db: Db,
	input: { name: string; times: Record<number, BellTime> }
) {
	const name = required(input.name, 'A Bell Schedule needs a name.');
	const times = bellTimes(input.times);
	uniqueName(db, name, null);
	return inTransaction(db.$client, () => {
		const first = db.select().from(schema.bellSchedule).all().length === 0;
		const [row] = db
			.insert(schema.bellSchedule)
			.values({ name, isDefault: first })
			.returning()
			.all();
		writeTimes(db, row.id, times);
		if (first) {
			db.update(schema.classes)
				.set({ scheduleId: row.id })
				.where(isNull(schema.classes.scheduleId))
				.run();
		}
		return row;
	});
}

// Renames a Bell Schedule and replaces its eight times, as one document.
export function updateBellSchedule(
	db: Db,
	input: { id: string; name: string; times: Record<number, BellTime> }
) {
	requireRow(db, schema.bellSchedule, input.id, 'Bell Schedule not found.');
	const name = required(input.name, 'A Bell Schedule needs a name.');
	const times = bellTimes(input.times);
	uniqueName(db, name, input.id);
	return inTransaction(db.$client, () => {
		db.update(schema.bellSchedule).set({ name }).where(eq(schema.bellSchedule.id, input.id)).run();
		writeTimes(db, input.id, times);
	});
}

// Makes one Bell Schedule the default in place of the old one.
export function makeDefaultBellSchedule(db: Db, { id }: { id: string }) {
	requireRow(db, schema.bellSchedule, id, 'Bell Schedule not found.');
	inTransaction(db.$client, () => {
		db.update(schema.bellSchedule).set({ isDefault: false }).run();
		db.update(schema.bellSchedule)
			.set({ isDefault: true })
			.where(eq(schema.bellSchedule.id, id))
			.run();
	});
}

// Deletes a Bell Schedule nothing depends on. The default goes only when it is the last one,
// and then every Class is left with none, as before the first was made. A Bell Schedule a Class
// follows, or whose Break or Lunch an Event Slot names, is refused, naming who holds it.
export function deleteBellSchedule(db: Db, { id }: { id: string }) {
	const row = requireRow(db, schema.bellSchedule, id, 'Bell Schedule not found.');
	const others = db.select().from(schema.bellSchedule).where(ne(schema.bellSchedule.id, id)).all();
	if (row.isDefault && others.length > 0) {
		throw new Refused(
			'conflict',
			'Make another Bell Schedule the default before deleting this one.'
		);
	}
	const events = db
		.selectDistinct({ name: schema.event.name })
		.from(schema.eventSlot)
		.innerJoin(schema.event, eq(schema.event.id, schema.eventSlot.eventId))
		.where(eq(schema.eventSlot.scheduleId, id))
		.orderBy(asc(schema.event.name))
		.all();
	if (events.length > 0) {
		throw new Refused(
			'conflict',
			`${row.name} cannot be deleted while ${events.map((e) => e.name).join(', ')} holds its Break or Lunch.`
		);
	}
	if (others.length > 0) {
		const classes = db
			.select({ label: schema.classes.label })
			.from(schema.classes)
			.where(eq(schema.classes.scheduleId, id))
			.orderBy(asc(schema.classes.label))
			.all();
		if (classes.length > 0) {
			throw new Refused(
				'conflict',
				`${row.name} cannot be deleted while ${classes.map((c) => c.label).join(', ')} follows it.`
			);
		}
	}
	inTransaction(db.$client, () => {
		db.update(schema.classes)
			.set({ scheduleId: null })
			.where(eq(schema.classes.scheduleId, id))
			.run();
		db.delete(schema.bellSchedule).where(eq(schema.bellSchedule.id, id)).run();
	});
}

// The Bell Schedule a new Class follows when none is chosen: the default, or none before the
// first is made.
export function defaultScheduleId(db: Db): string | null {
	return (
		db
			.select({ id: schema.bellSchedule.id })
			.from(schema.bellSchedule)
			.where(eq(schema.bellSchedule.isDefault, true))
			.all()[0]?.id ?? null
	);
}

// Sets which Bell Schedule a Class follows.
export function setClassSchedule(db: Db, { id, scheduleId }: { id: string; scheduleId: string }) {
	requireRow(db, schema.bellSchedule, scheduleId, 'Bell Schedule not found.');
	const [row] = db
		.update(schema.classes)
		.set({ scheduleId })
		.where(eq(schema.classes.id, id))
		.returning()
		.all();
	return row;
}
