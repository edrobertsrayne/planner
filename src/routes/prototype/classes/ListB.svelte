<!--
	PROTOTYPE — throwaway. List variant B — "The register".
	No cards. One dense Table: every Class on one line, every lane fact in its own column, so the
	six Classes are compared down a column rather than read one card at a time. Argues Classes is a
	register you scan for the outlier, not a report you read.
-->
<script lang="ts">
	import * as Table from '$lib/components/ui/table/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import PageHeader from './PageHeader.svelte';
	import NewClassDialog from './NewClassDialog.svelte';
	import { LANES, fmtShort } from './fixtures';

	let open = $state(false);

	const pct = (l: (typeof LANES)[number]) => (l.total ? Math.round((l.taught / l.total) * 100) : 0);
</script>

<div class="mx-auto max-w-6xl px-6 py-6">
	<PageHeader
		title="Classes"
		description="Six Classes. The Runway column is the one worth scanning."
	>
		{#snippet actions()}
			<Button size="sm" onclick={() => (open = true)}><PlusIcon />New Class</Button>
		{/snippet}
	</PageHeader>

	<div class="overflow-hidden rounded-xl border">
		<Table.Root>
			<Table.Header>
				<Table.Row class="bg-muted/40">
					<Table.Head class="h-9">Class</Table.Head>
					<Table.Head class="h-9">Course</Table.Head>
					<Table.Head class="h-9 w-48">Through the plan</Table.Head>
					<Table.Head class="h-9">Last taught</Table.Head>
					<Table.Head class="h-9">Next up</Table.Head>
					<Table.Head class="h-9 text-right">Runway</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each LANES as lane (lane.classId)}
					<Table.Row class="group">
						<Table.Cell class="py-2 font-medium">
							<a href="##" class="hover:underline">{lane.classLabel}</a>
						</Table.Cell>
						<Table.Cell class="py-2 text-muted-foreground">
							<Badge variant="ghost" class="px-0">{lane.courseName}</Badge>
						</Table.Cell>
						<Table.Cell class="py-2">
							<div class="flex items-center gap-2">
								<div class="h-1 w-24 overflow-hidden rounded-full bg-muted">
									<div class="h-full bg-primary" style:width="{pct(lane)}%"></div>
								</div>
								<span class="text-xs text-muted-foreground tabular-nums">
									{lane.taught}/{lane.total}
								</span>
							</div>
						</Table.Cell>
						<Table.Cell class="py-2">
							<!-- max-width has to sit on a block inside the cell; table-layout:auto ignores it on the cell. -->
							<div class="max-w-56 truncate">
								{#if lane.lastTaught}
									<button type="button" class="max-w-full truncate hover:underline">
										{lane.lastTaught.title}
									</button>
								{:else}
									<span class="text-muted-foreground">Not taught yet</span>
								{/if}
							</div>
						</Table.Cell>
						<Table.Cell class="py-2 text-muted-foreground">
							<div class="max-w-56 truncate">{lane.nextUp?.title ?? '—'}</div>
						</Table.Cell>
						<Table.Cell class="py-2 text-right tabular-nums">
							{lane.runway.date ? fmtShort(lane.runway.date) : 'open-ended'}
							{#if lane.runway.lessonsRemaining}
								<div class="text-xs text-muted-foreground">
									{lane.runway.lessonsRemaining} Lessons unslotted
								</div>
							{/if}
						</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
	</div>

	<p class="mt-3 text-xs text-muted-foreground">
		Assigning the next Topic is not on this screen — it belongs to one Class, so it lives on the
		Class page.
	</p>
</div>

<NewClassDialog bind:open />
