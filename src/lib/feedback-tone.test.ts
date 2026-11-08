import { describe, expect, it } from 'vitest';
import { LESSON_STATUSES, type LessonStatus } from './lesson-status';
import { feedbackTone, statusTone } from './feedback-tone';

describe('statusTone', () => {
	it('maps planning status to the corresponding feedback tone triad', () => {
		const statuses: LessonStatus[] = [...LESSON_STATUSES];
		for (const status of statuses) {
			const expectedCategory = status === 'planned' ? 'success' : 'error';
			expect(statusTone(status)).toEqual(feedbackTone(expectedCategory));
		}
	});
});
