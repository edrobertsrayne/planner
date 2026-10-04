<!--
	PROTOTYPE ONLY (issue #307). Variant C: two lanes. Draft on the left, Planned on the right, each
	in stream order, so the left lane reads as "what to write next". A card moves lanes with one
	button. Below `lg` one lane shows at a time, chosen by two tabs (Draft first). The Class filter
	is a strip of Class tabs. The card's title opens the Lesson editor.
-->
<script lang="ts">
	import { classTone } from '$lib/class-tone';
	import { formatShortWeekday } from '$lib/date';
	import { statusTone } from '$lib/feedback-tone';
	import TagChips from '$lib/components/tag-chips.svelte';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import ClassChip from './ClassChip.svelte';
	import { when } from './parts';
	import {
		CLASSES,
		classParam,
		daysUntil,
		setStatus,
		stream,
		to,
		type Entry,
		type Status
	} from './store.svelte';

	let lane = $state<Status>('draft');
	const classId = $derived(classParam());
	const rows = $derived(stream(classId));
	const lanes = $derived({
		draft: rows.filter((r) => r.status === 'draft'),
		planned: rows.filter((r) => r.status === 'planned')
	});
	const LANES: { key: Status; name: string; hint: string }[] = [
		{ key: 'draft', name: 'Draft', hint: 'Still to write, soonest first' },
		{ key: 'planned', name: 'Planned', hint: 'Written and approved' }
	];
</script>

{#snippet card(r: Entry)}
	{@const o = r.occurrence}
	{@const days = o ? daysUntil(o.date) : null}
	<li class="rounded-lg border bg-card p-3">
		<div class="flex items-center gap-2 text-xs text-muted-foreground">
			{#if o}
				<ClassChip label={o.label} tone={o.tone} />
				<span class="tabular-nums">{formatShortWeekday(o.date)} · P{o.period}</span>
				<span
					class="ml-auto {r.status === 'draft' && days! <= 7
						? 'font-semibold text-foreground'
						: ''}"
				>
					{when(days!)}
				</span>
			{:else}
				<span>Not scheduled</span>
			{/if}
		</div>
		{#if r.topicName || o}
			<a href={to({ lesson: r.id })} class="mt-1.5 block text-sm font-medium hover:underline"
				>{r.title}</a
			>
		{:else}
			<div class="mt-1.5 text-sm font-medium">{r.title}</div>
		{/if}
		<div class="text-xs text-muted-foreground">
			{r.topicName ? `${r.topicName} · ${r.courseName}` : 'Standalone Lesson'}
		</div>
		<div class="mt-2 flex items-end gap-2">
			<TagChips tags={r.tags} />
			{#if r.status === 'draft'}
				<button
					type="button"
					class="ml-auto hidden shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium hover:bg-muted md:inline-flex"
					onclick={() => setStatus(r.id, 'planned')}
				>
					Mark Planned <ArrowRightIcon class="size-3" />
				</button>
			{:else}
				<button
					type="button"
					class="ml-auto hidden shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted md:inline-flex"
					onclick={() => setStatus(r.id, 'draft')}
				>
					<ArrowLeftIcon class="size-3" /> Back to Draft
				</button>
			{/if}
		</div>
	</li>
{/snippet}

<div class="px-4 py-6 md:px-6">
	<h1 class="text-xl font-semibold">Planning</h1>
	<p class="text-sm text-muted-foreground">What is still Draft, and what is Planned.</p>

	<div
		class="-mx-4 mt-4 flex overflow-x-auto border-b px-4 md:mx-0 md:px-0"
		role="tablist"
		aria-label="Class"
	>
		<a
			href={to({ class: null })}
			class="-mb-px border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap {classId
				? 'border-transparent text-muted-foreground hover:text-foreground'
				: 'border-primary'}">All Classes</a
		>
		{#each CLASSES as c (c.id)}
			{@const on = classId === c.id}
			<a
				href={to({ class: c.id })}
				class="-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap {on
					? ''
					: 'border-transparent text-muted-foreground hover:text-foreground'}"
				style:border-color={on ? classTone(c.tone).fg : undefined}
			>
				<span class="size-2 rounded-full" style:background-color={classTone(c.tone).fg}></span>
				{c.label}
			</a>
		{/each}
	</div>

	<!-- Below lg: one lane at a time. -->
	<div class="mt-4 flex w-fit rounded-md border p-0.5 text-sm lg:hidden" role="tablist">
		{#each LANES as l (l.key)}
			{@const on = lane === l.key}
			{@const t = statusTone(l.key)}
			<button
				type="button"
				role="tab"
				aria-selected={on}
				class="rounded px-3 py-1 font-medium {on ? '' : 'text-muted-foreground'}"
				style:background-color={on ? t.bg : undefined}
				style:color={on ? t.fg : undefined}
				onclick={() => (lane = l.key)}
			>
				{l.name} <span class="tabular-nums opacity-60">{lanes[l.key].length}</span>
			</button>
		{/each}
	</div>

	<div class="mt-4 grid gap-6 lg:grid-cols-2">
		{#each LANES as l (l.key)}
			{@const t = statusTone(l.key)}
			<section class={lane === l.key ? '' : 'hidden lg:block'}>
				<header
					class="mb-3 hidden items-baseline gap-2 border-b-2 pb-2 lg:flex"
					style:border-color={t.fg}
				>
					<h2 class="text-sm font-semibold">{l.name}</h2>
					<span class="text-xs text-muted-foreground tabular-nums">{lanes[l.key].length}</span>
					<span class="ml-auto text-xs text-muted-foreground">{l.hint}</span>
				</header>
				<ul class="space-y-2">
					{#each lanes[l.key] as r (r.id)}
						{@render card(r)}
					{:else}
						<li
							class="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground"
						>
							No {l.name} Lessons
						</li>
					{/each}
				</ul>
			</section>
		{/each}
	</div>
</div>
