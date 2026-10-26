import { describe, expect, it } from 'vitest';
import { feedbackTone, statusCategory, statusTone, type PlanningStatus } from './feedback-tone';

describe('statusCategory and statusTone', () => {
	it('maps Draft to error category and Planned to success category', () => {
		expect(statusCategory('draft')).toBe('error');
		expect(statusCategory('planned')).toBe('success');
	});

	it('maps planning status to the corresponding feedback tone triad', () => {
		const statuses: PlanningStatus[] = ['draft', 'planned'];
		for (const status of statuses) {
			const expectedCategory = status === 'planned' ? 'success' : 'error';
			expect(statusTone(status)).toEqual(feedbackTone(expectedCategory));
		}
	});
});
