<!--
	PROTOTYPE ONLY (issue #307). Variant A: one list, grouped by teaching week. The Class filter is a
	row of Class chips; Draft/Planned is a segmented control. No page size: the weeks break the
	list up, and the window scrolls. The whole row opens the Lesson editor.
-->
<script lang="ts">
	import { classTone } from '$lib/class-tone';
	import { formatShortWeekday } from '$lib/date';
	import { statusTone } from '$lib/feedback-tone';
	import TagChips from '$lib/components/tag-chips.svelte';
	import ClassChip from './ClassChip.svelte';
	import StatusToggle from './StatusToggle.svelte';
	import { byWeek } from './parts';
	import { CLASSES, classParam, stream, to, type Status } from './store.svelte';

	let filter = $state<'all' | Status>('all');
	const classId = $derived(classParam());
	const rows = $derived(stream(classId));
	const shown = $derived(filter === 'all' ? rows : rows.filter((r) => r.status === filter));
	const groups = $derived(byWeek(shown));
	const tally = $derived({
		all: rows.length,
		draft: rows.filter((r) => r.status === 'draft').length,
		planned: rows.filter((r) => r.status === 'planned').length
	});
</script>

<div class="mx-auto max-w-5xl px-4 py-6 md:px-6">
	<h1 class="text-xl font-semibold">Planning</h1>
	<p class="text-sm text-muted-foreground">Every Lesson, soonest taught first.</p>

	<div class="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
		<div
			class="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0"
			role="group"
			aria-label="Filter by Class"
		>
			<a
				href={to({ class: null })}
				class="rounded-2xl border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap {classId
					? 'text-muted-foreground hover:bg-muted'
					: 'border-transparent bg-primary text-primary-foreground'}">All Classes</a
			>
			{#each CLASSES as c (c.id)}
				{@const on = classId === c.id}
				{@const t = classTone(c.tone)}
				<a
					href={to({ class: on ? null : c.id })}
					class="rounded-2xl border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap"
					style:background-color={on ? t.bg : undefined}
					style:color={on ? t.fg : undefined}
					style:border-color={on ? 'transparent' : t.ring}
				>
					{c.label}
				</a>
			{/each}
		</div>

		<div class="flex w-fit rounded-md border p-0.5 text-xs" role="group" aria-label="Status">
			{#each [['all', 'All'], ['draft', 'Draft'], ['planned', 'Planned']] as [key, name] (key)}
				{@const on = filter === key}
				{@const t = key === 'all' ? null : statusTone(key as Status)}
				<button
					type="button"
					aria-pressed={on}
					class="rounded px-2.5 py-1 font-medium {on && !t
						? 'bg-primary text-primary-foreground'
						: on
							? ''
							: 'text-muted-foreground hover:bg-muted'}"
					style:background-color={on && t ? t.bg : undefined}
					style:color={on && t ? t.fg : undefined}
					onclick={() => (filter = key as typeof filter)}
				>
					{name} <span class="tabular-nums opacity-60">{tally[key as keyof typeof tally]}</span>
				</button>
			{/each}
		</div>
	</div>

	{#each groups as g (g.key)}
		<section class="mt-6">
			<h2
				class="sticky top-[var(--shell-top)] z-10 flex items-baseline gap-2 border-b bg-background/95 py-2 text-sm font-semibold backdrop-blur"
			>
				{g.label}
				<span class="text-xs font-normal text-muted-foreground">
					{g.rows.length} Lessons · {g.rows.filter((r) => r.status === 'draft').length} Draft
				</span>
			</h2>
			<ul class="divide-y">
				{#each g.rows as r (r.id)}
					{@const o = r.occurrence}
					<li>
						<svelte:element
							this={!r.topicName && !o ? 'div' : 'a'}
							href={!r.topicName && !o ? undefined : to({ lesson: r.id })}
							class="grid grid-cols-[1fr_auto] items-start gap-x-4 gap-y-1 px-1 py-3 md:grid-cols-[8.5rem_1fr_auto] md:items-center {!r.topicName &&
							!o
								? ''
								: 'hover:bg-muted/50'}"
						>
							<div
								class="flex items-center gap-2 text-xs text-muted-foreground md:flex-col md:items-start md:gap-1"
							>
								{#if o}
									<span class="font-medium text-foreground tabular-nums"
										>{formatShortWeekday(o.date)}</span
									>
									<span class="flex items-center gap-1.5">
										<span class="tabular-nums">P{o.period}</span>
										<ClassChip label={o.label} tone={o.tone} />
									</span>
								{:else}
									<span>Not scheduled</span>
								{/if}
							</div>
							<div class="col-start-1 row-start-2 min-w-0 md:col-start-2 md:row-start-1">
								<div class="text-sm font-medium">{r.title}</div>
								<div class="text-xs text-muted-foreground">
									{r.topicName ? `${r.topicName} · ${r.courseName}` : 'Standalone Lesson'}
								</div>
								<TagChips tags={r.tags} class="mt-1" />
							</div>
							<div class="col-start-2 row-start-1 justify-self-end md:col-start-3">
								<StatusToggle id={r.id} status={r.status} />
							</div>
						</svelte:element>
					</li>
				{/each}
			</ul>
		</section>
	{:else}
		<p class="mt-6 rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
			No Lessons to show
		</p>
	{/each}
</div>
