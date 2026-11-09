<script lang="ts">
	import { Badge } from '$lib/ui';
	import type { Snippet } from 'svelte';

	// One Tag's chip, everywhere a Tag renders (issue #244) — the one place its styling is written,
	// so a later tweak to sizing or contrast touches this file alone. A Tag is neutral: colour is
	// kept for Classes, Courses and Topics. `children` carries the Lesson editor's remove button; every other caller renders the
	// name only.
	let {
		name,
		class: className,
		children
	}: { name: string; class?: string; children?: Snippet } = $props();
</script>

<Badge variant="secondary" class="bg-muted font-medium text-muted-foreground {className}">
	{name}
	{@render children?.()}
</Badge>
