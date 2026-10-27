// A Lesson's planning status: Draft until it is planned. One definition for the seam, the
// feedback tones and every screen that labels a row, so the type and its two display names cannot
// drift apart.
export const LESSON_STATUSES = ['draft', 'planned'] as const;

export type LessonStatus = (typeof LESSON_STATUSES)[number];

export const STATUS_LABEL: Record<LessonStatus, string> = {
	draft: 'Draft',
	planned: 'Planned'
};
