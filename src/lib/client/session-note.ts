// The Session note's persistence rules (#89), as a module the panel calls rather than logic
// inline in the component — this is the second of the rebuild's two test seams. Autosave on a
// roughly 1s debounce; every exit flushes and none of them waits for the write; a failed write
// leaves a localStorage draft keyed by the occasion, which wins over server state on reopen and
// clears once a save is confirmed.
//
// Deliberately framework-free: no Svelte, no DOM globals at import time. Storage is resolved
// lazily so the module can be constructed during SSR and tested in plain node with a map.
// Occasion repeats the shape in session-panel.svelte.ts rather than importing it — pulling that
// module's $app/state dependency into this node-test seam would defeat the seam.

export interface Occasion {
	classId: string;
	date: string;
	period: number;
}

export interface StorageLike {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
	removeItem(key: string): void;
}

export function draftKey(occasion: Occasion): string {
	return `session-note:${occasion.classId}~${occasion.date}~${occasion.period}`;
}

export interface SessionNotesOptions {
	// Writes one note to the server. Rejecting is what marks the save failed.
	write: (occasion: Occasion, note: string) => Promise<void>;
	// Where drafts live. Defaults to localStorage, resolved per operation; returning null (SSR,
	// tests) disables drafts without disabling autosave.
	storage?: () => StorageLike | null;
	onFailure?: (occasion: Occasion, note: string, error: unknown) => void;
}

export interface SessionNotes {
	// Begin showing an occasion: flushes whatever was left pending, then returns the note to
	// display — the local draft if one exists, else the server's, else empty.
	open(occasion: Occasion, serverNote: string | null): string;
	// Record typing: schedules the debounced autosave.
	edit(occasion: Occasion, note: string): void;
	// Write any pending edits now. Never blocks: the caller does not wait for the network.
	flush(): void;
}

const DEBOUNCE_MS = 1000;

function defaultStorage(): StorageLike | null {
	return typeof localStorage === 'undefined' ? null : localStorage;
}

export function createSessionNotes(options: SessionNotesOptions): SessionNotes {
	const { write, onFailure } = options;
	const storage = options.storage ?? defaultStorage;

	// Edits not yet handed to the network. A snapshot is taken from it on save, so edits made
	// while a write is in flight form a fresh batch that a later debounce or flush still sends.
	let buffer: { occasion: Occasion; note: string } | null = null;
	let timer: ReturnType<typeof setTimeout> | null = null;

	function cancelTimer() {
		if (timer !== null) {
			clearTimeout(timer);
			timer = null;
		}
	}

	// Writes are fired and forgotten, so they can settle out of order. Each occasion counts its
	// attempts, and only the newest attempt for an occasion may clear its draft on success or
	// set one on failure — an older attempt failing after a newer one confirmed must not stamp
	// a stale note over the good save.
	const attempts = new Map<string, number>();

	function saveNow() {
		cancelTimer();
		if (!buffer) return;
		const { occasion, note } = buffer;
		buffer = null;
		const key = draftKey(occasion);
		const attempt = (attempts.get(key) ?? 0) + 1;
		attempts.set(key, attempt);
		void write(occasion, note).then(
			() => {
				if (attempts.get(key) !== attempt) return;
				attempts.delete(key);
				storage()?.removeItem(key);
			},
			(error) => {
				if (attempts.get(key) !== attempt) return;
				attempts.delete(key);
				// Twice, deliberately: the toast lets the failure outlive the panel that has already
				// closed; the draft means nothing was lost even so.
				storage()?.setItem(key, note);
				onFailure?.(occasion, note, error);
			}
		);
	}

	return {
		open(occasion, serverNote) {
			// Leaving an occasion — by switching or by closing — always flushes first, whatever
			// brought the panel here.
			saveNow();
			return storage()?.getItem(draftKey(occasion)) ?? serverNote ?? '';
		},
		edit(occasion, note) {
			buffer = { occasion, note };
			cancelTimer();
			timer = setTimeout(saveNow, DEBOUNCE_MS);
		},
		flush: saveNow
	};
}
