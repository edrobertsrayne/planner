import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createSessionNotes, draftKey, type Occasion, type StorageLike } from './session-note';

const occasionA: Occasion = { classId: 'cls_a', date: '2026-08-23', period: 2 };
const occasionB: Occasion = { classId: 'cls_b', date: '2026-08-24', period: 5 };

function memoryStorage(): StorageLike {
	const entries = new Map<string, string>();
	return {
		getItem: (key) => entries.get(key) ?? null,
		setItem: (key, value) => {
			entries.set(key, value);
		},
		removeItem: (key) => {
			entries.delete(key);
		}
	};
}

interface Harness {
	write: ReturnType<typeof vi.fn<(occasion: Occasion, note: string) => Promise<void>>>;
	onFailure: ReturnType<typeof vi.fn>;
	storage: StorageLike;
}

function harness(writeImpl?: (occasion: Occasion, note: string) => Promise<void>): Harness & {
	notes: ReturnType<typeof createSessionNotes>;
} {
	const storage = memoryStorage();
	const write = vi.fn(writeImpl ?? (() => Promise.resolve()));
	const onFailure = vi.fn();
	return {
		storage,
		write,
		onFailure,
		notes: createSessionNotes({ write, storage: () => storage, onFailure })
	};
}

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
});

describe('draft keys', () => {
	test('are keyed by the occasion — Class, date and Period', () => {
		expect(draftKey(occasionA)).toBe('session-note:cls_a~2026-08-23~2');
		expect(draftKey(occasionB)).not.toBe(draftKey(occasionA));
	});
});

describe('autosave', () => {
	test('writes roughly a second after typing stops', async () => {
		const h = harness();

		h.notes.edit(occasionA, 'first');
		expect(h.write).not.toHaveBeenCalled();

		await vi.advanceTimersByTimeAsync(999);
		expect(h.write).not.toHaveBeenCalled();

		await vi.advanceTimersByTimeAsync(1);
		expect(h.write).toHaveBeenCalledTimes(1);
		expect(h.write).toHaveBeenCalledWith(occasionA, 'first');
	});

	test('restarts the timer on every keystroke', async () => {
		const h = harness();

		h.notes.edit(occasionA, 'a');
		await vi.advanceTimersByTimeAsync(600);
		h.notes.edit(occasionA, 'ab');
		await vi.advanceTimersByTimeAsync(600);
		expect(h.write).not.toHaveBeenCalled();

		await vi.advanceTimersByTimeAsync(400);
		expect(h.write).toHaveBeenCalledTimes(1);
		expect(h.write).toHaveBeenCalledWith(occasionA, 'ab');
	});

	test('coalesces rapid edits into a single write of the latest note', async () => {
		const h = harness();

		h.notes.edit(occasionA, 'one');
		h.notes.edit(occasionA, 'one two');
		h.notes.edit(occasionA, 'one two three');

		await vi.advanceTimersByTimeAsync(1000);
		expect(h.write).toHaveBeenCalledTimes(1);
		expect(h.write).toHaveBeenCalledWith(occasionA, 'one two three');
	});
});

describe('flush on exit', () => {
	test('writes immediately on flush, without waiting for the debounce', () => {
		const h = harness();

		h.notes.edit(occasionA, 'half a sentence');
		h.notes.flush();

		expect(h.write).toHaveBeenCalledTimes(1);
		expect(h.write).toHaveBeenCalledWith(occasionA, 'half a sentence');
	});

	test('hands the write to the network without blocking on it', () => {
		const h = harness(
			() =>
				new Promise<void>(() => {
					/* never resolves */
				})
		);

		h.notes.edit(occasionA, 'gone in a second');
		const returned = h.notes.flush();

		expect(returned).toBeUndefined();
		expect(h.write).toHaveBeenCalledTimes(1);
	});

	test('a flushed edit is not written again when its debounce elapses', async () => {
		const h = harness();

		h.notes.edit(occasionA, 'once only');
		h.notes.flush();
		await vi.advanceTimersByTimeAsync(5000);

		expect(h.write).toHaveBeenCalledTimes(1);
	});

	test('repeated flushes do not duplicate the write', () => {
		const h = harness();

		h.notes.edit(occasionA, 'note');
		h.notes.flush();
		h.notes.flush();
		h.notes.flush();

		expect(h.write).toHaveBeenCalledTimes(1);
	});

	test('an edit made while a flush is in flight is written by a later flush', () => {
		const h = harness(
			() =>
				new Promise<void>(() => {
					/* first write never resolves */
				})
		);

		h.notes.edit(occasionA, 'v1');
		h.notes.flush();
		h.notes.edit(occasionA, 'v2');
		h.notes.flush();

		expect(h.write).toHaveBeenCalledTimes(2);
		expect(h.write).toHaveBeenLastCalledWith(occasionA, 'v2');
	});

	test('flushing with nothing pending writes nothing', () => {
		const h = harness();

		h.notes.flush();
		expect(h.write).not.toHaveBeenCalled();
	});

	test('opening another occasion flushes the edits made to the one being left', () => {
		const h = harness();

		h.notes.edit(occasionA, 'switching away');
		h.notes.open(occasionB, null);

		expect(h.write).toHaveBeenCalledTimes(1);
		expect(h.write).toHaveBeenCalledWith(occasionA, 'switching away');
	});
});

describe('a failed write', () => {
	test('leaves a draft keyed by the occasion and reports the failure', async () => {
		const h = harness(() => Promise.reject(new Error('offline')));

		h.notes.edit(occasionA, 'the lost sentence');
		h.notes.flush();
		await vi.advanceTimersByTimeAsync(0);

		expect(h.storage.getItem(draftKey(occasionA))).toBe('the lost sentence');
		expect(h.onFailure).toHaveBeenCalledTimes(1);
		expect(h.onFailure).toHaveBeenCalledWith(occasionA, 'the lost sentence', expect.any(Error));
	});

	test('leaves no draft on any other occasion', async () => {
		const h = harness(() => Promise.reject(new Error('offline')));

		h.notes.edit(occasionA, 'only for A');
		h.notes.flush();
		await vi.advanceTimersByTimeAsync(0);

		expect(h.storage.getItem(draftKey(occasionB))).toBeNull();
	});
});

describe('reopening a Session', () => {
	test('shows the draft rather than server state when one exists', () => {
		const h = harness();
		h.storage.setItem(draftKey(occasionA), 'the drafted note');

		expect(h.notes.open(occasionA, 'server state')).toBe('the drafted note');
	});

	test('shows server state when no draft exists', () => {
		const h = harness();

		expect(h.notes.open(occasionA, 'server state')).toBe('server state');
	});

	test('shows an empty string when there is neither draft nor server note', () => {
		const h = harness();

		expect(h.notes.open(occasionA, null)).toBe('');
	});
});

describe('confirmed saves clear the draft', () => {
	test('a successful write removes a draft left by an earlier failure', async () => {
		let fail = true;
		const h = harness(() => (fail ? Promise.reject(new Error('offline')) : Promise.resolve()));

		h.notes.edit(occasionA, 'kept this time');
		h.notes.flush();
		await vi.advanceTimersByTimeAsync(0);
		expect(h.storage.getItem(draftKey(occasionA))).toBe('kept this time');

		fail = false;
		h.notes.edit(occasionA, 'kept this time');
		h.notes.flush();
		await vi.advanceTimersByTimeAsync(0);

		expect(h.storage.getItem(draftKey(occasionA))).toBeNull();
	});

	test('a successful write clears the draft even once another Session is open', async () => {
		const deferreds: Array<(outcome: Promise<void>) => void> = [];
		const h = harness(
			() =>
				new Promise<void>((resolve, reject) => {
					deferreds.push((outcome) => outcome.then(resolve, reject));
				})
		);

		// The first attempt fails, so a draft lands for this occasion.
		h.notes.edit(occasionA, 'slow to confirm');
		h.notes.flush();
		deferreds[0](Promise.reject(new Error('offline')));
		await vi.advanceTimersByTimeAsync(0);
		expect(h.storage.getItem(draftKey(occasionA))).toBe('slow to confirm');

		// The retry is still in flight when the teacher moves to another Session.
		h.notes.edit(occasionA, 'slow to confirm');
		h.notes.flush();
		h.notes.open(occasionB, null);

		// It confirms late; the draft goes with it.
		deferreds[1](Promise.resolve());
		await vi.advanceTimersByTimeAsync(0);
		expect(h.storage.getItem(draftKey(occasionA))).toBeNull();
	});

	test('a successful write leaves no draft behind when none existed', async () => {
		const h = harness();

		h.notes.edit(occasionA, 'plain sailing');
		h.notes.flush();
		await vi.advanceTimersByTimeAsync(0);

		expect(h.storage.getItem(draftKey(occasionA))).toBeNull();
		expect(h.onFailure).not.toHaveBeenCalled();
	});
});

describe('writes settling out of order', () => {
	function deferredHarness() {
		const resolvers: Array<(outcome: Promise<void>) => void> = [];
		return {
			h: harness(
				() =>
					new Promise<void>((resolve, reject) => {
						resolvers.push((outcome) => outcome.then(resolve, reject));
					})
			),
			settle: (n: number, outcome: Promise<void>) => resolvers[n](outcome)
		};
	}

	test('an older attempt failing after a newer one confirmed leaves the draft cleared', async () => {
		const { h, settle } = deferredHarness();

		h.notes.edit(occasionA, 'older');
		h.notes.flush();
		h.notes.edit(occasionA, 'newer');

		await vi.advanceTimersByTimeAsync(1000);
		settle(1, Promise.resolve());
		settle(0, Promise.reject(new Error('slow failure')));
		await vi.advanceTimersByTimeAsync(0);

		expect(h.storage.getItem(draftKey(occasionA))).toBeNull();
		expect(h.onFailure).not.toHaveBeenCalled();
	});

	test('when both attempts fail, the newest note is the one the draft holds', async () => {
		const { h, settle } = deferredHarness();

		h.notes.edit(occasionA, 'older');
		h.notes.flush();
		h.notes.edit(occasionA, 'newer');
		await vi.advanceTimersByTimeAsync(1000);

		settle(1, Promise.reject(new Error('first outage')));
		await vi.advanceTimersByTimeAsync(0);
		settle(0, Promise.reject(new Error('second outage')));
		await vi.advanceTimersByTimeAsync(0);

		expect(h.storage.getItem(draftKey(occasionA))).toBe('newer');
		expect(h.onFailure).toHaveBeenCalledTimes(1);
		expect(h.onFailure).toHaveBeenCalledWith(occasionA, 'newer', expect.any(Error));
	});

	test('an older attempt confirming after a newer one failed leaves the draft standing', async () => {
		const { h, settle } = deferredHarness();

		h.notes.edit(occasionA, 'older');
		h.notes.flush();
		h.notes.edit(occasionA, 'newer');
		await vi.advanceTimersByTimeAsync(1000);

		settle(1, Promise.reject(new Error('offline')));
		await vi.advanceTimersByTimeAsync(0);
		settle(0, Promise.resolve());
		await vi.advanceTimersByTimeAsync(0);

		expect(h.storage.getItem(draftKey(occasionA))).toBe('newer');
	});
});
