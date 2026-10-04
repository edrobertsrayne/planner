<!--
	PROTOTYPE ONLY (issue #307). Variant D departs from the "a row opens the Lesson editor" pattern.
	From `xl`: three columns. A rail of Classes with their Draft counts, a compact list, and a
	preview of the chosen Lesson: every Class that teaches it next, its Tags, Draft/Planned, and
	"Open in Lesson editor". A click on a row previews it; a double-click opens the editor. Below
	`xl` there is no preview: a row opens the Lesson editor, and the Classes move behind a "Class"
	button into a sheet.
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { classTone } from '$lib/class-tone';
	import { formatShortWeekday } from '$lib/date';
	import { statusTone } from '$lib/feedback-tone';
	import TagChips from '$lib/components/tag-chips.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Sheet from '$lib/components/ui/sheet';
	import FilterIcon from '@lucide/svelte/icons/list-filter';
	import ClassChip from './ClassChip.svelte';
	import StatusToggle from './StatusToggle.svelte';
	import { when } from './parts';
	import { CLASSES, classParam, daysUntil, stream, to, type Entry } from './store.svelte';

	const classId = $derived(classParam());
	const rows = $derived(stream(classId));
	const all = $derived(stream(null));
	let picked = $state<string | null>(null);
	const pick = $derived(rows.find((r) => r.id === picked) ?? rows[0] ?? null);
	let sheet = $state(false);

	const drafts = (id: string | null) =>
		(id ? stream(id) : all).filter((r) => r.status === 'draft').length;
	const opens = (r: Entry) => !!(r.topicName || r.occurrence);

	function onclick(e: MouseEvent, r: Entry) {
		if (window.matchMedia('(min-width: 1280px)').matches) {
			e.preventDefault();
			picked = r.id;
		}
	}
</script>

{#snippet classList()}
	<nav class="flex flex-col gap-0.5 text-sm" aria-label="Class">
		{#each [null, ...CLASSES.map((c) => c.id)] as id (id)}
			{@const c = CLASSES.find((k) => k.id === id)}
			{@const on = classId === id}
			<a
				href={to({ class: id })}
				onclick={() => (sheet = false)}
				class="flex items-center gap-2 rounded-md px-2.5 py-1.5 {on
					? 'bg-muted font-medium'
					: 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'}"
			>
				{#if c}
					<span class="size-2 rounded-full" style:background-color={classTone(c.tone).fg}></span>
					{c.label}
				{:else}
					All Classes
				{/if}
				<span class="ml-auto text-xs tabular-nums" title="Draft Lessons">{drafts(id)}</span>
			</a>
		{/each}
	</nav>
{/snippet}

<div class="px-4 py-6 md:px-6">
	<div class="flex items-center justify-between gap-3">
		<div>
			<h1 class="text-xl font-semibold">Planning</h1>
			<p class="text-sm text-muted-foreground">Every Lesson, soonest taught first.</p>
		</div>
		<Button variant="outline" size="sm" class="xl:hidden" onclick={() => (sheet = true)}>
			<FilterIcon />
			{CLASSES.find((c) => c.id === classId)?.label ?? 'All Classes'}
		</Button>
	</div>

	<div class="mt-5 grid grid-cols-1 gap-6 xl:grid-cols-[11rem_minmax(0,1fr)_24rem]">
		<aside class="hidden xl:block">
			<div class="sticky top-6">
				<p class="mb-2 px-2.5 text-xs font-medium text-muted-foreground">Class · Draft</p>
				{@render classList()}
			</div>
		</aside>

		<ul class="divide-y rounded-lg border">
			{#each rows as r (r.id)}
				{@const o = r.occurrence}
				{@const on = pick?.id === r.id}
				<li>
					<svelte:element
						this={opens(r) ? 'a' : 'div'}
						href={opens(r) ? to({ lesson: r.id }) : undefined}
						onclick={(e: MouseEvent) => onclick(e, r)}
						ondblclick={() => opens(r) && goto(to({ lesson: r.id }))}
						class="flex items-center gap-3 px-3 py-2 {on ? 'xl:bg-muted' : 'hover:bg-muted/50'}"
						role={opens(r) ? undefined : 'button'}
						tabindex={opens(r) ? undefined : 0}
					>
						<span
							class="size-2 shrink-0 rounded-full"
							style:background-color={statusTone(r.status).fg}
							title={r.status === 'draft' ? 'Draft' : 'Planned'}
						></span>
						<span class="min-w-0 flex-1">
							<span class="block truncate text-sm font-medium xl:truncate">{r.title}</span>
							<span class="block truncate text-xs text-muted-foreground">
								{r.topicName ?? 'Standalone Lesson'}
							</span>
						</span>
						<span class="shrink-0 text-right text-xs text-muted-foreground tabular-nums">
							{#if o}
								<span class="block">{formatShortWeekday(o.date)}</span>
								<span class="block">P{o.period} · {o.label}</span>
							{:else}
								—
							{/if}
						</span>
					</svelte:element>
				</li>
			{/each}
		</ul>

		<aside class="hidden xl:block">
			{#if pick}
				<div class="sticky top-6 rounded-lg border bg-card p-4">
					<p class="text-xs text-muted-foreground">
						{pick.topicName ? `${pick.courseName} › ${pick.topicName}` : 'Standalone Lesson'}
					</p>
					<h2 class="mt-1 text-base font-semibold">{pick.title}</h2>
					<TagChips tags={pick.tags} class="mt-2" />
					<div class="mt-4 flex items-center justify-between">
						<span class="text-xs font-medium text-muted-foreground">Status</span>
						<StatusToggle id={pick.id} status={pick.status} />
					</div>
					<div class="mt-4">
						<p class="text-xs font-medium text-muted-foreground">Taught next</p>
						<ul class="mt-1.5 space-y-1 text-sm">
							{#each Object.values(pick.byClass) as o (o.classId)}
								<li class="flex items-center gap-2">
									<ClassChip label={o.label} tone={o.tone} />
									<span class="tabular-nums">{formatShortWeekday(o.date)} · P{o.period}</span>
									<span class="ml-auto text-xs text-muted-foreground"
										>{when(daysUntil(o.date))}</span
									>
								</li>
							{:else}
								<li class="text-muted-foreground">Not scheduled</li>
							{/each}
						</ul>
					</div>
					<div class="mt-4 rounded-md border border-dashed p-3 text-xs text-muted-foreground">
						The first lines of the plan, read-only, go here.
					</div>
					{#if opens(pick)}
						<Button class="mt-4 w-full" href={to({ lesson: pick.id })}>Open in Lesson editor</Button
						>
					{/if}
				</div>
			{/if}
		</aside>
	</div>
</div>

<Sheet.Root bind:open={sheet}>
	<Sheet.Content side="bottom" class="max-h-[80vh] gap-2 overflow-y-auto p-4">
		<Sheet.Title class="text-sm">Show Lessons for</Sheet.Title>
		{@render classList()}
	</Sheet.Content>
</Sheet.Root>
