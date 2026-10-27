// Feedback tones for states and outcomes (issue #113, values tuned on #114).
//
// Four categories: error, success, warning, info. The tokens are defined in src/routes/layout.css
// (`--error-{bg|fg|ring}` etc.). Handing back var() references keeps this file out of the palette
// business; consumers style inline so both theme variants come free from the .dark override.
//
// Planning statuses map to categories: Draft -> error (red/rose), Planned -> success (green/emerald).
import type { LessonStatus } from './lesson-status';

export type FeedbackCategory = 'error' | 'success' | 'warning' | 'info';

// A feedback category to its token role names.
export function feedbackTone(category: FeedbackCategory) {
	return {
		bg: `var(--${category}-bg)`,
		fg: `var(--${category}-fg)`,
		ring: `var(--${category}-ring)`
	};
}

// Maps a Lesson's planning status to its feedback category.
export function statusCategory(status: LessonStatus): FeedbackCategory {
	return status === 'planned' ? 'success' : 'error';
}

// A Lesson's planning status to its token role names.
export function statusTone(status: LessonStatus) {
	return feedbackTone(statusCategory(status));
}
