// The words of a delete's confirm question (ADR-0026). The server's reason for Lesson, Topic,
// Course and Class delete is built here; the page and the API's 409 show it as it is.
import { plural } from './plural';

export const standaloneText = (lessons: number) =>
	`${
		lessons === 1
			? 'Its 1 Lesson becomes a Standalone Lesson.'
			: `Its ${lessons} Lessons become Standalone Lessons.`
	} Every Class keeps ${lessons === 1 ? 'it' : 'them'} in its Sequence.`;

export const courseDeleteText = (topics: number, lessons: number) =>
	`${topics === 1 ? 'Its 1 Topic goes.' : `Its ${topics} Topics go.`} ${standaloneText(lessons)}`;

// The Class labels are in the order given: "A", "A and B", "A, B and C".
export const lessonDeleteText = (labels: string[]) => {
	const names =
		labels.length > 1 ? `${labels.slice(0, -1).join(', ')} and ${labels.at(-1)}` : labels[0];
	return `This Lesson is in ${names}'s ${labels.length > 1 ? 'Sequences' : 'Sequence'}. Delete it?`;
};

// What deleting a Class loses (ADR-0022): everything it owns goes with it, taught Sessions
// included, so the question says how much of the record that is. The Backup is the undo.
export const classDeleteText = (sessions: number, taught: number, notes: number) =>
	`Its timetable, its ${plural(sessions, 'Session')}${
		taught > 0 ? ` (${taught} taught)` : ''
	} and its ${plural(notes, 'Teaching note')} go with it.`;
