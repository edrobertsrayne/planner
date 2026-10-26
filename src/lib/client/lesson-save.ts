// The Lesson editor's save loop (#422): a typed edit is sent once typing pauses, and whatever is
// still unsent is flushed when the page unloads. The write itself belongs to the caller — the
// editor sends the same `?/updateLesson` form action its blur save uses.
//
// Deliberately framework-free, like teaching-note.ts: no Svelte and no DOM at import time, so the
// timing rules are testable in plain node.

export interface LessonSaverOptions {
	// Sends the form as it stands. `keepalive` is set for the unload flush, where an ordinary fetch
	// would be cancelled by the page going away.
	save: (keepalive: boolean) => void | Promise<void>;
	debounceMs?: number;
}

export interface LessonSaver {
	// Record a typed edit: the save follows once typing pauses.
	edited(): void;
	// Send anything unsent now, with keepalive, without waiting. For `pagehide`.
	flush(): void;
}

const DEBOUNCE_MS = 1000;

export function createLessonSaver({
	save,
	debounceMs = DEBOUNCE_MS
}: LessonSaverOptions): LessonSaver {
	let timer: ReturnType<typeof setTimeout> | null = null;
	// Edits and the last edit a save carried, as sequence numbers: an edit made while a save is in
	// flight stays unsaved, so the next debounce or the unload flush sends it instead of trusting
	// the older write.
	let edits = 0;
	let sent = 0;

	function cancel() {
		if (timer !== null) {
			clearTimeout(timer);
			timer = null;
		}
	}

	async function send(keepalive: boolean) {
		const sending = edits;
		if (sending === sent) return;
		const before = sent;
		sent = sending;
		try {
			await save(keepalive);
		} catch {
			// A failed write is not a saved edit: the next flush tries it again.
			sent = before;
		}
	}

	return {
		edited() {
			edits++;
			cancel();
			timer = setTimeout(() => {
				timer = null;
				void send(false);
			}, debounceMs);
		},
		flush() {
			cancel();
			void send(true);
		}
	};
}
