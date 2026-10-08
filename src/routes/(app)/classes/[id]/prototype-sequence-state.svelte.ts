// PROTOTYPE, throwaway (issue #372). One Class's Sequence held in the browser. Every change is
// in memory; only the dates come from the server, which runs the real engine over the order.
import { deserialize } from '$app/forms';
import { formatShortWeekday } from '$lib/date';
import type { ProtoEntry, ProtoLayout, ProtoTopic } from './prototype-sequence.server';

export type { ProtoEntry, ProtoLayout, ProtoTopic };

export const dateLabel = (p: { date: string; period: number } | undefined) =>
	p ? `${formatShortWeekday(p.date)} P${p.period}` : '';

// A steady tint per Topic, so interleaved Topics read apart at a glance. Translucent, so the
// text keeps the theme's own colour in light and dark alike.
export function topicColour(topicId: string | null, strength = 0.22) {
	if (!topicId) return `hsl(0 0% 50% / ${strength})`;
	let h = 0;
	for (const c of topicId) h = (h * 31 + c.charCodeAt(0)) % 360;
	return `hsl(${h} 75% 55% / ${strength})`;
}

const EMPTY: ProtoLayout = {
	parts: {},
	unplaced: {},
	locked: [],
	lastSlot: null,
	stream: [],
	weeks: []
};

// One Slot of the stream and the Lesson it holds, if any.
export interface ProtoCell {
	date: string;
	period: number;
	lessonId: string | null;
	part: number;
	of: number;
}

export class ProtoSequence {
	entries = $state<ProtoEntry[]>([]);
	layout = $state<ProtoLayout>(EMPTY);
	// The layout the "was" dates compare with: the one before the last change (at once), or the
	// last saved one (draft).
	baseline = $state<ProtoLayout>(EMPTY);
	saved = $state<ProtoEntry[]>([]);
	message = $state<{ tone: 'ok' | 'refused'; text: string } | null>(null);
	lastMoved = $state<string[]>([]);
	// Draft: changes wait for Save order. At once: every change is kept as it is made.
	draft = $state(false);
	topics: ProtoTopic[];
	classId: string;
	private nextNew = 1;
	// The newest request wins: quick taps must not let an older answer overwrite a newer layout.
	private sent = 0;

	constructor(entries: ProtoEntry[], layout: ProtoLayout, topics: ProtoTopic[], classId: string) {
		this.entries = entries;
		this.saved = entries;
		this.layout = layout;
		this.baseline = layout;
		this.topics = topics;
		this.classId = classId;
	}

	isLocked = (id: string) => this.layout.locked.includes(id);

	// The taught part is a prefix: nothing moves in front of a locked Lesson (#371).
	get firstMovable() {
		let last = -1;
		this.entries.forEach((e, i) => {
			if (this.isLocked(e.id)) last = i;
		});
		return last + 1;
	}

	first = (id: string) => this.layout.parts[id]?.[0];
	was = (id: string) => this.baseline.parts[id]?.[0];
	pastEnd = (id: string) => (this.layout.unplaced[id] ?? 0) > 0;
	changed = (id: string) => {
		if (this.isLocked(id)) return false;
		const now = this.first(id);
		const before = this.was(id);
		if (!now && !before) return false;
		return now?.date !== before?.date || now?.period !== before?.period;
	};

	get dirty() {
		return this.entries.map((e) => e.id).join() !== this.saved.map((e) => e.id).join();
	}
	get changedCount() {
		return this.entries.filter((e) => this.changed(e.id)).length;
	}
	get pastEndCount() {
		return this.entries.filter((e) => this.pastEnd(e.id)).length;
	}

	private refuse(text: string) {
		this.message = { tone: 'refused', text };
		return false;
	}

	// The order with `ids` put at index `to` of the list without them, or the reason it cannot be.
	reorder(ids: string[], to: number): ProtoEntry[] | string {
		if (ids.some(this.isLocked)) return 'A taught Lesson cannot move.';
		const rest = this.entries.filter((e) => !ids.includes(e.id));
		const moving = this.entries.filter((e) => ids.includes(e.id));
		if (to < rest.filter((e) => this.isLocked(e.id)).length)
			return 'Nothing can move in front of a taught Lesson.';
		return [...rest.slice(0, to), ...moving, ...rest.slice(to)];
	}

	// Moves `ids` (in their present order) so they sit at index `to` of the list without them.
	moveTo(ids: string[], to: number) {
		const order = this.reorder(ids, to);
		if (typeof order === 'string') return this.refuse(order);
		const moving = order.filter((e) => ids.includes(e.id));
		this.entries = order;
		this.lastMoved = ids;
		return this.commit(
			moving.length === 1 ? `Moved “${moving[0].title}”.` : `Moved ${moving.length} Lessons.`
		);
	}

	// The Slots each Lesson's parts fill, for any order. This is the engine's own rule (owed parts,
	// in order, onto the fixed stream of Slots), run in the browser so a drag can show its result
	// before the drop.
	fill(order: ProtoEntry[]) {
		// Parts come from the layout, not from Length: a Continuation adds a part (engine `demandFor`).
		const count = (e: ProtoEntry) => {
			const known = e.id in this.layout.parts || e.id in this.layout.unplaced;
			if (!known) return { done: 0, owed: e.length };
			const parts = this.layout.parts[e.id] ?? [];
			const inStream = parts.filter((p) =>
				this.layout.stream.some((s) => s.date === p.date && s.period === p.period)
			).length;
			return {
				done: parts.length - inStream,
				owed: inStream + (this.layout.unplaced[e.id] ?? 0)
			};
		};
		const queue: { lessonId: string; part: number; of: number }[] = [];
		for (const e of order) {
			const { done, owed } = count(e);
			for (let i = 0; i < owed; i++)
				queue.push({ lessonId: e.id, part: done + i + 1, of: done + owed });
		}
		const cells: ProtoCell[] = this.layout.stream.map((s, i) => ({
			...s,
			...(queue[i] ?? { lessonId: null, part: 0, of: 0 })
		}));
		const pastEnd = queue
			.slice(cells.length)
			.map((q) => q.lessonId)
			.filter((id, i, all) => all.indexOf(id) === i);
		return { cells, pastEnd };
	}

	moveBy(id: string, delta: number) {
		const i = this.entries.findIndex((e) => e.id === id);
		return this.moveTo([id], i + delta);
	}

	// `afterId` null means the start of the untaught part.
	moveAfter(ids: string[], afterId: string | null) {
		const rest = this.entries.filter((e) => !ids.includes(e.id));
		const to =
			afterId === null
				? rest.filter((e) => this.isLocked(e.id)).length
				: rest.findIndex((e) => e.id === afterId) + 1;
		return this.moveTo(ids, to);
	}

	// A drop on a Lesson takes its place: the dragged Lesson ends at the target's index, and the
	// Lessons between shift one place towards where the dragged one came from. In the list without
	// the dragged Lesson, the target's own index puts it after a target below and before one above.
	takePlaceOrder = (id: string, targetId: string) =>
		this.reorder(
			[id],
			this.entries.findIndex((e) => e.id === targetId)
		);
	takePlace = (id: string, targetId: string) =>
		this.moveTo(
			[id],
			this.entries.findIndex((e) => e.id === targetId)
		);

	remove(ids: string[]) {
		const taught = this.entries.find((e) => ids.includes(e.id) && this.isLocked(e.id));
		if (taught) return this.refuse(`“${taught.title}” was taught, so it stays in this Sequence.`);
		const gone = this.entries.filter((e) => ids.includes(e.id));
		this.entries = this.entries.filter((e) => !ids.includes(e.id));
		this.lastMoved = [];
		return this.commit(
			gone.length === 1
				? `Removed “${gone[0].title}” from this Class. The Lesson itself stays.`
				: `Removed ${gone.length} Lessons from this Class. The Lessons themselves stay.`
		);
	}

	addLesson(title: string, afterId: string | null) {
		const entry: ProtoEntry = {
			id: `new-${this.nextNew++}`,
			title: title || 'Untitled Lesson',
			topicId: null,
			topicName: null,
			length: 1,
			status: 'draft',
			note: null
		};
		const at =
			afterId === null ? this.firstMovable : this.entries.findIndex((e) => e.id === afterId) + 1;
		if (at < this.firstMovable) return this.refuse('A new Lesson goes after the taught part.');
		this.entries = [...this.entries.slice(0, at), entry, ...this.entries.slice(at)];
		this.lastMoved = [entry.id];
		return this.commit(`Added the Standalone Lesson “${entry.title}”.`);
	}

	overlap(topicId: string) {
		const topic = this.topics.find((t) => t.id === topicId)!;
		const ids = this.entries.map((e) => e.id);
		return {
			inSequence: topic.lessons.filter((l) => ids.includes(l.id)).length,
			total: topic.lessons.length
		};
	}

	assignTopic(topicId: string) {
		const topic = this.topics.find((t) => t.id === topicId)!;
		const ids = this.entries.map((e) => e.id);
		const added = topic.lessons.filter((l) => !ids.includes(l.id));
		const skipped = topic.lessons.length - added.length;
		this.entries = [...this.entries, ...added];
		this.lastMoved = added.map((l) => l.id);
		return this.commit(
			`Assigned ${topic.name}: added ${added.length} Lesson${added.length === 1 ? '' : 's'} at the end` +
				(skipped ? `, skipped ${skipped} already in this Sequence.` : '.')
		);
	}

	save() {
		this.saved = this.entries;
		this.baseline = this.layout;
		this.message = { tone: 'ok', text: 'Saved the order.' };
	}

	discard() {
		this.entries = this.saved;
		this.lastMoved = [];
		this.message = null;
		void this.relayout();
	}

	private commit(text: string) {
		if (!this.draft) {
			this.baseline = this.layout;
			this.saved = this.entries;
		}
		void this.relayout().then(() => {
			const n = this.changedCount;
			const past = this.pastEndCount;
			this.message = {
				tone: 'ok',
				text:
					text +
					(n ? ` ${n} Lesson${n === 1 ? '' : 's'} change date.` : ' No dates change.') +
					(past ? ` ${past} past the end of the year.` : '')
			};
		});
		return true;
	}

	async relayout() {
		const mine = ++this.sent;
		const body = new FormData();
		body.set('classId', this.classId);
		body.set('lessons', JSON.stringify(this.entries.map((e) => ({ id: e.id, length: e.length }))));
		const response = await fetch('?/prototypeLayout', {
			method: 'POST',
			body,
			headers: { 'x-sveltekit-action': 'true' }
		});
		const result = deserialize(await response.text());
		if (mine !== this.sent) return;
		if (result.type !== 'success' || !result.data || !('layout' in result.data)) return;
		// Our own action's answer, shaped by `prototypeLayout`.
		const layout = result.data.layout as ProtoLayout;
		this.layout = layout;
	}
}
