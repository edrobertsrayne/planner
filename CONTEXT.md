# Planner

A personal electronic teacher planner for one UK state secondary school teacher. It holds what is
*planned* to be taught, lays that plan onto the real school calendar, and keeps it correct when
teaching does not go to plan.

The central distinction in this domain is between **planning** and **scheduling**. A Lesson is
something you planned; a Session is an occasion on which you taught it. Almost every subtlety in
the model follows from keeping those two apart.

## Language

### Planning

**Course**:
A sequence of teaching for one group over a sustained period, such as "Year 9 Physics". Composed
of Topics, in order.
_Avoid_: Scheme of work, syllabus, curriculum, module, unit

**Topic**:
A named block of teaching within a Course, such as "Forces". Composed of Lessons, in order.
_Avoid_: Unit, module, block, chapter

**Lesson**:
One planned teaching episode within a Topic — the plan, not the event. Exists whether or not it
has ever been taught, and is shared by every Class following the Course.
_Avoid_: Period, session, class

### Scheduling

**Class**:
A group of pupils taught as a unit, identified by a label such as "9B/Sc1". A Class follows one
Course at a time and has its own Slots. It is a label and a timetable only — it holds no
information about individual pupils.
_Avoid_: Group, set, form, cohort

**Slot**:
A recurring position in the Timetable when a given Class is taught, such as "Week A, Monday,
Period 3". A Slot describes when teaching *can* happen, not what is taught.
_Avoid_: Lesson, session, booking

**Session**:
A single dated occasion on which a Lesson is taught to a Class, occupying one Slot on one date.
The place where anything class-specific lives, including notes on how the teaching actually went.
_Avoid_: Teaching period, period, occurrence, instance, event

**Timetable**:
The full recurring pattern of Slots across the two-week cycle.

**Week A / Week B**:
The two halves of the fortnightly cycle that the Timetable repeats on. Which of the two any given
calendar week falls in is fixed by the Term dates.

### The Calendar

**Term**:
A contiguous stretch of the academic year during which teaching happens, bounded by dates and
divided by a half-term break.

**Closure**:
A date on which the school is not teaching, such as an INSET day, a bank holiday or snow. Applies
to every Class.
_Avoid_: Holiday, cancellation, non-pupil day

**Absence**:
A date on which this teacher is not teaching, such as a course, a trip or illness, while the
school itself is open. Applies only to this teacher's Classes.
_Avoid_: Leave, cover, cancellation

**Available Slot**:
A Slot on a date that falls within a Term and is affected by no Closure or Absence — that is, a
Slot on which teaching can actually take place.

### Rescheduling

**Shift-right**:
The rule governing every disruption: when a Lesson cannot be taught as scheduled, it and every
Lesson after it in the Course move to the next Available Slots for that Class, preserving the
order of the Course. The alternative — skipping a Lesson so later ones keep their dates — is
deliberately not supported.
_Avoid_: Reschedule, push back, bump

**Continuation**:
A Session marked as needing more time, so that its Lesson also occupies the following Available
Slot. The Course is unchanged; only that Class's Sessions shift.
_Avoid_: Split, extend, carry over, overrun
