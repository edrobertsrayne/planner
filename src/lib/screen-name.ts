// What each page of the app is called, by its path: the five screens and Settings by name, and a
// page under one in the singular. The sidebar, the phone top bar and a Back button all name a page
// from here.
const SCREENS: Record<string, string> = {
	'': 'Agenda',
	calendar: 'Calendar',
	classes: 'Classes',
	events: 'Events',
	courses: 'Courses',
	settings: 'Settings'
};

const PAGES: Record<string, string> = {
	classes: 'Class',
	events: 'Event',
	courses: 'Course',
	lessons: 'Lesson',
	sessions: 'Session'
};

export function screenName(pathname: string): string {
	const [screen = '', page] = pathname.split('/').filter(Boolean);
	return (page ? PAGES[screen] : SCREENS[screen]) ?? 'Planner';
}
