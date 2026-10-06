import { page } from '$app/state';
import { resolve } from '$app/paths';
import BookOpenIcon from '@lucide/svelte/icons/book-open';
import CalendarIcon from '@lucide/svelte/icons/calendar';
import LayoutListIcon from '@lucide/svelte/icons/layout-list';
import NotebookPenIcon from '@lucide/svelte/icons/notebook-pen';
import UsersIcon from '@lucide/svelte/icons/users';

export const SCREENS = [
	{ href: resolve('/'), label: 'Agenda', icon: LayoutListIcon },
	{ href: resolve('/calendar'), label: 'Calendar', icon: CalendarIcon },
	{ href: resolve('/classes'), label: 'Classes', icon: UsersIcon },
	{ href: resolve('/courses'), label: 'Courses', icon: BookOpenIcon },
	{ href: resolve('/planning'), label: 'Planning', icon: NotebookPenIcon }
] as const;

export function isActive(href: string): boolean {
	return href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href);
}

/** Settings is not one of the five screens, so no screen is lit while it is open. */
export function settingsOpen(): boolean {
	return isActive(resolve('/settings'));
}

/** The name of the open screen, for the phone top bar. */
export function screenTitle(): string {
	if (settingsOpen()) return 'Settings';
	return SCREENS.find((s) => isActive(s.href))?.label ?? 'Planner';
}
