<script lang="ts">
	// The "I'm absent" choice on both block dialogs (ADR-0030). Off unless the teacher ticks it, so
	// a closure, a trip or a fire drill blocks exactly as it did.
	let { hint }: { hint: string } = $props();
</script>

<div class="mt-3 flex items-start gap-2.5 rounded-lg border bg-muted/50 p-3">
	<input
		id="absent"
		type="checkbox"
		name="absent"
		class="mt-0.5 size-4 accent-primary pointer-coarse:size-5"
	/>
	<label for="absent" class="text-sm font-medium">
		I'm absent
		<span class="mt-0.5 block text-xs font-normal text-muted-foreground">{hint}</span>
	</label>
</div>
