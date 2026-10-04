<!--
	PROTOTYPE ONLY (issue #313). The Class's Assigned Topics in order, with reorder, Unassign and
	Assign next Topic, all local. `controls` tries the touch question:
	- `hover`  — today: the arrows and Unassign show on hover, and always on a touch screen.
	- `always` — the arrows and Unassign always show.
	- `edit`   — a plain list with an Edit button; the controls show only while editing.
	- `none`   — read only (the phone).
-->
<script lang="ts">
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import ChevronUpIcon from '@lucide/svelte/icons/chevron-up';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import XIcon from '@lucide/svelte/icons/x';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import {
		assignTopic,
		assigned,
		courseTopics,
		moveTopic,
		unassignTopic,
		type Klass
	} from './store.svelte';

	let {
		klass,
		controls = 'hover',
		heading = true
	}: {
		klass: Klass;
		controls?: 'hover' | 'always' | 'edit' | 'none';
		heading?: boolean;
	} = $props();

	let editing = $state(false);
	const list = $derived(assigned[klass.id]);
	const show = $derived(
		controls === 'always' || (controls === 'edit' && editing) || controls === 'hover'
	);
	const reveal = $derived(
		controls === 'hover' ? 'opacity-0 group-hover:opacity-100 pointer-coarse:opacity-100' : ''
	);
	const writable = $derived(controls !== 'none' && (controls !== 'edit' || editing));
</script>

<div>
	{#if heading}
		<div class="mb-2 flex items-center justify-between gap-2">
			<h2 class="text-sm font-semibold">Assigned Topics</h2>
			{#if controls === 'edit'}
				<Button variant="ghost" size="sm" class="h-7 text-xs" onclick={() => (editing = !editing)}>
					{editing ? 'Done' : 'Edit'}
				</Button>
			{/if}
		</div>
	{/if}

	<ul class="divide-y rounded-lg border">
		{#each list as name, i (name)}
			<li class="group flex items-center gap-2 py-1 pr-1 pl-3">
				<span class="text-xs text-muted-foreground tabular-nums">{i + 1}</span>
				<span class="min-w-0 flex-1 py-1 text-sm">{name}</span>
				{#if show && controls !== 'none'}
					<div class="flex items-center gap-0.5 {reveal}">
						<Button
							variant="ghost"
							size="icon-sm"
							disabled={i === 0}
							aria-label="Move {name} earlier"
							onclick={() => moveTopic(klass.id, i, -1)}><ChevronUpIcon /></Button
						>
						<Button
							variant="ghost"
							size="icon-sm"
							disabled={i === list.length - 1}
							aria-label="Move {name} later"
							onclick={() => moveTopic(klass.id, i, 1)}><ChevronDownIcon /></Button
						>
						<Button
							variant="ghost"
							size="icon-sm"
							aria-label="Unassign {name}"
							onclick={() => unassignTopic(klass.id, i)}><XIcon /></Button
						>
					</div>
				{/if}
			</li>
		{:else}
			<li class="px-3 py-2 text-xs text-muted-foreground">No Topics assigned yet.</li>
		{/each}

		{#if writable}
			{@const left = courseTopics(klass).filter((t) => !list.includes(t))}
			{#if left.length}
				<li class="p-1">
					<Select.Root type="single" onValueChange={(v) => v && assignTopic(klass.id, v)}>
						<Select.Trigger
							size="sm"
							class="w-full justify-start border-0 bg-transparent px-2 text-muted-foreground"
						>
							<PlusIcon class="size-3.5" />Assign next Topic
						</Select.Trigger>
						<Select.Content>
							{#each left as t (t)}
								<Select.Item value={t} label={t} />
							{/each}
						</Select.Content>
					</Select.Root>
				</li>
			{/if}
		{/if}
	</ul>
</div>
