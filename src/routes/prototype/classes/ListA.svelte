<!--
	PROTOTYPE — throwaway. List variant A — "Lane cards".
	Today's shape, rebuilt on rhea: one Card per Class, stacked in a single readable column, each
	carrying the whole lane — progress, last taught, next up, Runway. Argues Classes is a status
	report you read top to bottom.
-->
<script lang="ts">
	import * as Card from '$lib/components/ui/card/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Progress } from '$lib/components/ui/progress/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import PageHeader from './PageHeader.svelte';
	import NewClassDialog from './NewClassDialog.svelte';
	import { LANES, COURSE_TOPICS, fmtLong } from './fixtures';

	let open = $state(false);
</script>

<div class="mx-auto max-w-3xl px-6 py-6">
	<PageHeader
		title="Classes"
		description="Every Class you teach, and how far through its plan it is."
	>
		{#snippet actions()}
			<Button size="sm" onclick={() => (open = true)}><PlusIcon />New Class</Button>
		{/snippet}
	</PageHeader>

	<ul class="space-y-3">
		{#each LANES as lane (lane.classId)}
			<li>
				<Card.Root class="gap-0 py-4">
					<Card.Header class="gap-0 px-4">
						<div class="flex flex-wrap items-center gap-2">
							<a href="##" class="text-sm font-semibold hover:underline">{lane.classLabel}</a>
							<Badge variant="outline">{lane.courseName}</Badge>
							<span class="ml-auto text-xs text-muted-foreground tabular-nums">
								{lane.taught} / {lane.total} Lessons taught
							</span>
						</div>
						<Progress value={lane.taught} max={lane.total} class="mt-2 h-1.5" />
					</Card.Header>

					<Card.Content class="px-4 pt-3">
						<dl class="flex flex-wrap gap-x-8 gap-y-1 text-xs">
							<div class="flex min-w-0 gap-1.5">
								<dt class="text-muted-foreground">Last taught</dt>
								<dd class="min-w-0">
									{#if lane.lastTaught}
										<button type="button" class="text-left font-medium hover:underline">
											{lane.lastTaught.title}
										</button>
										{#if lane.lastTaught.note}
											<span class="text-muted-foreground"> — {lane.lastTaught.note}</span>
										{/if}
									{:else}
										<span class="text-muted-foreground">Not taught yet</span>
									{/if}
								</dd>
							</div>
							<div class="flex gap-1.5">
								<dt class="text-muted-foreground">Next up</dt>
								<dd class="font-medium">{lane.nextUp?.title ?? '—'}</dd>
							</div>
							<div class="flex gap-1.5">
								<dt class="text-muted-foreground">Runway</dt>
								<dd class="font-medium">
									{lane.runway.date ? fmtLong(lane.runway.date) : 'open-ended'}
									{#if lane.runway.lessonsRemaining}
										<span class="font-normal text-muted-foreground">
											({lane.runway.lessonsRemaining} Lessons with no Slot left to carry them)
										</span>
									{/if}
								</dd>
							</div>
						</dl>
					</Card.Content>

					<Card.Footer class="mt-3 flex-wrap gap-2 border-t px-4 pt-3">
						<Select.Root type="single">
							<Select.Trigger size="sm" class="w-56">Assign next Topic…</Select.Trigger>
							<Select.Content>
								{#each COURSE_TOPICS as t (t.id)}
									<Select.Item value={t.id} label={t.name} />
								{/each}
							</Select.Content>
						</Select.Root>
						<Button variant="ghost" size="sm" class="ml-auto" href="##">
							Open Class page<ChevronRightIcon />
						</Button>
					</Card.Footer>
				</Card.Root>
			</li>
		{/each}
	</ul>
</div>

<NewClassDialog bind:open />
