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

**Period**:
One of the six numbered teaching positions in a school day, P1 to P6. Every day has the same six.
A Period is a position in the day, not a time of day — the planner never needs the clock.
_Avoid_: Lesson, session, hour

**Slot**:
A recurring position in the Timetable when a given Class is taught, such as "Week A, Monday,
Period 3". A Slot describes when teaching *can* happen, not what is taught. A Slot *holds* over a
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
Lesson after it in the Course move to the next Available Slots for that Class, preserving the
order of the Course. The alternative — skipping a Lesson so later ones keep their dates — is
deliberately not supported. Shift-right is not an operation anyone performs; it is what falls out
of laying the Course onto the Available Slots that remain.
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
