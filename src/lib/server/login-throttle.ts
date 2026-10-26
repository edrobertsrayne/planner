// The /login throttle (ADR-0011, #403). One process and one teacher, so the counter is a module
// value and no store is needed: a restart forgets it, which is fine.
//
// The limit is global, not per client address: the app sits behind a proxy that sets no
// forwarded-for header, so every request looks the same. A global limit lets an attacker lock the
// teacher out for a minute at a time, and that is accepted; the alternative was no limit at all.

export interface SignInThrottle {
	// Whether an attempt must be refused without testing the password.
	locked: (now?: number) => boolean;
	// Record a failed attempt, starting the lock when the limit is reached.
	failed: (now?: number) => void;
	// A successful sign-in: the count starts again.
	signedIn: () => void;
}

export function createSignInThrottle({
	failures = 5,
	windowMs = 15 * 60 * 1000,
	lockMs = 60 * 1000
} = {}): SignInThrottle {
	let attempts: number[] = [];
	let lockedUntil = 0;

	return {
		locked(now = Date.now()) {
			if (now < lockedUntil) return true;
			if (lockedUntil !== 0) {
				// The wait is over. A fresh count, or the expired lock's failures would lock again on
				// the next attempt and the teacher could never sign in.
				lockedUntil = 0;
				attempts = [];
			}
			return false;
		},
		failed(now = Date.now()) {
			attempts = attempts.filter((at) => now - at < windowMs);
			attempts.push(now);
			if (attempts.length >= failures) lockedUntil = now + lockMs;
		},
		signedIn() {
			attempts = [];
			lockedUntil = 0;
		}
	};
}

// The process's one counter: the login action is its only caller.
export const signInThrottle = createSignInThrottle();
