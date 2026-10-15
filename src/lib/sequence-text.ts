// The words the Sequence tab uses for a write's outcome and its confirm questions. One place, so the three writes (Move,
// Add Lesson, Remove) and the two layouts cannot word the same thing differently.
import { formatDateShort } from './date';

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

// "N Lessons change date." after a Sequence write.
export const changeLine = (n: number) =>
	n === 0
		? 'No Lessons change date.'
		: `${plural(n, 'Lesson')} ${n === 1 ? 'changes' : 'change'} date.`;

// The old date of a Lesson whose first date changed: null means it was past the end of the year.
export const wasText = (was: string | null) => `was ${was ? formatDateShort(was) : 'past the end'}`;

// What a removal from a Sequence costs: the Teaching note and Ready mark of this Class and Lesson
// go with it.
export const lossSentence = (gone: { note: string | null; ready: boolean }[]) => {
	const notes = gone.filter((entry) => entry.note).length;
	const ready = gone.filter((entry) => entry.ready).length;
	const lost = [
		notes ? plural(notes, 'Teaching note') : null,
		ready ? plural(ready, 'Ready mark') : null
	].filter((item) => item !== null);
	return lost.length
		? `${lost.join(' and ')} will be lost.`
		: 'No notes or Ready marks will be lost.';
};

// The result lines of Assign Topic, Add Lesson and Remove.
export const assignedLine = (added: number, topicName: string) =>
	added === 0
		? `Added no Lessons from ${topicName}.`
		: `Added ${plural(added, 'Lesson')} from ${topicName}.`;

const SKIP_REASONS = {
	'in-sequence': 'already in this Sequence',
	placed: 'Placed on this Class'
};
export const skippedLine = (title: string, reason: keyof typeof SKIP_REASONS) =>
	`Skipped “${title}”: ${SKIP_REASONS[reason]}.`;

export const addedLine = (title: string) => `Added “${title}”.`;
export const removedLine = (count: number) => `Removed ${plural(count, 'Lesson')}.`;
