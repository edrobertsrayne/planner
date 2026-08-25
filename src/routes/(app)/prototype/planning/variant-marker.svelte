<script lang="ts">
	import CheckIcon from '@lucide/svelte/icons/check';
	import UndoIcon from '@lucide/svelte/icons/undo-2';
	import { classLabel, dateText, soonest, type MockLesson, type Status } from './data';
	import StreamShell from './stream-shell.svelte';

	// C — no control that shows both states at once. Two states is a fact, not a choice between
	// rungs, so the row states the fact and offers the one move available from it: a Draft row
	// offers "Mark Planned", a Planned row wears the mark and offers a quiet step back.
	// Status reads from the left rail, so the eye finds it while scanning titles.

	let {
		lessons,
		setStatus,
		onOpen
	}: {
		lessons: MockLesson[];
		setStatus: (id: string, status: Status) => void;
		onOpen: (lesson: MockLesson) => void;
	} = $props();
</script>

<StreamShell
	{lessons}
	note="C — Status as a left rail and a single action. No two-state control: a Draft row offers Mark Planned, a Planned row wears the mark and offers a step back."
>
	{#snippet row(lesson: MockLesson)}
		{@const s = soonest(lesson)}
		{@const planned = lesson.status === 'planned'}
		<li
			class="flex items-stretch gap-0 overflow-hidden rounded-lg border bg-card"
			class:opacity-95={planned}
		>
			<div class="w-1 shrink-0 {planned ? 'bg-primary' : 'bg-border'}"></div>

			<div class="flex min-w-0 flex-1 items-center gap-3 px-3 py-2">
				<div class="w-24 shrink-0 text-right">
					{#if s}
						<div class="text-sm font-medium tabular-nums">{dateText(s)}</div>
						<div class="text-xs text-muted-foreground tabular-nums">
							{s.period} · {classLabel(s.classId)}
						</div>
					{:else}
						<div class="text-sm text-muted-foreground">—</div>
						<div class="text-[11px] text-muted-foreground">unscheduled</div>
					{/if}
				</div>

				<div class="min-w-0 flex-1 border-l pl-3">
					<div class="flex items-center gap-2">
						{#if planned}
							<span
								class="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary"
							>
								<CheckIcon class="size-3" /> Planned
							</span>
						{/if}
						<button
							type="button"
							class="truncate text-left text-sm font-medium hover:underline"
							onclick={() => onOpen(lesson)}
						>
							{lesson.title}
						</button>
					</div>
					<p class="truncate text-xs text-muted-foreground">
						{lesson.topicName} · {lesson.courseName}
					</p>
				</div>

				<div class="shrink-0">
					{#if planned}
						<button
							type="button"
							title="Move back to Draft"
							aria-label="Move {lesson.title} back to Draft"
							class="rounded-md border px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted"
							onclick={() => setStatus(lesson.id, 'draft')}
						>
							<UndoIcon class="size-3.5" />
						</button>
					{:else}
						<button
							type="button"
							class="rounded-md border px-2.5 py-1.5 text-xs transition-colors hover:bg-muted"
							onclick={() => setStatus(lesson.id, 'planned')}
						>
							Mark Planned
						</button>
					{/if}
				</div>
			</div>
		</li>
	{/snippet}
</StreamShell>
