<!--
	PROTOTYPE ONLY (issue #307). Variant B: a table that uses the full width. One column per fact:
	next taught, Class, Lesson, Topic, Course, Tags, status. The Class filter stays a dropdown, in a
	toolbar with the status tabs. "Show more" replaces the page-size buttons. Below `lg` Topic and
	Course fold under the title; on a phone each row is a card. The whole row opens the Lesson editor.
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { formatShortWeekday } from '$lib/date';
	import TagChips from '$lib/components/tag-chips.svelte';
	import * as Select from '$lib/components/ui/select/index.js';
	import ClassChip from './ClassChip.svelte';
	import StatusToggle from './StatusToggle.svelte';
	import { CLASSES, classParam, stream, to, type Entry, type Status } from './store.svelte';

	let filter = $state<'all' | Status>('all');
	let limit = $state(25);
	const classId = $derived(classParam());
	const rows = $derived(stream(classId));
	const shown = $derived(filter === 'all' ? rows : rows.filter((r) => r.status === filter));
	const visible = $derived(shown.slice(0, limit));
	const tally = $derived({
		all: rows.length,
		draft: rows.filter((r) => r.status === 'draft').length,
		planned: rows.filter((r) => r.status === 'planned').length
	});
	const opens = (r: Entry) => !!(r.topicName || r.occurrence);
	const open = (r: Entry) => opens(r) && goto(to({ lesson: r.id }));
</script>

<div class="px-4 py-6 md:px-6">
	<div class="flex flex-wrap items-end justify-between gap-3">
		<div>
			<h1 class="text-xl font-semibold">Planning</h1>
			<p class="text-sm text-muted-foreground">Every Lesson, soonest taught first.</p>
		</div>
		<div class="flex flex-wrap items-center gap-2">
			<Select.Root
				type="single"
				value={classId ?? 'all'}
				onValueChange={(v) => goto(to({ class: v === 'all' ? null : v }), { replaceState: true })}
			>
				<Select.Trigger size="sm" class="w-40" aria-label="Filter by Class">
					{CLASSES.find((c) => c.id === classId)?.label ?? 'All Classes'}
				</Select.Trigger>
				<Select.Content>
					<Select.Item value="all" label="All Classes" />
					{#each CLASSES as c (c.id)}
						<Select.Item value={c.id} label={c.label} />
					{/each}
				</Select.Content>
			</Select.Root>
			<div class="flex border-b text-sm" role="tablist">
				{#each [['all', 'All'], ['draft', 'Draft'], ['planned', 'Planned']] as [key, name] (key)}
					<button
						type="button"
						role="tab"
						aria-selected={filter === key}
						class="-mb-px border-b-2 px-3 py-1.5 font-medium {filter === key
							? 'border-primary text-foreground'
							: 'border-transparent text-muted-foreground hover:text-foreground'}"
						onclick={() => (filter = key as typeof filter)}
					>
						{name}
						<span class="text-xs tabular-nums opacity-60">{tally[key as keyof typeof tally]}</span>
					</button>
				{/each}
			</div>
		</div>
	</div>

	<!-- Tablet and up: a table. -->
	<table class="mt-5 hidden w-full text-sm md:table">
		<thead
			class="sticky top-[var(--shell-top)] z-10 bg-background text-left text-xs text-muted-foreground"
		>
			<tr class="border-b">
				<th class="w-32 py-2 pr-3 font-medium">Next taught</th>
				<th class="w-16 py-2 pr-3 font-medium">Class</th>
				<th class="py-2 pr-3 font-medium">Lesson</th>
				<th class="hidden w-56 py-2 pr-3 font-medium xl:table-cell">Topic</th>
				<th class="hidden w-36 py-2 pr-3 font-medium xl:table-cell">Course</th>
				<th class="hidden w-40 py-2 pr-3 font-medium lg:table-cell">Tags</th>
				<th class="w-36 py-2 font-medium">Status</th>
			</tr>
		</thead>
		<tbody>
			{#each visible as r (r.id)}
				{@const o = r.occurrence}
				<tr
					class="border-b align-top {opens(r) ? 'cursor-pointer hover:bg-muted/50' : ''}"
					onclick={() => open(r)}
				>
					<td class="py-2 pr-3 whitespace-nowrap tabular-nums">
						{#if o}
							{formatShortWeekday(o.date)} <span class="text-muted-foreground">P{o.period}</span>
						{:else}
							<span class="text-muted-foreground">—</span>
						{/if}
					</td>
					<td class="py-2 pr-3"
						>{#if o}<ClassChip label={o.label} tone={o.tone} />{/if}</td
					>
					<td class="py-2 pr-3">
						<a
							href={opens(r) ? to({ lesson: r.id }) : undefined}
							class="font-medium hover:underline"
							onclick={(e) => e.stopPropagation()}>{r.title}</a
						>
						<div class="text-xs text-muted-foreground xl:hidden">
							{r.topicName ? `${r.topicName} · ${r.courseName}` : 'Standalone Lesson'}
						</div>
						<TagChips tags={r.tags} class="mt-1 lg:hidden" />
					</td>
					<td class="hidden py-2 pr-3 text-muted-foreground xl:table-cell">
						{r.topicName ?? 'Standalone Lesson'}
					</td>
					<td class="hidden py-2 pr-3 text-muted-foreground xl:table-cell">{r.courseName ?? ''}</td>
					<td class="hidden py-2 pr-3 lg:table-cell"><TagChips tags={r.tags} /></td>
					<td class="py-1.5"><StatusToggle id={r.id} status={r.status} compact /></td>
				</tr>
			{/each}
		</tbody>
	</table>

	<!-- Phone: one card per row. -->
	<ul class="mt-4 space-y-2 md:hidden">
		{#each visible as r (r.id)}
			{@const o = r.occurrence}
			<li>
				<svelte:element
					this={opens(r) ? 'a' : 'div'}
					href={opens(r) ? to({ lesson: r.id }) : undefined}
					class="block rounded-lg border bg-card p-3"
				>
					<div class="flex items-center gap-2 text-xs text-muted-foreground">
						{#if o}
							<span class="font-medium text-foreground">{formatShortWeekday(o.date)}</span>
							<span>P{o.period}</span>
							<ClassChip label={o.label} tone={o.tone} />
						{:else}
							Not scheduled
						{/if}
						<span class="ml-auto"><StatusToggle id={r.id} status={r.status} /></span>
					</div>
					<div class="mt-1.5 text-sm font-medium">{r.title}</div>
					<div class="text-xs text-muted-foreground">
						{r.topicName ? `${r.topicName} · ${r.courseName}` : 'Standalone Lesson'}
					</div>
				</svelte:element>
			</li>
		{/each}
	</ul>

	{#if shown.length > visible.length}
		<div class="mt-4 flex items-center justify-center gap-3 text-xs text-muted-foreground">
			Showing {visible.length} of {shown.length}
			<button
				type="button"
				class="rounded-md border px-2.5 py-1 font-medium hover:bg-muted"
				onclick={() => (limit += 25)}
			>
				Show 25 more
			</button>
		</div>
	{/if}
</div>
