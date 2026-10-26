import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createLessonSaver } from './lesson-save';

// The debounce rules, without a browser: the editor's save loop is what keeps a plan typed with no
// blur from being lost (#422).
describe('the Lesson save loop', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	test('a pause in typing sends one save, not one per keystroke', async () => {
		const save = vi.fn(async () => {});
		const saver = createLessonSaver({ save, debounceMs: 1000 });

		saver.edited();
		saver.edited();
		saver.edited();
		expect(save).not.toHaveBeenCalled();

		await vi.advanceTimersByTimeAsync(1000);
		expect(save).toHaveBeenCalledTimes(1);
		expect(save).toHaveBeenCalledWith(false);
	});

	test('the unload flush sends at once, with keepalive, and cancels the debounce', async () => {
		const save = vi.fn(async () => {});
		const saver = createLessonSaver({ save, debounceMs: 1000 });

		saver.edited();
		saver.flush();
		expect(save).toHaveBeenCalledTimes(1);
		expect(save).toHaveBeenCalledWith(true);

		// The cancelled debounce does not send a second time for the same edit.
		await vi.advanceTimersByTimeAsync(2000);
		expect(save).toHaveBeenCalledTimes(1);
	});

	test('a flush with nothing unsaved sends nothing', async () => {
		const save = vi.fn(async () => {});
		const saver = createLessonSaver({ save, debounceMs: 1000 });

		saver.flush();
		expect(save).not.toHaveBeenCalled();
	});

	test('an edit typed while a save is in flight is sent by the next flush', async () => {
		let finish: () => void = () => {};
		const save = vi.fn(
			() =>
				new Promise<void>((resolve) => {
					finish = resolve;
				})
		);
		const saver = createLessonSaver({ save, debounceMs: 1000 });

		saver.edited();
		await vi.advanceTimersByTimeAsync(1000);
		expect(save).toHaveBeenCalledTimes(1);

		saver.edited();
		saver.flush();
		expect(save).toHaveBeenCalledTimes(2);

		finish();
	});

	test('a failed save is retried by the unload flush', async () => {
		const save = vi.fn(async () => {
			throw new Error('offline');
		});
		const saver = createLessonSaver({ save, debounceMs: 1000 });

		saver.edited();
		await vi.advanceTimersByTimeAsync(1000);
		expect(save).toHaveBeenCalledTimes(1);

		saver.flush();
		expect(save).toHaveBeenCalledTimes(2);
	});
});
