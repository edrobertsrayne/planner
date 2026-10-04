<!-- PROTOTYPE ONLY (issue #311): the occasion, the Lesson, read-only Readiness and the link to the Lesson editor. -->
<script lang="ts">
	import ExternalLinkIcon from '@lucide/svelte/icons/square-pen';
	import XIcon from '@lucide/svelte/icons/x';
	import { toast } from 'svelte-sonner';
	import { formatWeekday } from '$lib/date';
	import TagChips from '$lib/components/tag-chips.svelte';
	import ClassChip from '../planning/prototype/ClassChip.svelte';
	import { TODAY, isReady } from '../prototype-agenda/store.svelte';
	import type { Detail } from './store.svelte';

	let {
		d,
		onclose,
		big = false,
		linkOnly = false
	}: { d: Detail; onclose?: () => void; big?: boolean; linkOnly?: boolean } = $props();
	const r = $derived(d.row);
</script>

{#if !linkOnly}
	<div class="flex items-start gap-2">
		<div class="min-w-0 flex-1">
			<div class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
				<ClassChip label={r.classLabel} tone={r.tone} />
				<span>
					{formatWeekday(r.date)} · P{r.periodFrom}{#if r.periodTo !== r.periodFrom}–P{r.periodTo}{/if}
				</span>
				{#if r.lesson && r.date >= TODAY}
					<span
						class="rounded-md border px-1.5 py-0.5 font-medium {isReady(r)
							? 'border-primary text-foreground'
							: ''}"
						title="Readiness is ticked on the Agenda">{isReady(r) ? 'Ready' : 'Not ready'}</span
					>
				{/if}
			</div>
			{#if r.lesson}
				<h2 class="mt-2 leading-snug font-semibold {big ? 'text-2xl' : 'text-lg'}">
					{r.lesson.title}
				</h2>
				<p class="mt-0.5 text-xs text-muted-foreground">
					{r.lesson.topicName ?? (d.placed ? 'Standalone Lesson · Placed' : 'Standalone Lesson')}
				</p>
				<TagChips tags={r.lesson.tags} class="mt-1.5" />
			{:else}
				<h2 class="mt-2 font-semibold text-muted-foreground italic {big ? 'text-2xl' : 'text-lg'}">
					Open Slot
				</h2>
				<p class="mt-0.5 text-xs text-muted-foreground">No Lesson planned for this occasion.</p>
			{/if}
		</div>
		{#if onclose}
			<button
				type="button"
				class="inline-flex size-11 shrink-0 items-center justify-center rounded-md hover:bg-muted md:size-8"
				aria-label="Close Session"
				onclick={onclose}><XIcon class="size-4" /></button
			>
		{/if}
	</div>
{/if}

{#if r.lesson}
	<button
		type="button"
		class="mt-3 inline-flex h-11 items-center gap-1.5 rounded-md border px-3 text-sm font-medium hover:bg-muted md:h-8 md:text-xs"
		onclick={() => toast(`Would open the Lesson editor at /lessons/${r.lesson?.id}`)}
	>
		<ExternalLinkIcon class="size-3.5" /> Open in Lesson editor
	</button>
{/if}
