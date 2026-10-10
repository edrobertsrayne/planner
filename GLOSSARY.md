# Planner

A personal electronic teacher planner for one UK state secondary school teacher. It holds what is
_planned_ to be taught, lays that plan onto the real school calendar, and keeps it correct when
teaching does not go to plan.

The central distinction in this domain is between **planning** and **scheduling**. A Lesson is
something you planned; a Session is an occasion on which you taught it. Almost every subtlety in
the model follows from keeping those two apart.

## Language

### Planning

**Course**:
The body of teaching material for a subject and year group, such as "Year 9 Physics". Composed of
Topics, which it holds in no particular order — a Course is what a Class _may_ be taught, not a
sequence it works through. It outlives the Classes drawing on it, and a Class typically teaches
only part of one in a year. Course names are unique across the planner, case-insensitive, so
"Year 9 Physics" and "YEAR 9 PHYSICS" are the same name. It has a Tone of its own.
_Avoid_: Scheme of work, syllabus, curriculum, module, unit

**Topic**:
A named block of teaching within a Course, such as "Forces". Composed of Lessons, in order: the
order Assign Topic adds them to a Class's Sequence. Belongs to exactly one Course and holds no
position within it; the teacher can move it to a different Course. A Topic is a label and a
source, never the unit of teaching order: what a Class teaches, and in which order, is its
Sequence. Topic names are unique within their Course — case-insensitive, and trimmed — so two
Courses may each hold a "Forces", but one Course may not hold two "Forces" Topics.
_Avoid_: Unit, module, block, chapter

**Lesson**:
One teaching episode — the plan, not the event. Usually filed in a Topic; a Standalone Lesson has
none. Exists whether or not it has ever been taught, and is shared by every Class whose Sequence
holds it. A title alone constitutes a Lesson; the notes and the links to resources held elsewhere
arrive as planning catches up. Lesson titles are not unique: one Topic may hold two Lessons called
"Revision", so a Lesson is addressed by its identity and never by its title.
_Avoid_: Period, session, class

**Tag**:
A short, teacher-typed label a Lesson may carry zero or more of — freely created, never drawn
from a fixed set. Typing a name that already exists elsewhere attaches that same Tag rather than
creating a duplicate, so "Practical" on one Lesson means the same thing as "Practical" on
another. Removing a Tag from a Lesson never deletes the Tag itself: a Tag with no Lessons left
still exists, ready to be reused. Set from the Lesson editor; read wherever a Lesson is shown
except the Calendar tile.
_Avoid_: Label, category
**Attachment**:
A file a Lesson holds that the planner stores itself — a worksheet PDF, a slide deck — as
distinct from a Link, which points at a resource elsewhere on the web. Carried by the Lesson like
its notes and Links, it shows its original filename and size, downloads under its own name, and is
never edited in place: replacing one is delete-then-add. Outside the Lesson editor it is
download-only. It dies with its Lesson, never with its place — deleting the Lesson removes it,
Detaching or moving the Lesson keeps it.
_Avoid_: Upload, media, resource

**Standalone Lesson**:
A Lesson belonging to no Topic. It reaches a Class only by a Placement, or by Add Lesson on that
Class's Sequence. A Lesson becomes one by Detach, or when its Topic is deleted. Every Session that
already taught it still names it. This is what lets a taught Lesson leave its Topic without erasing
what a Class was taught (ADR-0015).
_Avoid_: Orphan, archived Lesson, deleted Lesson, loose Lesson, ad-hoc Lesson, one-off Lesson

**Detach**:
Removing a Lesson from its Topic, making it a Standalone Lesson. The Lesson keeps its title, body,
Links and Length, and every Sequence that holds it keeps it: only its filing changes. Not one-way:
any Lesson may be given a Topic, a Standalone Lesson included. Distinct from deleting a Lesson,
which removes the Lesson itself and is refused once a Class has been taught it or a Placement
names it.
_Avoid_: Archive, retire, unfile, soft delete

**Length**:
The number of Periods a Lesson is intended to occupy, defaulting to one. Its Periods are separately
blockable: blocking one removes that Slot from under the Lesson, which shortens it and shifts the
rest.
_Avoid_: Planned Length, duration, double, span, periods

**Draft**:
A Lesson the teacher has not yet marked Planned — it is written but not reviewed and approved.
Typically carries no more than its title. Belongs to the Lesson, so every Class whose Sequence
holds it sees the same. Says nothing about whether any Class is Ready to teach it.
_Avoid_: Bare, empty, stub, untouched, Placed

**Planned**:
A Lesson the teacher has reviewed and approved as ready to teach from. Belongs to the Lesson,
shared by every Class that teaches it. Marked by the teacher and never derived from the body or
the links. Names the Lesson's state, never its place on the calendar — a Lesson takes a date by
being Scheduled, and the two are unrelated.
_Avoid_: Drafted, written, complete, scheduled, Placed

**Import**:
Creating one Topic, with its Lessons and their Links, in a single request — optionally creating
its Course inline if it doesn't yet exist. Always create-only and all-or-nothing: an Import that
collides with an existing Topic, or fails partway, commits nothing. Distinct from an ordinary
create, which adds one record at a time and leaves partial results in place.
_Avoid_: Bulk create, batch upload, sync

### Scheduling

**Class**:
A group of pupils taught as a unit, identified by a label such as "9B/Sc1". A Class follows
exactly one Course, fixed when the Class is created, which limits the Topics it may be given; what
it actually teaches is its Sequence. It has its own Slots, and is scoped to one academic year —
next year's teaching is new Classes, not these ones carried forward. It is a label, a Course, a
Timetable, a Sequence and a Tone only — it holds no information about individual pupils.
_Avoid_: Group, set, form, cohort

**Tone**:
One of eight recurring colour identities that tell Classes apart, and tell Courses apart. Every
Class and every Course is given a Tone automatically when it is created — the next colour in a
sequence that walks around the wheel rather than stepping through neighbouring hues — and keeps it
for its whole life: no other creation or deletion ever changes it. Classes and Courses walk the
sequence separately, so a Course and a Class may share a Tone. A deleted Class's or Course's Tone
may be given to a later one, and past eight Tones repeat; two sharing one is accepted, not a fault.
A Tone carries no meaning beyond recognition — a Class's Tone says nothing about year group,
subject or Course.
_Avoid_: Colour, theme

**Sequence**:
The ordered Lessons one Class teaches: the Class's own order over the shared Lessons, so Topics
may interleave and two Classes differ freely. A Lesson is in a Sequence once at most. A Class
begins the year with an empty Sequence. **Assign Topic** adds a Topic's Lessons, as they are then,
to the end, and skips each one already in the Sequence or Placed on that Class; a Lesson written
later reaches no Class until its Topic is assigned again. The teacher moves, adds and removes
Lessons. A Lesson with a Session on or before today is fixed, and nothing moves in front of it.
The Sequence is what the schedule is derived from: it is laid onto that Class's Available Slots.
_Avoid_: Queue, list, Assigned Topic

**Period**:
One of the six numbered teaching positions in a school day, P1 to P6. Every day has the same six.
A Period is a position in the day, not a time of day — the planner never needs the clock.
_Avoid_: Lesson, session, hour

**Slot**:
A recurring position in the Timetable when a given Class is taught, such as "Week A, Monday,
Period 3". A Slot describes when teaching _can_ happen, not what is taught. A Slot _holds_ over a
range of dates, and no two Slots may share a position over dates where both hold. A Class taught
two consecutive Periods occupies two Slots, never one longer one.
_Avoid_: Lesson, session, booking, double

**Room**:
Where a Slot is taught, such as "S12" or "Lab 3", typed by the teacher and optional. A Room
belongs to the Slot, so every Session in that Slot shows it, past ones included. To change the
Room from a date, end the Slot and take the position again from that date.
_Avoid_: Classroom, location, venue

**Session**:
A single dated occasion on which a Lesson is taught to a Class, occupying one Slot on one date.
A Session is identified by its occasion — Class, date and Period — not by its Lesson, so a Rewind
can change which Lesson an occasion carried. It carries no note: how the teaching went is the
Teaching note, which follows the Lesson.
_Avoid_: Teaching period, occurrence, instance, event

**Teaching note**:
The teacher's note on how one Lesson went with one Class. There is one per Class and Lesson,
shared by every part of the Lesson, a Continuation's included, and by every Placement of it on that
Class. Keyed like Readiness, so it follows its Lesson through a reorder or a Rewind to the day the
Lesson was really taught, and it dies when the pairing does. Written on the Session page. An Open
Slot carries none. Distinct from the free text on a Blocked Slot, which explains the disruption.
_Avoid_: Session note, Lesson note, comment

**Placement**:
One Lesson put on one Class on one date the teacher chooses, outside that Class's Sequence. To
**Place** is to make one, and Placing makes a new Standalone Lesson; the reverse is to remove it,
which leaves the Lesson standing. A Lesson is in a Class's Sequence or Placed on that Class, never
both. A Placement is anchored to the date and Slot chosen and takes the first Available Slot at or
after it, so it shifts right when that Slot stops being Available, and returns when the Slot is
Available again. The Slot chosen may be an Open Slot or one a Sequence Lesson already holds; a
Placement consumes the Slot it takes, so that Lesson and every Lesson after it in the Class's
Sequence move on past it. Made for today or a later date, never a past one.
_Avoid_: Insertion, injection, ad-hoc Lesson, one-off Lesson, pinned Session, placed Slot,
reservation, pin, lock, unplace, cancel

**Timetable**:
The full recurring pattern of Slots across the two-week cycle.

**Teaching Week**:
A calendar week in which at least one day is taught. A week falling entirely inside a break is not
a Teaching Week and takes no turn in the Week A / Week B cycle.

**Week A / Week B**:
The two halves of the fortnightly cycle that the Timetable repeats on. The letters alternate across
Teaching Weeks, the first Teaching Week of the academic year being Week A — so a break never
changes which letter falls next. Which letter a week carries is recalculated from the Term dates,
never recorded.

### The Calendar

**Term**:
A contiguous stretch of the academic year during which teaching happens, bounded by an opening and
a closing date and containing no break. There are six in a year. What the school calls the "Autumn
Term" is two Terms here, separated by the half-term break.
_Avoid_: Half-term, block, semester

**School Holiday**:
A weekday outside every Term — Christmas, Easter, the summer, and the half-terms. Derived from the
Term dates, never stored, and never a Blocked Day: on a School Holiday nothing was removed, the
school is simply not running. A Blocked Day may be entered on a School Holiday, and the holiday
then takes visual precedence in the Calendar.
_Avoid_: Break, vacation, closure

**Blocked Day**:
A date on which none of this teacher's Classes are taught, whatever the cause — an INSET day, a
bank holiday, illness, snow. The cause is not recorded, because nothing in the planner behaves
differently according to it. Blocking a day blocks every Slot on it.
_Avoid_: Closure, absence, holiday, cancellation, non-pupil day, leave

**Blocked Slot**:
One Slot on one date on which one Class is not taught, though the school is open and other Classes
are — a trip, a cover lesson, an assembly, a fire drill. Unlike a Blocked Day it may carry free
text, because a hole in the week is otherwise unexplainable months later.
_Avoid_: Cancellation, skip, gap, missed lesson

**Available Slot**:
A Slot on a date that falls within a Term, lies within the dates that Slot holds, and is neither a
Blocked Day nor a Blocked Slot — that is, a Slot on which teaching can actually take place.

**Open Slot**:
An Available Slot carrying no Lesson, because the Class's Sequence ran out before its Slots did.
The mirror of an unplaced Lesson, and the normal condition of a Class whose next Topic is not yet
assigned — not a fault, and never a Blocked Slot, which means the opposite.
_Avoid_: Unplanned Slot, empty slot, gap, free period, unfilled

**Runway**:
The date a Class's plan runs out — the date of its first Open Slot. Measured as a date rather
than a count of Lessons, because Classes taught at different frequencies exhaust the same number of
Lessons at different speeds, and because a Blocked Day or a Continuation moves the date without
changing the count.
_Avoid_: Buffer, headroom, lessons remaining

### Rescheduling

**Shift-right**:
The rule governing every disruption: when a Lesson cannot be taught as scheduled, it and every
Lesson after it in that Class's sequence move to the next Available Slots for that Class,
preserving the order of the sequence. The alternative — skipping a Lesson so later ones keep their
dates — is deliberately not supported. Shift-right is not an operation anyone performs; it is what
falls out of laying the Class's Sequence onto the Available Slots that remain.
_Avoid_: Reschedule, push back, bump

**Rewind**:
Re-deriving the record back to an earlier date, so that Sessions already recorded are relabelled.
Needed when a Blocked Day or Blocked Slot is entered after the fact, because what was taught on
the days following it was not what the record claims. Scheduling otherwise never writes before
today.
_Avoid_: Undo, replay, recalculate, backdate

**Rewind report**:
What every write that re-derives a Class answers with: the Placements that no longer sit on their
anchor (`placementsMoved`). The teacher must see it, because the teacher chose each Placement's
date. A Lesson that a Rewind moves needs no report, because its Teaching note moves with it. It
travels as one value, `report`, from the seam to the screen, and one view, `RewindReport`,
renders it.
_Avoid_: Warning, at-risk list, change log

**Continuation**:
A Session marked as needing more time, so that its Lesson also occupies the following Available
Slot. The Course is unchanged; only that Class's Sessions shift. A Continuation can be removed
(**Remove a Continuation**); the Lesson's later Sessions then move back one Available Slot. A
Session can be marked once it has started — that day or later.
_Avoid_: Split, extend, carry over, overrun

### Readiness

**Ready**:
One Class is prepared to teach one Lesson — printed, resourced, practicals set. Recorded per Class
and Lesson, so Classes sharing a Lesson differ freely, and the mark survives Shift-right and Rewind.
Independent of the Lesson's planning status: a Draft Lesson may be Ready, and marking a Lesson
Draft never clears the mark.
_Avoid_: Printed, done, prepared

**Readiness**:
The record that one Class is Ready for one Lesson. Exists only once made; it dies when the pairing
does — Remove Lesson from the Class's Sequence, deletion of the Lesson, or the removal of the last
Placement naming it — and nothing derived ever disturbs it. The Teaching note follows the same
rule. Separate from Draft and Planned, which describe the shared plan rather than one Class's
preparation to teach it.
_Avoid_: Checklist, handout list, preparation

### The planner's data

**Backup**:
One file that holds all of the planner's data — every record and every Attachment's file — taken
on demand so the planner can be moved to another instance. To **Back up** is to make one; to
**Restore** is to rebuild an empty instance from one, all-or-nothing. Distinct from Import, which
creates one Topic inside a planner that already exists.
_Avoid_: Export, dump, snapshot, Import

## Views

Names for the screens, not for anything in the domain. Recorded so that issues, tests and code
agree on what to call them.

**App shell**:
The frame around every screen except Login and Setup. On a laptop it is a sidebar on the left: the
wordmark, the five screens (Agenda, Calendar, Classes, Courses, Planning) with an icon and a name
each, and at its foot Settings, the theme toggle, Log out and the build line. On a tablet the
sidebar shows icons only. On a phone it is a top bar with a menu button and the current screen's
name; the menu button opens the same list as a drawer.
There is no top header on a laptop or a tablet, so a screen starts at the top of the window. The
window is the only thing that scrolls. The shell has no shortcut to the next Session: the teacher
opens a Session from its row on the Agenda or the Calendar.

**Agenda**:
The chronological stream of upcoming Sessions across every Class, grouped by day, reaching a
horizon the teacher chooses: a number of days, or **All**, to the end of the last Term. Where the
planner opens. The teacher can also turn on the look-back: the Sessions of the past seven days,
shown above today, grouped by day, oldest first. The look-back is off by default and read-only. Its
span is fixed: the horizon changes only the days ahead. The look-back obeys the Tag filter the same
way the days ahead do.
A past row carries no Ready tick. It opens the Session page on its occasion, where the teacher
reads the note. The past days are told apart from the days ahead by a step in shade, never a hue.
An Open Slot appears as an ordinary row in its own position, marked as carrying no Lesson, because
the teacher is teaching that Period and an Agenda that omitted it would report a free one — it
carries no Ready tick, since there is no (Lesson, Class) pairing to key one on. Every other
upcoming row carries the Ready tick for its Class, and this is the only screen on which Readiness
is written; a row can be ticked only while it is on screen, so the ticks reach only as far as the
chosen horizon, and no past day can be ticked. A Continuation's two rows share one Readiness
record, so ticking either moves both. The Agenda can be narrowed to one Tag with a row of Tag chips
under the heading, the same control as the Class chips on Planning: while a Tag filter is on, it
shows only the Lessons with that Tag and hides Open Slots, in the look-back and in the days ahead.
The Agenda is one column at every size. On a phone it is the main screen, so the Ready tick and an
Open Slot's Plan button show without a hover. On a phone the page heading is out of sight, because
the top bar names the screen; a screen reader still reads it.

**Calendar**:
One Teaching Week as a grid of Periods against days, showing which Class is taught when and what
each Session carries. Note that this names a _screen_. The Terms, Blocked Days and Blocked Slots it
draws on are the calendar _model_. "The calendar" unqualified means the model. An Open Slot keeps
its Class's colour and shows no Lesson. A Blocked Day and a Blocked Slot drain the colour instead.
Present-but-empty and removed must never read alike. A position dated before today shows its
recorded Session, or an Open Slot when no Lesson was recorded. It keeps its Class's Tone and lays
a hatch over it, so past and upcoming tiles never read alike. A past tile is never a removal: it
opens the Session page on its occasion. A day with no teaching — a Blocked Day or a
School Holiday — drops its six Periods. The day reads as one panel spanning the column. The panel is
told apart from an empty Period by a step in shade, never a hue. No block or unblock sits on a tile.
Every block and unblock on a day starts in that day's menu. The menu offers Block day or Unblock
day. It offers a Block one Slot line for each Slot the day's tiles cover. It offers an Unblock line
for each Blocked Slot on it. A Blocked Slot's Unblock line survives the collapse of its column. A
Blocked Slot recorded on a School Holiday is still a removal. The column reads as the School
Holiday's panel. The Blocked Slot's Unblock line sits in that day's menu, like every other act on
the day. A Blocked Day entered on a School Holiday still reads as the School Holiday in the panel's
headline. The day's menu still offers Unblock day. The Blocked Day is not hidden.
The Calendar is the same grid at every size; on a narrower window the tiles give way, not the
grid. On a phone a tile shows only its Class, and the Lesson title comes back where there is room.
A tap on a tile opens the Session page. On a phone the week controls are the two arrows around the
week's letter and date, with Today; the ribbon of weeks and Set up year show only from a tablet up.
The day's menu shows from a tablet up and not on a phone, because the calendar is not written there.

**Classes**:
One tone-coloured tile per Class, keyed by Class rather than by time. Each tile carries the
Class's label, Course and tone, the Lesson queued next with its Topic, and its Runway. The whole
tile is one link to the Class page, as on Courses; it has no footer and no progress bar. A Class
is created here, in a dialog opened from the New Class tile. On a phone there is no New Class
tile, because nothing is written there. The Runway is shown plainly and is not coloured while the
Sequence fits the year: a Class approaching the end of its Sequence is the normal condition
several times a year, so a threshold warning would be on almost always and mean nothing. The one
exception is Lessons with no Slot left this year: the Runway line then reads "N Lessons past the
end of the year" in red, here and on the Class page. Apart from that, the Agenda showing Open Slots
inside its own horizon is the only alert the planner has.

**Class page**:
The single surface for one Class, in three tabs under the Class's label and Course. Overview, the
default, is one column: the Class's next five Sessions, each opening the Session page, then Last
taught with its Teaching note, Next up and the Runway. Timetable holds the "Timetable as at"
control and the Slot grid, both weeks stacked. Sequence, labelled with its count of Lessons, is
the only place a Sequence is read or written. It shows By week, each week's Slots in fixed
places, or as a List. The teacher drags a Lesson by its grip to take another Lesson's place, and
select mode moves or removes several at once. Assign Topic, Add Lesson and Remove Lesson are here
too. Each change is kept at once, and a line says how many Lessons change date. Taught Lessons are
fixed and hidden until asked for; a Placement shows fixed in its Slot; Lessons with no Slot left
show in a "Past the end of the year" row. The Timetable and Sequence tabs show, and are written,
from a tablet up; a phone shows Overview only, with no tabs. The only place a Class is timetabled.
Creating a Class happens on the Classes screen. There is no screen showing every Class's Timetable
at once, because the Timetable is only ever read or written one Class at a time. Periods held by
another Class carry that Class's label rather than being hatched or hidden, since a position can
hold only one Class on any given date; that is where the Slot uniqueness rule is enforced. An edit
takes effect from a position in the year the teacher picks — the start of the year, today, a date
on which this Class's Slots change, or any date — chosen through the same "Timetable as at" control
that reads history, so ending one Slot and starting another is ordinary editing rather than a
special operation.

**Courses**:
Where Course content is written. One tile per Course, marked by the Course's Tone as a dot and as
the colour of its progress bar, with a New Course tile after them; each tile opens a page for that
Course. The Course page holds the Course's Topics on the left and the chosen Topic's Lessons in
order on the right. Below a wide laptop window it shows one at a time: the Topics, then the
chosen Topic's Lessons. A new Topic and a new Lesson are each created by typing a name at the foot
of its own list. Detach and delete a Lesson are in the Lesson editor only. Move to… files a Topic
in another Course. A Topic's Lesson order is the order Assign Topic adds its Lessons in; changing
it changes no Class's Sequence. Deleting a Topic keeps its Lessons as Standalone Lessons. Import
has no control here. The only screen that writes Courses and Topics. On a phone it is read-only.
Unlike the other three screens it is a writing surface, and it is where the planner is used on a
Sunday rather than during a teaching week.

**Planning**:
The stream of upcoming Lessons by planning status — which are still Draft, which are Planned —
ordered by soonest next Scheduled occurrence, Lessons with no scheduled occurrence last. Keyed by
Lesson rather than by Class, so it shows the shared plan and never shows Readiness: what the
teacher has not yet written is one question, and whether one Class is set to be taught is another.
The screen can be narrowed to one Class with a row of Class chips; it then lists only that Class's
upcoming Lessons, ordered by that Class's Sessions. It can also be narrowed to Draft or Planned with
tabs. Both filters live in the address, so a reload or a Back into the screen keeps them. It is a
table, one row per Lesson, holding the whole stream with no page size; the window scrolls it. Only
the Lesson's title opens the Lesson editor. On a phone each row is a card, and Draft and Planned
are shown but not changed.
Note that this names a _screen_; "planning" unqualified means the activity, and the Planning half
of the Language above names its parts.

**Lesson editor**:
The single surface for one Lesson — its title, its markdown body, its links, its attachments, its
Tags and its Length, its Topic, and the Detach and delete controls. Every Lesson is written here, a
Standalone Lesson included, placed or not: to the teacher a Standalone Lesson differs from any
other only in having no Topic, so its page lacks Detach, and its Topic control gives it one. A
page of its own, addressed by the Lesson alone, so the same page opens from the Courses view, the
Class page, the Planning view and the Session page, and moving the Lesson to another Topic, or
Detaching it, keeps the teacher on it. Opened from the Class page, it steps through that Class's
whole Sequence, taught, untaught and past the end, Standalone Lessons included, and says so:
"Lesson 14 of 52 in 9B/Sc1". Opened from any other view, it steps through the Lesson's Topic, in
the Topic's order; stepping stops at either end of the Topic and never crosses into another,
because a Course holds its Topics in no order, and a Standalone Lesson does not step. Leaving it —
by Back or by deleting the Lesson — returns the teacher to the view they came from, or, when there
is none, to the Lesson's Topic on its Course page, or to the Planning view for a Standalone Lesson.
Creating a Lesson does not open it. It is written on a laptop or desktop; on a phone it is a read
view. Distinct from the Session page: the Lesson editor writes the plan shared by every Class, the
Session page writes one Class's occasion and its Teaching note.

**Session page**:
The single surface for one Session — its Lesson's plan, links and attachments, the Teaching note,
and the Continuation control. Attachments here are view-and-download only, like Links.
The page never rewrites the shared plan, for a Topic Lesson or a placed Standalone Lesson alike;
it opens the Lesson's own page in the Lesson editor for that. It is where a Lesson is Placed and a
Placement removed, because those are acts on the occasion, not on the plan. Opened from any of the
three reading views; there is no other place a Session is read or written. It opens on an Open
Slot too, showing no plan and no note: a Teaching note needs a Lesson, and an Open Slot has none.
Shows the Class's Readiness for this Lesson, read-only — the page describes the exact (Lesson,
Class) occasion the Agenda row already ticks, so it would otherwise hide a fact its own row
displays. No other screen shows Readiness.
A page of its own, like the Lesson editor, addressed by its occasion: the Class, the date and the
Period. It does not step to another Session. Leaving it by Back returns the teacher to the view
they came from, or, when there is none, to the Agenda. On a laptop the plan is on the left and a
rail on the right holds the Teaching note and the acts on the occasion — Needs more time, Remove a
Continuation, Place a Lesson and Remove placement. Below a laptop it is one column, and once the
Session has started the note comes before the plan, because on a phone the teacher opens it after
the lesson to write the note.
_Avoid_: Session panel

**Settings**:
Three cards: Change password, API key and Backup. Reached from a control at the foot of the app
shell's sidebar rather than from its list of screens, so no screen is lit while it is open. It has
the shared screen width and title, with no description line. On a laptop, Change password stands on
the left, and API key and Backup are stacked on the right. Below a laptop it is one column. If
Settings gets more sections, a list of sections with one section shown at a time is the expected
next layout. The only place the
password is changed, and changing it signs out every other device, which the card says plainly: the
forgotten session on a school machine is the reason to change a password at all. API keys belong
here because they identify the account
(the single user), not the calendar model and not any Course — the only other thing that belongs to
the account and nothing else. Opening the screen mints the key when the database has none, so there
is no Generate step and no state in which the planner has no key; the card shows the token in full,
in a read-only field, with the created and last-used dates beneath it, because this screen is the
only place the token can be read. Regenerating replaces the key, and the old token stops working at
once. The outcome of a submission is reported as a toast rather than inline, because it must outlive
the form and because the design system has a colour for failure and none for success — an inline
success would read as nothing.

**Login**:
Where the teacher signs in, and the only way into the planner. Sits outside the app shell: no
sidebar, no menu, a wordmark above a narrow card on the muted ground. On a phone the card frame and
the muted ground go, and the form starts at the top of the screen, so the keyboard does not move it.
It carries an email
field, a password field and nothing beside them — no third-party sign-in, no link to create an
account, and no password reset, all three deliberate. There is one account, it is created by Setup
and nowhere else, and the planner has no way to send email, so the reset link that would normally
sit here cannot exist. Signing in returns the teacher to whatever they were reaching for rather
than always to the Agenda. Note that this is a sign-in, not a Session — the domain word is taken,
and Login never uses it.

**Setup**:
The first-run screen that creates the single account — name, email, password and its confirmation
— and then signs the teacher in. It is not merely available before there is an account, it is
compulsory: every other screen redirects here until one exists, and afterwards Setup itself
redirects away, so it is passed through exactly once in the planner's life. Shares Login's
signed-out treatment, outside the app shell, flush on a phone as Login is. One screen, not a stepped
wizard: four fields and a confirmation do not earn steps, and stepping them is the one choice here
that the end-to-end tests cannot survive. That there is no reset link is said on this screen rather
than on Login, as small print under the password field, because this is where the irreversible
choice is actually being made. Restore from a Backup is behind a line under the card, "Moving from
another planner?", which swaps the card for the Restore form and offers a link back. Its
instructions sit under the file field, not in a card description.
