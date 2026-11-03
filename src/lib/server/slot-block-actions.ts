// The two form actions that block and unblock one Slot, shared by the Calendar and the Agenda: both
// screens write a Blocked Slot, so the field reading and the "missing Slot" refusal live once.
import { today } from '$lib/date';
import { db } from '$lib/server/db/client';
import { formAction, found, trimmed } from '$lib/server/form';
import { Refused, blockSlot, unblockSlot } from '$lib/server/planner';

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
