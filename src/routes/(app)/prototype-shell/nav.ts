// PROTOTYPE ONLY (issue #305). The five screens every shell variant navigates between.
import { page } from '$app/state';
import { resolve } from '$app/paths';
import BookOpenIcon from '@lucide/svelte/icons/book-open';
import CalendarIcon from '@lucide/svelte/icons/calendar';
import LayoutListIcon from '@lucide/svelte/icons/layout-list';
import NotebookPenIcon from '@lucide/svelte/icons/notebook-pen';
import UsersIcon from '@lucide/svelte/icons/users';

export const SCREENS = [
	{ href: resolve('/'), label: 'Agenda', icon: LayoutListIcon, group: 'teach' },
	{ href: resolve('/calendar'), label: 'Calendar', icon: CalendarIcon, group: 'teach' },
	{ href: resolve('/classes'), label: 'Classes', icon: UsersIcon, group: 'teach' },
	{ href: resolve('/courses'), label: 'Courses', icon: BookOpenIcon, group: 'plan' },
	{ href: resolve('/planning'), label: 'Planning', icon: NotebookPenIcon, group: 'plan' }
] as const;

export type Screen = (typeof SCREENS)[number];

export function isActive(href: string): boolean {
	return href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href);
}

export function currentScreen(): Screen | null {
	return SCREENS.find((s) => isActive(s.href)) ?? null;
}

export function screenTitle(): string {
	if (page.url.pathname.startsWith('/settings')) return 'Settings';
	return currentScreen()?.label ?? 'Planner';
}

export interface NextSession {
	classId: string;
	classLabel: string;
	date: string;
	period: number;
	lessonTitle: string | null;
}
