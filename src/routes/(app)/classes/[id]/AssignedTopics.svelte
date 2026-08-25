<script lang="ts">
	import { enhance } from '$app/forms';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import ChevronUpIcon from '@lucide/svelte/icons/chevron-up';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import XIcon from '@lucide/svelte/icons/x';
	import { onFail, submitWithValue } from '$lib/client/enhance';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Select from '$lib/components/ui/select/index.js';

	// What this Class teaches, in the order it teaches it — its own order, never the Course's
	// (ADR-0010). Assigning is a Select that submits on the pick, so the row stays a plain
	// "Assign next Topic" affordance rather than growing a button beside it.
	let {
		classId,
		classLabel,
		assigned,
		courseTopics
	}: {
		classId: string;
		classLabel: string;
		assigned: { id: string; topicName: string }[];
		courseTopics: { id: string; name: string }[];
	} = $props();

	let assignForm = $state<HTMLFormElement | undefined>();

	const assign = (topicId: string | undefined) => submitWithValue(assignForm, 'topicId', topicId);

	const MOVES = [
		{ direction: 'up', described: 'earlier', rounding: 'rounded-t-sm' },
		{ direction: 'down', described: 'later', rounding: 'rounded-b-sm' }
	] as const;
</script>

<div>
	<h2 class="mb-2 text-sm font-semibold">Assigned Topics</h2>
	<p class="mb-2 text-xs text-muted-foreground">
		{classLabel} teaches these, in this order — decide the next one as you reach it.
	</p>

	<ul class="divide-y rounded-lg border">
		{#each assigned as a, i (a.id)}
			<li class="group flex items-stretch gap-2 py-1 pr-1 pl-3">
				<span class="self-center text-xs text-muted-foreground tabular-nums">{i + 1}</span>
				<span class="min-w-0 flex-1 self-center truncate text-sm">{a.topicName}</span>

				<div class="flex flex-col justify-center opacity-0 group-hover:opacity-100">
					{#each MOVES as move (move.direction)}
						<form
							method="POST"
							action="?/moveAssignedTopic"
							use:enhance={onFail('Could not move the Topic.')}
						>
							<input type="hidden" name="classId" value={classId} />
							<input type="hidden" name="id" value={a.id} />
							<input type="hidden" name="direction" value={move.direction} />
							<button
								type="submit"
								disabled={move.direction === 'up' ? i === 0 : i === assigned.length - 1}
								aria-label="Move {a.topicName} {move.described}"
								class="{move.rounding} px-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-20"
							>
								{#if move.direction === 'up'}
									<ChevronUpIcon class="size-3" />
								{:else}
									<ChevronDownIcon class="size-3" />
								{/if}
							</button>
						</form>
					{/each}
				</div>

				<form
					method="POST"
					action="?/unassignTopic"
					use:enhance={onFail('Could not unassign the Topic.')}
				>
					<input type="hidden" name="classId" value={classId} />
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
		{:else}
			<li class="px-2 py-1.5 text-xs text-muted-foreground">No Topics assigned yet.</li>
		{/each}

		{#if courseTopics.length}
			<li class="p-1">
				<form
					method="POST"
					action="?/assignTopic"
					bind:this={assignForm}
					use:enhance={onFail('Could not assign the Topic.')}
				>
					<input type="hidden" name="classId" value={classId} />
					<input type="hidden" name="topicId" />
					<Select.Root type="single" onValueChange={assign}>
						<Select.Trigger
							size="sm"
							class="w-full justify-start border-0 bg-transparent px-2 text-muted-foreground"
						>
							<PlusIcon class="size-3.5" />
							Assign next Topic
						</Select.Trigger>
						<Select.Content>
							{#each courseTopics as t (t.id)}
								<Select.Item value={t.id} label={t.name} />
							{/each}
						</Select.Content>
					</Select.Root>
				</form>
			</li>
		{:else}
			<li class="px-2 py-1.5 text-[11px] text-muted-foreground">This Course has no Topics yet.</li>
		{/if}
	</ul>
</div>
