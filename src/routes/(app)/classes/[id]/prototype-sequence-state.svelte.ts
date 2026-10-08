// PROTOTYPE, throwaway (issue #372). One Class's Sequence held in the browser. Every change is
// in memory; only the dates come from the server, which runs the real engine over the order.
import { deserialize } from '$app/forms';
import { formatShortWeekday } from '$lib/date';
import type { ProtoEntry, ProtoLayout, ProtoTopic } from './prototype-sequence.server';

export type { ProtoEntry, ProtoLayout, ProtoTopic };

export const dateLabel = (p: { date: string; period: number } | undefined) =>
	p ? `${formatShortWeekday(p.date)} P${p.period}` : '';

// A steady pale colour per Topic, so interleaved Topics read apart at a glance.
export function topicColour(topicId: string | null) {
	if (!topicId) return 'hsl(0 0% 92%)';
	let h = 0;
	for (const c of topicId) h = (h * 31 + c.charCodeAt(0)) % 360;
	return `hsl(${h} 70% 90%)`;
}

export class ProtoSequence {
	entries = $state<ProtoEntry[]>([]);
	layout = $state<ProtoLayout>({ parts: {}, unplaced: {}, locked: [], lastSlot: null });
	// The layout the "was" dates compare with: the one before the last change, or (draft mode)
	// the last saved one.
	baseline = $state<ProtoLayout>({ parts: {}, unplaced: {}, locked: [], lastSlot: null });
	saved = $state<ProtoEntry[]>([]);
	message = $state<{ tone: 'ok' | 'refused'; text: string } | null>(null);
	lastMoved = $state<string | null>(null);
	topics: ProtoTopic[];
	private nextNew = 1;

	// Where to ask for a layout: the host page's `?/prototypeLayout` action.
	classId: string;
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

	firstAny = (id: string) => this.layout.parts[id]?.[0];
	was = (id: string) => this.baseline.parts[id]?.[0];
	pastEnd = (id: string) => (this.layout.unplaced[id] ?? 0) > 0;
	wasPastEnd = (id: string) => (this.baseline.unplaced[id] ?? 0) > 0;
	changed = (id: string) => {
		const now = this.firstAny(id);
		const before = this.was(id);
		if (!before && !now) return this.pastEnd(id) !== this.wasPastEnd(id);
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

	// Moves `ids` (in their present order) so they sit at index `to` of the list without them.
	moveTo(ids: string[], to: number, { draft = false } = {}) {
		if (ids.some(this.isLocked)) return this.refuse('A taught Lesson cannot move.');
		const rest = this.entries.filter((e) => !ids.includes(e.id));
		const moving = this.entries.filter((e) => ids.includes(e.id));
		const lockedInRest = rest.filter((e) => this.isLocked(e.id)).length;
		if (to < lockedInRest) return this.refuse('Nothing can move in front of a taught Lesson.');
		this.entries = [...rest.slice(0, to), ...moving, ...rest.slice(to)];
		this.lastMoved = ids.length === 1 ? ids[0] : null;
		return this.commit(
			ids.length === 1 ? `Moved “${moving[0].title}”.` : `Moved ${ids.length} Lessons.`,
			draft
		);
	}

	moveBy(id: string, delta: number) {
		const i = this.entries.findIndex((e) => e.id === id);
		return this.moveTo([id], i + delta);
	}

	// `afterId` null means the start of the untaught part.
	moveAfter(ids: string[], afterId: string | null, opts: { draft?: boolean } = {}) {
		const rest = this.entries.filter((e) => !ids.includes(e.id));
		const to =
			afterId === null
				? rest.filter((e) => this.isLocked(e.id)).length
				: rest.findIndex((e) => e.id === afterId) + 1;
		return this.moveTo(ids, to, opts);
	}

	remove(id: string, opts: { draft?: boolean } = {}) {
		const entry = this.entries.find((e) => e.id === id)!;
		if (this.isLocked(id))
			return this.refuse(`“${entry.title}” was taught, so it stays in this Class's Sequence.`);
		this.entries = this.entries.filter((e) => e.id !== id);
		return this.commit(
			`Removed “${entry.title}” from this Class. The Lesson itself stays.`,
			opts.draft
		);
	}

	addLesson(title: string, afterId: string | null, opts: { draft?: boolean } = {}) {
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
		this.lastMoved = entry.id;
		return this.commit(`Added the Standalone Lesson “${entry.title}”.`, opts.draft);
	}

	overlap(topicId: string) {
		const topic = this.topics.find((t) => t.id === topicId)!;
		const ids = this.entries.map((e) => e.id);
		return {
			inSequence: topic.lessons.filter((l) => ids.includes(l.id)).length,
			total: topic.lessons.length
		};
	}

	assignTopic(topicId: string, opts: { draft?: boolean } = {}) {
		const topic = this.topics.find((t) => t.id === topicId)!;
		const ids = this.entries.map((e) => e.id);
		const added = topic.lessons.filter((l) => !ids.includes(l.id));
		const skipped = topic.lessons.length - added.length;
		this.entries = [...this.entries, ...added];
		this.lastMoved = null;
		return this.commit(
			`Assigned ${topic.name}: added ${added.length} Lesson${added.length === 1 ? '' : 's'} at the end` +
				(skipped ? `, skipped ${skipped} already in this Sequence.` : '.'),
			opts.draft
		);
	}

	save() {
		this.saved = this.entries;
		this.baseline = this.layout;
		this.message = { tone: 'ok', text: 'Saved the order.' };
	}

	discard() {
		this.entries = this.saved;
		this.message = null;
		void this.relayout().then(() => (this.baseline = this.layout));
	}

	private commit(text: string, draft = false) {
		if (!draft) {
			this.baseline = this.layout;
			this.saved = this.entries;
		}
		void this.relayout().then(() => {
			const later = this.changedCount;
			const past = this.pastEndCount;
			this.message = {
				tone: 'ok',
				text:
					text +
					(later ? ` ${later} Lesson${later === 1 ? '' : 's'} change date.` : ' No dates change.') +
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
		// An older answer must not overwrite the layout a newer request already set.
		if (mine !== this.sent) return;
		if (result.type !== 'success' || !result.data || !('layout' in result.data)) return;
		// Our own action's answer, shaped by `prototypeLayout`.
		const layout = result.data.layout as ProtoLayout;
		this.layout = layout;
	}
}
