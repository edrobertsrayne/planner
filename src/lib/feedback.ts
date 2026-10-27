// The feedback contract shared by the button and `/feedback`.

/** Longest note the button accepts and the server files. */
export const FEEDBACK_MAX_CHARS = 10_000;

/** The issue `POST /feedback` filed. */
export interface FiledIssue {
	number: number;
	url: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isFiledIssue(value: unknown): value is FiledIssue {
	return isRecord(value) && typeof value.number === 'number' && typeof value.url === 'string';
}

/** Whether `GET /feedback` says the button should show. */
export function isFeedbackEnabled(value: unknown): boolean {
	return isRecord(value) && value.enabled === true;
}

/** The server's reason from a failed `POST /feedback`, when it gave one. */
export function feedbackError(value: unknown): string | null {
	return isRecord(value) && typeof value.error === 'string' && value.error !== ''
		? value.error
		: null;
}
