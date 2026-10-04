<!--
	PROTOTYPE ONLY (issue #312). The day menu, as on the real Calendar: Block or Unblock the day,
	Block one Slot (asks for a note), Place a Lesson (opens the Session page), and Unblock each
	Blocked Slot. Acts on local state. The note is asked for in a dialog here, not a popover over
	the tile, so it works the same in every variant.
-->
<script lang="ts">
	import EllipsisIcon from '@lucide/svelte/icons/ellipsis';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { formatDayMonth } from '$lib/date';
	import type { Row } from '../../prototype-agenda/store.svelte';
	import {
		TODAY,
		blockDay,
		blockSlot,
		openSession,
		unblockDay,
		unblockSlot,
		type Day
	} from './store.svelte';

	let {
		day,
		label = false,
		class: klass = ''
	}: { day: Day; label?: boolean; class?: string } = $props();

	const available = $derived(day.cells.filter((c) => c.kind !== 'blocked'));
	const blocked = $derived(day.cells.filter((c) => c.kind === 'blocked'));
	let pick = $state<Row | null>(null);
	let note = $state('');
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger
		class="inline-flex items-center gap-1 rounded px-1 text-muted-foreground/60 hover:bg-muted hover:text-foreground [&_svg]:size-4 {klass}"
		aria-label={`${day.name} ${formatDayMonth(day.date)} actions`}
	>
		<EllipsisIcon />{#if label}<span class="text-xs font-medium">Day</span>{/if}
	</DropdownMenu.Trigger>
	<DropdownMenu.Content class="w-60" align="end">
		<DropdownMenu.Group>
			{#if day.kind === 'blocked'}
				<DropdownMenu.Item onSelect={() => unblockDay(day.date)}>Unblock day</DropdownMenu.Item>
			{:else if day.kind === 'teaching'}
				<DropdownMenu.Item onSelect={() => blockDay(day.date)}>Block day</DropdownMenu.Item>
			{:else}
				<DropdownMenu.Item disabled>School holiday</DropdownMenu.Item>
			{/if}
		</DropdownMenu.Group>
		{#if available.length > 0}
			<DropdownMenu.Separator />
			<DropdownMenu.Group>
				<DropdownMenu.GroupHeading class="text-muted-foreground"
					>Block one Slot</DropdownMenu.GroupHeading
				>
				{#each available as c (c.row.key)}
					<DropdownMenu.Item
						onSelect={() => {
							note = '';
							pick = c.row;
						}}>{c.row.classLabel}, P{c.row.periodFrom}…</DropdownMenu.Item
					>
				{/each}
			</DropdownMenu.Group>
			{#if day.date >= TODAY}
				<DropdownMenu.Separator />
				<DropdownMenu.Group>
					<DropdownMenu.GroupHeading class="text-muted-foreground"
						>Place a Lesson</DropdownMenu.GroupHeading
					>
					{#each available as c (c.row.key)}
						<DropdownMenu.Item onSelect={() => openSession(c.row)}
							>Open {c.row.classLabel}, P{c.row.periodFrom} to place…</DropdownMenu.Item
						>
					{/each}
				</DropdownMenu.Group>
			{/if}
		{/if}
		{#if blocked.length > 0}
			<DropdownMenu.Separator />
			<DropdownMenu.Group>
				<DropdownMenu.GroupHeading class="text-muted-foreground"
					>Blocked Slots</DropdownMenu.GroupHeading
				>
				{#each blocked as c (c.row.key)}
					<DropdownMenu.Item onSelect={() => unblockSlot(c.row)}
						>Unblock {c.row.classLabel}, P{c.row.periodFrom}</DropdownMenu.Item
					>
				{/each}
			</DropdownMenu.Group>
		{/if}
	</DropdownMenu.Content>
</DropdownMenu.Root>

<Dialog.Root open={!!pick} onOpenChange={(o) => !o && (pick = null)}>
	<Dialog.Content class="sm:max-w-sm">
		<Dialog.Header>
			<Dialog.Title>Block {pick?.classLabel}, P{pick?.periodFrom}</Dialog.Title>
			<Dialog.Description
				>The Class is not taught this Period; the school is open.</Dialog.Description
			>
		</Dialog.Header>
		<form
			onsubmit={(e) => {
				e.preventDefault();
				if (pick && note.trim()) blockSlot(pick, note.trim());
				pick = null;
			}}
		>
			<Input bind:value={note} required placeholder="Why (required)" />
			<Button type="submit" class="mt-3 w-full">Block</Button>
		</form>
	</Dialog.Content>
</Dialog.Root>
