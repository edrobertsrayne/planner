// The words the Sequence tab uses for a write's outcome. One place, so the three writes (Move,
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
