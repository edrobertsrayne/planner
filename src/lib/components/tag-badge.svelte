<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import { tagColor } from '$lib/tag-color';
	import type { Snippet } from 'svelte';

	// One Tag's coloured chip, everywhere a Tag renders (issue #244) — the one place the
	// name-to-colour styling is written, so a later tweak to sizing or contrast touches this file
	// alone. `children` carries the Lesson editor's remove button; every other caller renders the
	// name only.
	let {
		name,
		class: className,
		children
	}: { name: string; class?: string; children?: Snippet } = $props();

	const color = $derived(tagColor(name));
</script>

<Badge
	variant="outline"
	class={className}
	style="background-color: {color.bg}; color: {color.fg}; border-color: transparent;"
>
	{name}
	{@render children?.()}
</Badge>
