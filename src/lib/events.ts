// What the pages need to know about Events that is not a rule: the kinds as the teacher names
// them, and the eight positions of a day (ADR-0029). The rules themselves live in the planner seam.
export const EVENT_KINDS = [
	{ value: 'meeting', label: 'Meeting' },
	{ value: 'club', label: 'Club' },
	{ value: 'intervention', label: 'Intervention' },
	{ value: 'other', label: 'Other' }
] as const;

export type EventKindValue = (typeof EVENT_KINDS)[number]['value'];

export const kindLabel = (kind: string) => EVENT_KINDS.find((k) => k.value === kind)?.label ?? kind;

// 0 Before school, 1 to 6 the Periods, 7 After school: the order a day's rows are drawn in.
export const POSITIONS = [0, 1, 2, 3, 4, 5, 6, 7];

// The short label a grid row carries: P3, or the words for the two positions only Events hold.
export const positionLabel = (position: number) =>
	position === 0 ? 'Before school' : position === 7 ? 'After school' : `P${position}`;
