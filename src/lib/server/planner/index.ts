// THE SEAM. No route file queries Drizzle directly for scheduling data and no route file calls
// the engine directly (issue #28). This barrel is that boundary: it names, in the domain's own
// language, everything the app outside `server/planner` may do — and nothing else. The
// re-derivation core stays unexported on purpose, because there is no separate "recompute"
// action anywhere, ever: every write that changes a scheduling input re-runs the engine for the
// affected Class(es) on the same call and answers with its report (`WriteReport`).
//
// The modules behind it, in dependency order:
//
//   engine.ts       the pure scheduling function — no I/O, no clock, no Drizzle
//   derive.ts       feeding the engine from the database and persisting its answer
//   ordering.ts     the `position` arithmetic the four ordered things share
//   timetable.ts    Slots: which Class holds which Period, over which dates
//   sequence.ts     a Class's Sequence: its Lessons in its own order
//   teaching-notes.ts  the Teaching note of a Class and Lesson: read, write, end with the pairing
//   classes.ts      a Class, and how far through its Sequence it has got
//   disruptions.ts  Blocked Days and Blocked Slots
//   placement.ts    Placement: a Standalone Lesson put directly onto a Class, no Topic behind it
//   terms.ts        the six Terms, replaced as one document — the Week letter derives from them
//   sessions.ts     one occasion: its detail, its note, its Continuation
//   views.ts        the Agenda stream and the Calendar grid, across every Class
//   courses.ts      Courses and Topics, the planning containers
//   lessons.ts      Lessons: the plan, the whole-Lesson read and the delete rules
//   links.ts        the URLs a Lesson points at
//   tags.ts         short labels a Lesson may carry
//   import.ts       one Topic, its Lessons and their Links, in one transaction
//   attachments.ts  files a Lesson holds: the directory, the allow-list, the create
//   refused.ts      the one refusal every write leaves by, and the kind→status table

export type { PlacementMoved, WriteReport } from './derive';

export type { LessonStatus } from '$lib/lesson-status';

export { reportOf, teachingWeeks } from './derive';

export { Refused, refusalStatus, type RefusalKind } from './refused';

export {
	academicYearStart,
	activeSlots,
	addSlot,
	clearSlot,
	datedSlotsOf,
	endSlot,
	setSlotRoom,
	takeSlot,
	toggleSlot
} from './timetable';

export {
	classDetail,
	classLanes,
	classSchedule,
	createClass,
	deleteClass,
	listClasses,
	renameClass,
	type ClassLane
} from './classes';

export {
	addLesson,
	assignTopic,
	moveLessons,
	removeFromSequence,
	sequenceLessonIds,
	sequenceView,
	topicOptions,
	type DateChange,
	type SequenceEntry,
	type TopicChip,
	type TopicOption,
	type WeekCell,
	type WeekRow
} from './sequence';

export { blockDay, blockSlot, unblockDay, unblockSlot } from './disruptions';

export { placeLesson, placementAdmission, removePlacement } from './placement';

export { replaceTerms } from './terms';

export {
	recordContinuation,
	removeContinuation,
	sessionDetail,
	writeTeachingNote,
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
	createCourse,
	courseById,
	courseSummary,
	courseTiles,
	createTopic,
	deleteCourse,
	deleteTopic,
	listCourses,
	renameCourse,
	renameTopic,
	moveTopicToCourse,
	topicById,
	topicsOf
} from './courses';

export {
	classesTaughtLesson,
	createLesson,
	deleteLesson,
	editLesson,
	lessonDetail,
	lessonsOf,
	moveLesson,
	type LessonChange,
	type LessonDetail
} from './lessons';

export { createLink, deleteLink, linkById, linksOf, moveLink, updateLink } from './links';

export { attachTag, detachTag, listTagNames, tagsByLesson, tagsOf } from './tags';

export { importTopic } from './import';

export { setReadiness } from './teaching-notes';

export {
	attachmentById,
	attachmentsDir,
	attachmentsOf,
	createAttachment,
	deleteAttachment,
	removeAttachmentFiles
} from './attachments';
