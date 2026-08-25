<script lang="ts">
	import { classTone } from '$lib/class-tone';
	import {
		classLabel,
		classToneIndex,
		dateText,
		soonest,
		statusTone,
		type MockLesson,
		type Status
	} from './data';
	import StreamShell from './stream-shell.svelte';

	// A — the prototyped row, third rung removed, plus Ed's three amendments (#108, second pass):
	// the Class label wears its Class Tone, the rungs run Planned then Draft so progress moves
	// leftward toward the Lesson, and the selected rung carries a subtle status colour.

	let {
		lessons,
		setStatus,
		onOpen
	}: {
		lessons: MockLesson[];
		setStatus: (id: string, status: Status) => void;
		onOpen: (lesson: MockLesson) => void;
	} = $props();

	// Planned first: the ladder reads right-to-left, so a Lesson moves toward the title as it
	// gains substance.
	const RUNGS: { key: Status; name: string }[] = [
		{ key: 'planned', name: 'Planned' },
		{ key: 'draft', name: 'Draft' }
	];
</script>

<StreamShell
	{lessons}
	note="A — Segmented control, hard right. Planned then Draft, tinted by status; the Class label wears its Class Tone."
>
	{#snippet row(lesson: MockLesson)}
		{@const s = soonest(lesson)}
		<li class="flex items-center gap-3 rounded-lg border bg-card px-3 py-2">
			<div class="flex w-28 shrink-0 flex-col items-end gap-0.5">
				{#if s}
					{@const tone = classTone(classToneIndex(s.classId))}
					<div class="text-sm font-medium tabular-nums">{dateText(s)}</div>
					<div class="flex items-center gap-1.5">
						<span class="text-xs text-muted-foreground tabular-nums">{s.period}</span>
						<span
							class="rounded-2xl px-2 py-0.5 text-xs font-medium"
							style:background-color={tone.bg}
							style:color={tone.fg}
						>
							{classLabel(s.classId)}
						</span>
					</div>
				{:else}
					<div class="text-sm text-muted-foreground">—</div>
					<div class="text-[11px] text-muted-foreground">unscheduled</div>
				{/if}
			</div>

			<div class="min-w-0 flex-1 border-l pl-3">
				<button
					type="button"
					class="text-left text-sm font-medium hover:underline"
					onclick={() => onOpen(lesson)}
				>
					{lesson.title}
				</button>
				<p class="truncate text-xs text-muted-foreground">
					{lesson.topicName} · {lesson.courseName}
				</p>
			</div>

			<div class="flex shrink-0 overflow-hidden rounded-md border text-xs" role="group">
				{#each RUNGS as rung (rung.key)}
					{@const on = lesson.status === rung.key}
					<button
						type="button"
						aria-pressed={on}
						class="px-2 py-1.5 font-medium transition-colors {on
							? ''
							: 'text-muted-foreground hover:bg-muted'}"
						style:background-color={on ? statusTone(rung.key).bg : undefined}
						style:color={on ? statusTone(rung.key).fg : undefined}
						onclick={() => setStatus(lesson.id, rung.key)}
					>
						{rung.name}
					</button>
				{/each}
			</div>
		</li>
	{/snippet}
</StreamShell>
