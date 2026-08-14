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
only part of one in a year.
_Avoid_: Scheme of work, syllabus, curriculum, module, unit

**Topic**:
A named block of teaching within a Course, such as "Forces". Composed of Lessons, in order.
Belongs to exactly one Course and holds no position within it; the order teaching happens in is
fixed per Class by its Assigned Topics.
_Avoid_: Unit, module, block, chapter

**Lesson**:
One planned teaching episode within a Topic — the plan, not the event. Exists whether or not it
has ever been taught, and is shared by every Class assigned its Topic. A title alone constitutes
a Lesson; the notes and the links to resources held elsewhere arrive as planning catches up.
_Avoid_: Period, session, class

**Planned Length**:
The number of Periods a Lesson is planned to occupy, defaulting to one. Distinct from a
Continuation: Planned Length belongs to the Lesson and so applies to every Class assigned its
Topic, whereas a Continuation is a reaction to how one Class's teaching actually went. A Lesson
longer than one Period takes the next Available Slots in order like any other, and may therefore
run across two days rather than falling on a timetabled double.
_Avoid_: Duration, double, span, periods

### Scheduling

**Class**:
A group of pupils taught as a unit, identified by a label such as "9B/Sc1". A Class follows
exactly one Course, fixed when the Class is created, which limits the Topics it may be given; what
it actually teaches is the subset of those Topics assigned to it. It has its own Slots, and is
scoped to one academic year — next year's teaching is new Classes, not these ones carried forward.
It is a label, a Course and a timetable only — it holds no information about individual pupils.
_Avoid_: Group, set, form, cohort

**Assigned Topic**:
One Topic given to one Class to teach, at a position in that Class's order. A Class begins the
year with none and accumulates them one at a time as the Topics are written, so the teaching order
is decided as it is reached rather than planned in advance. The assignment carries a position and
nothing else — no status and no date, both of which are derivable. The Topic must belong to the
Class's Course. Assigned Topics are what the schedule is derived from: their Lessons, flattened in
order, are the sequence laid onto that Class's Available Slots.
_Avoid_: Assignment (means homework), allocation, scheduled topic

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

**Session**:
A single dated occasion on which a Lesson is taught to a Class, occupying one Slot on one date.
The place where anything class-specific lives, including notes on how the teaching actually went.
A Session is identified by its occasion — Class, date and Period — not by its Lesson, so notes
stay put when a Rewind changes which Lesson that occasion carried.
_Avoid_: Teaching period, occurrence, instance, event

**Timetable**:
The full recurring pattern of Slots across the two-week cycle.

**Teaching Week**:
A calendar week in which at least one day is taught. A week falling entirely inside a break is not
a Teaching Week and takes no turn in the Week A / Week B cycle.

**Week A / Week B**:
The two halves of the fortnightly cycle that the Timetable repeats on. The letters alternate across
Teaching Weeks, the first Teaching Week of the academic year being Week A — so a break never
changes which letter falls next. Which letter a week carries is recorded, not recalculated.

### The Calendar

**Term**:
A contiguous stretch of the academic year during which teaching happens, bounded by an opening and
a closing date and containing no break. There are six in a year. What the school calls the "Autumn
Term" is two Terms here, separated by the half-term break.
_Avoid_: Half-term, block, semester

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

### Rescheduling

**Shift-right**:
The rule governing every disruption: when a Lesson cannot be taught as scheduled, it and every
Lesson after it in that Class's sequence move to the next Available Slots for that Class,
preserving the order of the sequence. The alternative — skipping a Lesson so later ones keep their
dates — is deliberately not supported. Shift-right is not an operation anyone performs; it is what
falls out of laying the Class's Assigned Topics onto the Available Slots that remain.
_Avoid_: Reschedule, push back, bump

**Rewind**:
Re-deriving the record back to an earlier date, so that Sessions already recorded are relabelled.
Needed when a Blocked Day or Blocked Slot is entered after the fact, because what was taught on
the days following it was not what the record claims. Scheduling otherwise never writes before
today.
_Avoid_: Undo, replay, recalculate, backdate

**Continuation**:
A Session marked as needing more time, so that its Lesson also occupies the following Available
Slot. The Course is unchanged; only that Class's Sessions shift.
_Avoid_: Split, extend, carry over, overrun

## Views

Names for the screens, not for anything in the domain. Recorded so that issues, tests and code
agree on what to call them.

**Agenda**:
The chronological stream of upcoming Sessions across every Class, grouped by day, reaching a
horizon the teacher chooses. Where the planner opens.

**Calendar**:
One Teaching Week as a grid of Periods against days, showing which Class is taught when and what
each Session carries. Note that this names a _screen_; the Terms, Blocked Days and Blocked Slots
it draws on are the calendar _model_, and "the calendar" unqualified means the model.

**Classes**:
One card per Class — a **lane** — showing how far through its Assigned Topics it has got, what was
last taught, and what is queued next. Keyed by Class rather than by time. Opening a lane leads to
that Class's Class page.

**Class page**:
The single surface for one Class: its lane, its own view of the fortnight, and the Topics assigned
to it. The only place a Class is created, timetabled or given a Topic — there is no screen showing
every Class's Timetable at once, because the Timetable is only ever read or written one Class at a
time. Periods belonging to another Class are shown as unavailable rather than hidden, since a
position can hold only one Class on any given date; that is where the Slot uniqueness rule is
enforced. Changes take effect from a date the teacher chooses, defaulting to the start of the
year, so ending one Slot and starting another is ordinary editing rather than a special operation.

**Courses**:
Where Course content is written. Three panes — Courses, then that Course's Topics, then that
Topic's Lessons in order — with a new Course, a new Topic and a new Lesson each created by typing
a name into the foot of its own pane. The only screen that reads or writes Courses, Topics and
Lessons. Unlike the other three it is a writing surface, and it is where the planner is used on a
Sunday rather than during a teaching week.

**Lesson editor**:
The single surface for one Lesson — its title, its markdown body, its links and its Planned
Length. Opens as a modal over the Courses view, and steps to the next or previous Lesson in the
Topic without closing. Distinct from the Session panel: the Lesson editor writes the plan shared
by every Class, the Session panel writes one Class's occasion.

**Session panel**:
The single surface for one Session — its Lesson's plan and links, the note on the occasion, and
the Continuation control. Opened from any of the three reading views; there is no other place a
Session is read or written.
