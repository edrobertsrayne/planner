// The form actions that block and unblock a Slot or a whole day, shared by the Calendar and the
// Agenda: both screens write them, so the field reading and the refusals live once.
import { today } from '$lib/date';
import { db } from '$lib/server/db/client';
import { formAction, found, trimmed } from '$lib/server/form';
import { Refused, blockDay, blockSlot, unblockDay, unblockSlot } from '$lib/server/planner';

export const blockSlotAction = formAction((data) => {
	const classId = trimmed(data, 'classId');
	const date = trimmed(data, 'date');
	const slotId = trimmed(data, 'slotId');
	// Not trimmed: the seam owns the note's rule and trims it itself.
	const note = String(data.get('note') ?? '');
	if (!classId || !date || !slotId) throw new Refused('invalid', 'Missing Slot to block.');

	return { report: blockSlot(db, { classId, date, slotId, note, today: today() }) };
});

export const unblockSlotAction = formAction((data) => ({
	report: found(unblockSlot(db, { id: trimmed(data, 'id'), today: today() }), 'Blocked Slot')
}));

export const blockDayAction = formAction((data) => {
	const date = trimmed(data, 'date');
	if (!date) throw new Refused('invalid', 'No date given.');

	// Not trimmed: the seam owns the note's rule. A day's note is optional, so an empty one passes.
	return { report: blockDay(db, { date, note: String(data.get('note') ?? ''), today: today() }) };
});

export const unblockDayAction = formAction((data) => ({
	report: found(unblockDay(db, { date: trimmed(data, 'date'), today: today() }), 'Blocked Day')
}));
