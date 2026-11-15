// Back from a page that other screens open (the Lesson editor, the Session page and the Class page).
//
// When the previous page is in the app, Back is the browser's own Back, so Ed lands on the screen
// that opened this one, scroll and filters intact. With no previous page in the app (a reload, a
// new tab, a pasted link) there is nothing to go back to, so Back replaces the page with
// `fallback` instead.
import { afterNavigate, goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { screenName } from '$lib/screen-name';

// The Course page's address with a Topic chosen.
export function courseHref(courseId: string, topicId: string): string {
	return `${resolve(`/courses/${courseId}`)}?topic=${topicId}`;
}

// Call once while the page initialises. `fallback` is read when Back is pressed, so it follows
// the page's current data, for example after a Topic move. `label` names where Back lands, "Back
// to Agenda", so the button never asks Ed to remember how he got here.
export function useBack(fallback: () => string): { readonly label: string; go: () => unknown } {
	// The path of the page that opened this one: null on the first load of the page and set on
	// every in-app arrival. A same-route step (the Lesson editor's replaceState stepping) is not an
	// arrival from elsewhere: after a reload or a pasted link there is still nothing behind the page.
	let from = $state<string | null>(null);
	afterNavigate((navigation) => {
		if (navigation.from && navigation.to && navigation.from.route.id === navigation.to.route.id)
			return;
		from = navigation.from?.url.pathname ?? null;
	});
	return {
		get label() {
			return `Back to ${screenName(from ?? fallback().split('?')[0])}`;
		},
		go: () => (from === null ? goto(fallback(), { replaceState: true }) : history.back())
	};
}
