import { formatDate } from './date';
import { plural } from './plural';

// The Runway line both Class views show (GLOSSARY.md, Runway): the date the Class's plan runs
// out, or, when Lessons still hang past the end of the year, how many. One helper so the Classes
// tile and the Class page's panel cannot drift apart.
export function runwayText(runway: { date: string | null; lessonsRemaining: number }): string {
	if (runway.lessonsRemaining > 0) {
		return `${plural(runway.lessonsRemaining, 'Lesson')} past the end of the year`;
	}
	return runway.date ? formatDate(runway.date) : 'open-ended';
}
