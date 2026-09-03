<script lang="ts">
	import * as Popover from '$lib/components/ui/popover';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { placeFake } from '$lib/client/prototype-228-placement.svelte';

	// PROTOTYPE for issue #228, variant A only — mirrors BlockPopover.svelte's shape (a note
	// form anchored over the tile the day menu picked) but asks for a title, and writes to the
	// in-memory fake store rather than the server. Delete with the rest of the prototype.
	let {
		pick,
		onOpenChange
	}: {
		pick: { classId: string; classLabel: string; date: string; period: number };
		onOpenChange: (open: boolean) => void;
	} = $props();

	const id = $props.id();
	const label = $derived(`Place on ${pick.classLabel}, P${pick.period}`);
	let title = $state('');
</script>

<Popover.Root open {onOpenChange}>
	<Popover.Trigger class="absolute top-1 right-1 size-0" aria-label={label} />
	<Popover.Content class="w-64 p-3" align="end">
		<form
			onsubmit={(e) => {
				e.preventDefault();
				if (!title.trim()) return;
				placeFake(pick.classId, pick.date, pick.period, title.trim());
				onOpenChange(false);
			}}
		>
			<Label for={id}>{label}</Label>
			<Input
				{id}
				bind:value={title}
				class="mt-2 h-7 text-xs"
				required
				placeholder="New Lesson title — press Enter"
			/>
			<p class="mt-1.5 text-xs text-muted-foreground">
				A Lesson with no Topic, scheduled directly on this occasion.
			</p>
			<Button type="submit" size="sm" class="mt-3 w-full">Place</Button>
		</form>
	</Popover.Content>
</Popover.Root>
