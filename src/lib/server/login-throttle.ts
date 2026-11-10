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
	// One sign-in, taking its turn behind any already running. `signIn` tests the password and
	// says whether it was right. Testing awaits a hash, so attempts that arrived together would
	// all pass `locked()` before any failure was recorded and the limit would be five plus however
	// many arrived at once. A refused attempt never reaches `signIn`.
	attempt: (signIn: () => Promise<boolean>) => Promise<'locked' | 'signedIn' | 'failed'>;
}

export function createSignInThrottle({
	failures = 5,
	windowMs = 15 * 60 * 1000,
	lockMs = 60 * 1000
} = {}): SignInThrottle {
	let attempts: number[] = [];
	let lockedUntil = 0;
	let queue: Promise<unknown> = Promise.resolve();

	const throttle: SignInThrottle = {
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
		},
		attempt(signIn) {
			const turn = queue.then(async () => {
				if (throttle.locked()) return 'locked' as const;
				if (await signIn()) {
					throttle.signedIn();
					return 'signedIn' as const;
				}
				throttle.failed();
				return 'failed' as const;
			});
			// A throw is the caller's to see; the turn after it still runs.
			queue = turn.catch(() => {});
			return turn;
		}
	};
	return throttle;
}

// The process's one counter: the login action is its only caller.
export const signInThrottle = createSignInThrottle();
