<script lang="ts">
	// PROTOTYPE — throwaway. The lane card the Classes view settled on in #6,
	// lifted here so the setup screens can be judged inside the real view rather
	// than beside an invented one. Shared by A and B on purpose: it is the fixed
	// point both variants have to fit around, like a shared header.
	//
	// The one change #18 forces: progress is measured against the Class's
	// **Assigned Topics**, never its Course — so the bars run out when the
	// assigned sequence does, which is exactly the runway question #19 will pick
	// up.
	import { NOTES, TONE, courseById, laneOf, whenLabel } from './fixtures.svelte';
	import type { Snippet } from 'svelte';

	let { classId, onopen, footer }: { classId: string; onopen?: () => void; footer?: Snippet } =
		$props();

	const lane = $derived(laneOf(classId));
	const tone = $derived(TONE[lane.cls.tone]);
	const note = $derived(lane.last ? (NOTES[lane.cls.id] ?? '') : '');
</script>

<article class="flex flex-col rounded-xl border border-neutral-200 bg-white">
	<div class="border-b border-neutral-100 px-4 pt-3 pb-3">
		<div class="flex items-baseline justify-between">
			<button
				class="rounded px-2 py-0.5 text-sm font-bold ring-1 {tone.chip}"
				onclick={() => onopen?.()}>{lane.cls.label}</button
			>
			<span class="text-xs text-neutral-400">{lane.done} of {lane.total} Lessons</span>
		</div>
		<div class="mt-2 text-xs text-neutral-500">
			{lane.cls.courseId ? courseById(lane.cls.courseId).name : 'no Course yet'}
		</div>

		<!-- one bar per Assigned Topic, in this Class's order -->
		<div class="mt-2 flex gap-0.5">
			{#each lane.topics as t (t.topic.id)}
				<div
					class="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-200"
					title="{t.topic.name} — {t.done} of {t.total}"
				>
					<div
						class="h-full {tone.dot}"
						style="width: {t.total ? Math.round((t.done / t.total) * 100) : 0}%"
					></div>
				</div>
			{/each}
			{#if !lane.topics.length}
				<div class="h-1.5 flex-1 rounded-full bg-neutral-100"></div>
			{/if}
		</div>
		<div class="mt-1.5 text-xs font-medium text-neutral-700">
			{#if lane.current}
				{lane.current.topic.name}
				<span class="font-normal text-neutral-400"
					>· Topic {lane.topics.indexOf(lane.current) + 1} of {lane.topics.length}</span
				>
			{:else}
				<span class="font-normal text-neutral-400">No Topics assigned yet</span>
			{/if}
		</div>
	</div>

	{#if lane.last}
		<div class="px-4 py-3">
			<div class="text-[11px] font-bold tracking-wider text-neutral-400 uppercase">
				Last taught · {whenLabel(lane.last)}
			</div>
			<div class="mt-0.5 text-sm text-neutral-600">{lane.last.lesson.title}</div>
			{#if note}
				<p class="mt-1.5 border-l-2 border-neutral-200 pl-2 text-xs text-neutral-500 italic">
					{note}
				</p>
			{/if}
		</div>
	{/if}

	<div class="mt-auto border-t border-neutral-100 px-4 py-3">
		<div class="text-[11px] font-bold tracking-wider text-neutral-400 uppercase">Next up</div>
		<ol class="mt-1.5 space-y-1">
			{#each lane.next.slice(0, 4) as n, i (n.date + n.period)}
				<li class="flex gap-2 px-1 py-0.5 text-sm {i === 0 ? '' : 'opacity-60'}">
					<span class="w-28 shrink-0 font-mono text-xs {i === 0 ? '' : 'text-neutral-400'}"
						>{whenLabel(n)}</span
					>
					<span class="min-w-0 flex-1 truncate {i === 0 ? 'font-medium' : ''}"
						>{n.lesson.title}</span
					>
				</li>
			{/each}
			{#if !lane.next.length}
				<li class="px-1 py-0.5 text-sm text-neutral-400">
					{lane.topics.length ? 'Nothing left to teach.' : 'Nothing assigned to teach.'}
				</li>
			{/if}
		</ol>
		{#if lane.next.length && lane.next.length < 5}
			<p class="mt-2 rounded bg-orange-50 px-2 py-1 text-[11px] text-orange-800">
				Only {lane.next.length} Lessons left in the assigned Topics.
			</p>
		{/if}
		{#if footer}{@render footer()}{/if}
	</div>
</article>
