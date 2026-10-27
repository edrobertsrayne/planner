import { describe, expect, it } from 'vitest';
import { LESSON_STATUSES, type LessonStatus } from './lesson-status';
import { feedbackTone, statusCategory, statusTone } from './feedback-tone';

describe('statusCategory and statusTone', () => {
	it('maps Draft to error category and Planned to success category', () => {
		expect(statusCategory('draft')).toBe('error');
		expect(statusCategory('planned')).toBe('success');
	});

	it('maps planning status to the corresponding feedback tone triad', () => {
		const statuses: LessonStatus[] = [...LESSON_STATUSES];
		for (const status of statuses) {
			const expectedCategory = status === 'planned' ? 'success' : 'error';
			expect(statusTone(status)).toEqual(feedbackTone(expectedCategory));
		}
	});
});
