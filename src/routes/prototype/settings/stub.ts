// PROTOTYPE — throwaway. The change-password action, stubbed. The question is what the screen
// looks like, not whether better-auth works, so the outcome is chosen on the switcher bar
// rather than derived from what was typed.

export type Outcome = 'ok' | 'bad';

export type Result = { ok: boolean; message: string };

export const SUCCESS = 'Password changed. Every other device has been logged out.';
export const FAILURE = 'Current password is incorrect.';

export async function changePassword(outcome: Outcome): Promise<Result> {
	await new Promise((resolve) => setTimeout(resolve, 450));
	return outcome === 'ok' ? { ok: true, message: SUCCESS } : { ok: false, message: FAILURE };
}
