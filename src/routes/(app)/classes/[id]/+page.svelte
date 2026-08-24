<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { toast } from 'svelte-sonner';
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import ChevronUpIcon from '@lucide/svelte/icons/chevron-up';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import XIcon from '@lucide/svelte/icons/x';
	import { openSession } from '$lib/client/session-panel.svelte';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let assignForm = $state<HTMLFormElement | undefined>();

	const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
	const PERIODS = [1, 2, 3, 4, 5, 6];
	const WEEKS = ['A', 'B'] as const;

	function slotAt(week: (typeof WEEKS)[number], day: number, period: number) {
		return data.grid.find((s) => s.week === week && s.day === day && s.period === period) ?? null;
	}

	function labelOf(classId: string) {
		return data.classes.find((c) => c.id === classId)?.label ?? classId;
	}

	const fmtLong = (iso: string) =>
		new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', {
			day: 'numeric',
			month: 'long',
			year: 'numeric',
			timeZone: 'UTC'
		});

	function onFail(fallback: string): SubmitFunction {
		return () =>
			async ({ result, update }) => {
				if (result.type === 'failure') {
					toast.error(String((result.data as { error?: string } | undefined)?.error ?? fallback));
				} else {
					await update({ invalidateAll: true });
				}
			};
	}

	function setAsAt(date: string) {
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- carries a query string
		goto(`?from=${date}`, {
			replaceState: true,
			noScroll: true,
			keepFocus: true,
			invalidateAll: true
		});
	}

	// Named stops: start of year, today, and every date this Class's own Slots start or stop
	// holding — the "Timetable as at" control's job is to make those, plus any date at all, a
	// first-class position to view or edit from (issue #93).
	const stops = $derived.by(() => {
		const dates: string[] = [data.today];
		if (data.yearStart) dates.push(data.yearStart);
		for (const s of data.datedSlots) {
			if (s.holdsFrom) dates.push(s.holdsFrom);
			if (s.holdsTo) dates.push(s.holdsTo);
		}
		const unique = dates.filter((d, i) => dates.indexOf(d) === i);
		return unique.sort().map((date) => ({
			date,
			label:
				date === data.yearStart
					? `Start of year — ${fmtLong(date)}`
					: date === data.today
						? `Today — ${fmtLong(date)}`
						: fmtLong(date)
		}));
	});

	const isPast = $derived(data.on < data.today);
</script>

<svelte:head><title>{data.class.label}</title></svelte:head>

<div class="mx-auto max-w-6xl px-6 py-6">
	<!-- eslint-disable svelte/no-navigation-without-resolve -- static internal route -->
	<a
		href="/classes"
		class="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
	>
		<ChevronLeftIcon class="size-3" />Classes
	</a>
	<!-- eslint-enable svelte/no-navigation-without-resolve -->

	<div class="mt-3 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
		<section class="min-w-0">
			<div class="flex flex-wrap items-baseline justify-between gap-2">
				<h2 class="text-sm font-semibold">Timetable</h2>
				<span class="text-xs text-muted-foreground tabular-nums">
					{data.grid.filter((s) => s.classId === data.class.id).length} Slots a fortnight
				</span>
			</div>

			<div class="mt-2 flex flex-wrap items-center gap-2">
				<span class="text-xs font-medium text-muted-foreground">Timetable as at</span>
				<Select.Root type="single" value={data.on} onValueChange={(v) => v && setAsAt(v)}>
					<Select.Trigger size="sm" class="h-7 w-56 text-xs">
						{fmtLong(data.on)}
					</Select.Trigger>
					<Select.Content>
						{#each stops as s (s.date)}
							<Select.Item value={s.date} label={s.label} />
						{/each}
					</Select.Content>
				</Select.Root>
				<input
					type="date"
					class="h-7 rounded-md border bg-transparent px-2 text-xs"
					value={data.on}
					onchange={(e) => setAsAt(e.currentTarget.value)}
					aria-label="Timetable as at — pick any date"
				/>
				{#if isPast}
					<Badge variant="outline" class="text-muted-foreground">Read-only — past</Badge>
				{/if}
			</div>

			<div class="mt-3 rounded-xl border p-4">
				{#if form?.error}
					<p role="alert" class="mb-3 text-xs text-destructive">{form.error}</p>
				{/if}

				<div class="space-y-5">
					{#each WEEKS as w (w)}
						<div>
							<div class="mb-2 flex items-baseline gap-2">
								<h3 class="text-sm font-semibold">Week {w}</h3>
								<span class="text-xs text-muted-foreground tabular-nums">
									{data.grid.filter((s) => s.week === w && s.classId === data.class.id).length} Slots
								</span>
								<div class="ml-2 h-px flex-1 bg-border"></div>
							</div>

							<table class="w-full border-separate border-spacing-1">
								<thead>
									<tr>
										<th class="w-10"></th>
										{#each DAYS as d (d)}
											<th class="w-1/5 pb-1 text-xs font-medium text-muted-foreground">{d}</th>
										{/each}
									</tr>
								</thead>
								<tbody>
									{#each PERIODS as p (p)}
										<tr>
											<th
												class="pr-2 text-right text-xs font-normal whitespace-nowrap text-muted-foreground"
											>
												P{p}
											</th>
											{#each DAYS as d, i (d)}
												{@const day = i + 1}
												{@const slot = slotAt(w, day, p)}
												{@const mine = slot?.classId === data.class.id}
												<td>
													{#if mine && isPast}
														<div
															class="flex h-8 w-full items-center justify-center rounded-md bg-primary/10 text-[11px] font-medium text-primary inset-ring inset-ring-primary/30"
															aria-label="Week {w} {d} P{p} — {data.class.label}, as at {fmtLong(
																data.on
															)}"
														>
															{data.class.label.split('/')[0]}
														</div>
													{:else if mine}
														<form
															method="POST"
															action="?/toggleSlot"
															use:enhance={onFail('Could not change the Timetable.')}
														>
															<input type="hidden" name="classId" value={data.class.id} />
															<input type="hidden" name="week" value={w} />
															<input type="hidden" name="day" value={day} />
															<input type="hidden" name="period" value={p} />
															<input type="hidden" name="from" value={data.on} />
															<Button
																type="submit"
																size="xs"
																class="h-8 w-full"
																aria-label="Week {w} {d} P{p} — {data.class.label}, click to clear"
															>
																{data.class.label.split('/')[0]}
															</Button>
														</form>
													{:else if slot}
														<div
															class="flex h-8 w-full cursor-not-allowed items-center justify-center rounded-md bg-muted/60 text-[11px] text-muted-foreground/80 inset-ring inset-ring-border"
															title="Held by {labelOf(slot.classId)}"
															aria-label="Week {w} {d} P{p} — held by {labelOf(slot.classId)}"
														>
															{labelOf(slot.classId)}
														</div>
													{:else if isPast}
														<div
															class="h-8 w-full rounded-md border border-dashed opacity-40"
															aria-label="Week {w} {d} P{p} — empty, as at {fmtLong(data.on)}"
														></div>
													{:else}
														<form
															method="POST"
															action="?/toggleSlot"
															use:enhance={onFail('Could not change the Timetable.')}
														>
															<input type="hidden" name="classId" value={data.class.id} />
															<input type="hidden" name="week" value={w} />
															<input type="hidden" name="day" value={day} />
															<input type="hidden" name="period" value={p} />
															<input type="hidden" name="from" value={data.on} />
															<Button
																type="submit"
																variant="outline"
																size="xs"
																class="h-8 w-full border-dashed text-muted-foreground/40 hover:border-solid hover:text-foreground"
																aria-label="Week {w} {d} P{p} — empty, click to give it to {data
																	.class.label}"
															>
																<PlusIcon class="size-3" />
															</Button>
														</form>
													{/if}
												</td>
											{/each}
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{/each}
				</div>

				<p class="mt-3 text-xs text-muted-foreground">
					A Period held by another Class carries its label. A double is two Periods, ticked
					separately.
				</p>

				{#if data.datedSlots.length}
					<div class="mt-4 rounded-lg bg-muted/40 px-3 py-2">
						<p class="text-xs font-medium">Slots that do not hold all year</p>
						<ul class="mt-1 space-y-0.5 text-xs text-muted-foreground">
							{#each data.datedSlots as s (s.id)}
								<li>
									<span class="font-medium text-foreground">
										Week {s.week} · {DAYS[s.day - 1]} · P{s.period}
									</span>
									{#if s.holdsFrom}from {fmtLong(s.holdsFrom)}{/if}
									{#if s.holdsTo}{s.holdsFrom ? ', ' : ''}until {fmtLong(s.holdsTo)}{/if}
								</li>
							{/each}
						</ul>
					</div>
				{/if}
			</div>
		</section>

		<aside class="space-y-5 lg:sticky lg:top-6 lg:self-start">
			<div>
				<h1 class="text-lg font-semibold tracking-tight">{data.class.label}</h1>
				<Badge variant="outline" class="mt-1">{data.class.courseName}</Badge>
				<p class="mt-2 text-xs text-muted-foreground">
					The Course is fixed at creation — a mis-pick means deleting the Class and starting again.
				</p>
			</div>

			{#if data.lane}
				<div>
					<div class="flex items-baseline justify-between text-xs">
						<span class="text-muted-foreground">Through the plan</span>
						<span class="font-medium tabular-nums">{data.lane.taught} / {data.lane.total}</span>
					</div>
					<div class="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
						<div
							class="h-full bg-primary"
							style:width="{data.lane.total
								? Math.round((data.lane.taught / data.lane.total) * 100)
								: 0}%"
						></div>
					</div>
					<dl class="mt-3 space-y-1.5 text-xs">
						<div>
							<dt class="text-muted-foreground">Last taught</dt>
							<dd>
								{#if data.lane.lastTaught}
									{@const lt = data.lane.lastTaught}
									<button
										type="button"
										data-session-trigger
										class="text-left font-medium hover:underline"
										onclick={() =>
											openSession({ classId: data.class.id, date: lt.date, period: lt.period })}
									>
										{lt.title}
									</button>
									{#if lt.note}<p class="mt-0.5 text-muted-foreground">{lt.note}</p>{/if}
								{:else}
									<span class="text-muted-foreground">Not taught yet.</span>
								{/if}
							</dd>
						</div>
						<div>
							<dt class="text-muted-foreground">Next up</dt>
							<dd class="font-medium">{data.lane.nextUp?.title ?? '—'}</dd>
						</div>
						<div>
							<dt class="text-muted-foreground">Runway</dt>
							<dd class="font-medium">
								{data.lane.runway.date ? fmtLong(data.lane.runway.date) : 'open-ended'}
								{#if data.lane.runway.lessonsRemaining > 0}
									<span class="font-normal text-muted-foreground">
										({data.lane.runway.lessonsRemaining} Lesson{data.lane.runway
											.lessonsRemaining === 1
											? ''
											: 's'} with no Slot left)
									</span>
								{/if}
							</dd>
						</div>
					</dl>
				</div>
				<Separator />
			{/if}

			<div>
				<h2 class="mb-2 text-sm font-semibold">Assigned Topics</h2>
				<p class="mb-2 text-xs text-muted-foreground">
					{data.class.label} teaches these, in this order — decide the next one as you reach it.
				</p>

				<ul class="divide-y rounded-lg border">
					{#if data.assignedTopics.length}
						{#each data.assignedTopics as a, i (a.id)}
							<li class="group flex items-stretch gap-2 py-1 pr-1 pl-3">
								<span class="self-center text-xs text-muted-foreground tabular-nums">{i + 1}</span>
								<span class="min-w-0 flex-1 self-center truncate text-sm">{a.topicName}</span>
								<div class="flex flex-col justify-center opacity-0 group-hover:opacity-100">
									<form
										method="POST"
										action="?/moveAssignedTopic"
										use:enhance={onFail('Could not move the Topic.')}
									>
										<input type="hidden" name="classId" value={data.class.id} />
										<input type="hidden" name="id" value={a.id} />
										<input type="hidden" name="direction" value="up" />
										<button
											type="submit"
											disabled={i === 0}
											aria-label="Move {a.topicName} earlier"
											class="rounded-t-sm px-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-20"
										>
											<ChevronUpIcon class="size-3" />
										</button>
									</form>
									<form
										method="POST"
										action="?/moveAssignedTopic"
										use:enhance={onFail('Could not move the Topic.')}
									>
										<input type="hidden" name="classId" value={data.class.id} />
										<input type="hidden" name="id" value={a.id} />
										<input type="hidden" name="direction" value="down" />
										<button
											type="submit"
											disabled={i === data.assignedTopics.length - 1}
											aria-label="Move {a.topicName} later"
											class="rounded-b-sm px-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-20"
										>
											<ChevronDownIcon class="size-3" />
										</button>
									</form>
								</div>
								<form
									method="POST"
									action="?/unassignTopic"
									use:enhance={onFail('Could not unassign the Topic.')}
								>
									<input type="hidden" name="classId" value={data.class.id} />
									<input type="hidden" name="id" value={a.id} />
									<Button
										type="submit"
										variant="ghost"
										size="icon-xs"
										class="self-center opacity-0 group-hover:opacity-100"
										aria-label="Unassign {a.topicName}"
									>
										<XIcon />
									</Button>
								</form>
							</li>
						{/each}
					{:else}
						<li class="px-2 py-1.5 text-xs text-muted-foreground">No Topics assigned yet.</li>
					{/if}

					{#if data.courseTopics.length}
						<li class="p-1">
							<form
								method="POST"
								action="?/assignTopic"
								bind:this={assignForm}
								use:enhance={onFail('Could not assign the Topic.')}
							>
								<input type="hidden" name="classId" value={data.class.id} />
								<input type="hidden" name="topicId" />
								<Select.Root
									type="single"
									onValueChange={(value) => {
										if (!assignForm || !value) return;
										(assignForm.elements.namedItem('topicId') as HTMLInputElement).value = value;
										assignForm.requestSubmit();
									}}
								>
									<Select.Trigger
										size="sm"
										class="w-full justify-start border-0 bg-transparent px-2 text-muted-foreground"
									>
										<PlusIcon class="size-3.5" />
										Assign next Topic
									</Select.Trigger>
									<Select.Content>
										{#each data.courseTopics as t (t.id)}
											<Select.Item value={t.id} label={t.name} />
										{/each}
									</Select.Content>
								</Select.Root>
							</form>
						</li>
					{:else}
						<li class="px-2 py-1.5 text-[11px] text-muted-foreground">
							This Course has no Topics yet.
						</li>
					{/if}
				</ul>
			</div>
		</aside>
	</div>
</div>
