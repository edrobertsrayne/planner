import { describe, expect, it } from 'vitest';
import {
	feedbackTone,
	statusCategory,
	statusTone,
	type FeedbackCategory,
	type PlanningStatus
} from './feedback-tone';

const TOKEN = /^var\(--(error|success|warning|info)-(bg|fg|ring)\)$/;

describe('feedbackTone', () => {
	it('maps a feedback category to bg, fg and ring references of that category', () => {
		const categories: FeedbackCategory[] = ['error', 'success', 'warning', 'info'];
		for (const category of categories) {
			const t = feedbackTone(category);
			expect(t.bg).toBe(`var(--${category}-bg)`);
			expect(t.fg).toBe(`var(--${category}-fg)`);
			expect(t.ring).toBe(`var(--${category}-ring)`);
			expect(t.bg).toMatch(TOKEN);
			expect(t.fg).toMatch(TOKEN);
			expect(t.ring).toMatch(TOKEN);
		}
	});

	it('names no Tailwind palette utility', () => {
		const categories: FeedbackCategory[] = ['error', 'success', 'warning', 'info'];
		for (const category of categories) {
			for (const value of Object.values(feedbackTone(category))) {
				expect(value).toMatch(/^var\(--/);
				expect(value).not.toMatch(
					/-\d00|stone|emerald|sky|violet|amber|rose|teal|fuchsia|indigo|red|green/
				);
			}
		}
	});
});

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
