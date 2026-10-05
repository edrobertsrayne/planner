// Back from a page that other screens open (the Lesson editor, and the Session page after it).
//
// When the previous page is in the app, Back is the browser's own Back, so Ed lands on the screen
// that opened this one, scroll and filters intact. With no previous page in the app (a reload, a
// new tab, a pasted link) there is nothing to go back to, so Back goes to `fallback` instead.
import { afterNavigate, goto } from '$app/navigation';
import { resolve } from '$app/paths';

// The Course page's address with a Topic chosen.
export function courseHref(courseId: string, topicId: string): string {
	return `${resolve(`/courses/${courseId}`)}?topic=${topicId}`;
}

// Call once while the page initialises. `fallback` is read when Back is pressed, so it follows
// the page's current data, for example after a Topic move.
export function useBack(fallback: () => string): () => Promise<void> | void {
	// `from` is null on the first load of the page and set on every in-app arrival.
	let inApp = false;
	afterNavigate(({ from }) => {
		inApp = from !== null;
	});
	return () => (inApp ? history.back() : goto(fallback()));
}
