// A Session is addressed by its occasion — Class, date, Period — never by a Session row id
// (ADR-0002). The Session page lives at /sessions/[class]/[date]/[period], so a link to it
// survives a reload.
import { resolve } from '$app/paths';

export interface Occasion {
	classId: string;
	date: string;
	period: number;
}

export function sessionHref({ classId, date, period }: Occasion): string {
	return resolve(`/sessions/${classId}/${date}/${period}`);
}
