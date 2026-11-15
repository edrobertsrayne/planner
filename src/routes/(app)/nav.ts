import { page } from '$app/state';
import { resolve } from '$app/paths';
import { screenName } from '$lib/screen-name';
import BookOpenIcon from '@lucide/svelte/icons/book-open';
import CalendarIcon from '@lucide/svelte/icons/calendar';
import CalendarClockIcon from '@lucide/svelte/icons/calendar-clock';
import LayoutListIcon from '@lucide/svelte/icons/layout-list';
import NotebookPenIcon from '@lucide/svelte/icons/notebook-pen';
import UsersIcon from '@lucide/svelte/icons/users';

export const SCREENS = [
	{ href: resolve('/'), icon: LayoutListIcon },
	{ href: resolve('/calendar'), icon: CalendarIcon },
	{ href: resolve('/classes'), icon: UsersIcon },
	{ href: resolve('/events'), icon: CalendarClockIcon },
	{ href: resolve('/courses'), icon: BookOpenIcon },
	{ href: resolve('/planning'), icon: NotebookPenIcon }
].map((screen) => ({ ...screen, label: screenName(screen.href) }));

export function isActive(href: string): boolean {
	return href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href);
}

/** Settings is not one of the six screens, so no screen is lit while it is open. */
export function settingsOpen(): boolean {
	return isActive(resolve('/settings'));
}

/** The name of the open screen, for the phone top bar: the lit screen's, or the page's own. */
export function screenTitle(): string {
	return SCREENS.find((s) => isActive(s.href))?.label ?? screenName(page.url.pathname);
}
