<script lang="ts">
	import UserXIcon from '@lucide/svelte/icons/user-x';

	// The plain cue that a block is the teacher's own Absence (ADR-0030). A neutral outline, never a
	// hue: it says where cover can be set, and nags about nothing.
</script>

<span
	class="inline-flex h-6 shrink-0 items-center gap-1 rounded-md border border-outline px-2 text-xs font-semibold text-foreground max-md:h-5 max-md:px-1.5 max-md:text-[10px]"
>
	<UserXIcon class="size-3 max-md:hidden" aria-hidden="true" />Absent
</span>
