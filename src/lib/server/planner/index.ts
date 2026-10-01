// THE SEAM. No route file queries Drizzle directly for scheduling data and no route file calls
// the engine directly (issue #28). This barrel is that boundary: it names, in the domain's own
// language, everything the app outside `server/planner` may do — and nothing else. The
// re-derivation core stays unexported on purpose, because there is no separate "recompute"
// action anywhere, ever: every write that changes a scheduling input re-runs the engine for the
// affected Class(es) on the same call and answers with its Rewind report (`WriteReport`).
//
// The modules behind it, in dependency order:
//
//   engine.ts       the pure scheduling function — no I/O, no clock, no Drizzle
//   derive.ts       feeding the engine from the database and persisting its answer
//   ordering.ts     the `position` arithmetic the four ordered things share
//   timetable.ts    Slots: which Class holds which Period, over which dates
//   classes.ts      a Class, its Assigned Topics, and how far through them it has got
//   disruptions.ts  Blocked Days and Blocked Slots
//   placement.ts    Placement: a Standalone Lesson put directly onto a Class, no Topic behind it
//   terms.ts        the six Terms, replaced as one document — the Week letter derives from them
//   sessions.ts     one occasion: its detail, its note, its Continuation
//   views.ts        the Agenda stream and the Calendar grid, across every Class
//   authoring.ts    Courses, Topics, Lessons and Links
//   attachments.ts  files a Lesson holds: the directory, the allow-list, the create
//   refused.ts      the one refusal every write leaves by, and the kind→status table

export type { AtRiskSession, LessonName, PlacementMoved, WriteReport } from './derive';

export { teachingWeeks } from './derive';

export { Refused, refusalStatus, type RefusalKind } from './refused';

export {
	academicYearStart,
	activeSlots,
	addSlot,
	clearSlot,
	datedSlotsOf,
	endSlot,
	holderAt,
	takeSlot
} from './timetable';

export {
	assignedTopicsOf,
	assignTopic,
	classDetail,
	classLanes,
	classSchedule,
	createClass,
	listClasses,
	moveAssignedTopic,
	renameClass,
	unassignTopic,
	type ClassLane
} from './classes';

export { blockDay, blockSlot, unblockDay, unblockSlot } from './disruptions';

export { placeLesson, removePlacement } from './placement';

export { replaceTerms } from './terms';

export {
	recordContinuation,
	sessionDetail,
	writeSessionNote,
	type Occasion,
	type SessionDetail
} from './sessions';

export {
	agenda,
	agendaLookBack,
	calendarWeek,
	planningStream,
	type AgendaEntry,
	type CalendarCell,
	type CalendarWeek,
	type DayKind,
	type PlanningEntry,
	type PlanningOccurrence
} from './views';

export {
	classesTaughtLesson,
	createCourse,
	createLesson,
	createLink,
	createTopic,
	deleteCourse,
	deleteLesson,
	deleteLink,
	deleteTopic,
	attachedTags,
	attachTag,
	detachTag,
	lessonDetail,
	lessonsOf,
	linksOf,
	listCourses,
	listTagNames,
	moveLesson,
	moveLessonToTopic,
	moveLink,
	patchLesson,
	importTopic,
	renameCourse,
	renameLesson,
	renameTopic,
	setLessonStatus,
	setReadiness,
	tagsByLesson,
	tagsOf,
	topicsOf,
	updateLesson,
	updateLink,
	type LessonStatus
} from './authoring';

export {
	attachmentById,
	attachmentsDir,
	attachmentsOf,
	createAttachment,
	deleteAttachment
} from './attachments';
