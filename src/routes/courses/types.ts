// PROTOTYPE — throwaway. Shared shape for the three Courses variants; mirrors +page.server.ts's load return.
export type CoursesPageData = {
	courses: { id: string; name: string }[];
	course: { id: string; name: string } | null;
	topics: { id: string; name: string }[];
	topic: { id: string; name: string } | null;
	lessons: { id: string; title: string; body: string | null; plannedLength: number }[];
	lesson: { id: string; title: string; body: string | null; plannedLength: number } | null;
	links: { id: string; label: string; url: string }[];
	lessonIndex: number;
	taughtBy: { id: string; label: string }[];
};
