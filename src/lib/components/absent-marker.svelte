<script lang="ts">
	import UserXIcon from '@lucide/svelte/icons/user-x';

	// The plain cue that a block is the teacher's own Absence (ADR-0030). A neutral outline, never a
	// hue: it says where cover can be set, and nags about nothing.
</script>

<span
	class="inline-flex shrink-0 items-center gap-1 rounded-full border border-muted-foreground/50 bg-background px-2 py-0.5 text-[11px] font-semibold text-foreground"
>
	<UserXIcon class="size-3" aria-hidden="true" />Absent
</span>
