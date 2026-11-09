<script lang="ts">
	import { resolve } from '$app/paths';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import { formatWeekday } from '$lib/date';
	import { kindLabel, positionLabel } from '$lib/events';
	import PageHeader from '$lib/components/page-header.svelte';
	import { Badge, Button } from '$lib/ui';
	import NewEventDialog from './NewEventDialog.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head><title>Events</title></svelte:head>

<div class="mx-auto max-w-6xl px-6 py-6">
	<PageHeader title="Events" />

	{#if data.events.length === 0}
		<div class="mt-6 rounded-xl border border-dashed px-6 py-12 text-center">
			<p class="text-sm font-medium">No Events yet</p>
			<p class="mt-1 text-sm text-muted-foreground">
				A meeting, a club or an intervention group that repeats. It takes a Period, or the time
				before or after school, that no Class holds.
			</p>
			<NewEventDialog>
				{#snippet trigger(props)}
					<Button {...props} size="sm" class="mt-4 max-md:hidden">
						<PlusIcon data-icon="inline-start" />New Event
					</Button>
				{/snippet}
			</NewEventDialog>
		</div>
	{:else}
		<ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
			{#each data.events as event (event.id)}
				<li class="flex flex-col overflow-hidden rounded-xl border bg-surface">
					<a
						href={resolve(`/events/${event.id}`)}
						class="flex flex-1 flex-col gap-3 p-4 hover:bg-muted"
					>
						<span class="flex items-start justify-between gap-2">
							<span class="block text-sm font-semibold">{event.name}</span>
							<Badge variant="outline">{kindLabel(event.kind)}</Badge>
						</span>
						<dl class="mt-auto space-y-1 text-xs">
							<div class="flex gap-1.5">
								<dt class="shrink-0 text-muted-foreground">Next</dt>
								<dd class="min-w-0">
									{#if event.next}
										{formatWeekday(event.next.date)}, {positionLabel(event.next.position)}
									{:else if event.slotCount === 0}
										<span class="text-muted-foreground">Not on the Timetable yet</span>
									{:else}
										<span class="text-muted-foreground">—</span>
									{/if}
								</dd>
							</div>
							<div class="flex gap-1.5">
								<dt class="shrink-0 text-muted-foreground">Slots</dt>
								<dd class="tabular-nums">{event.slotCount}</dd>
							</div>
						</dl>
					</a>
				</li>
			{/each}

			<!-- Nothing is written on a phone, so the New Event tile is not there. -->
			<li class="max-md:hidden">
				<NewEventDialog>
					{#snippet trigger(props)}
						<button
							{...props}
							type="button"
							class="flex h-full min-h-32 w-full flex-col items-center justify-center gap-1 rounded-xl border border-dashed text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
						>
							<PlusIcon class="size-4" />
							<span class="text-sm font-medium">New Event</span>
						</button>
					{/snippet}
				</NewEventDialog>
			</li>
		</ul>
	{/if}
</div>
