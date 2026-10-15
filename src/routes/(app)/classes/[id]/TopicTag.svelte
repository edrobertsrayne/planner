<script lang="ts">
	import { topicColour } from '$lib/topic-colour';

	// A Topic's colour dot and its name.
	let {
		topicId,
		name,
		class: gap = 'gap-1.5'
	}: { topicId: string | null; name: string; class?: string } = $props();
</script>

<span class="flex items-center {gap}">
	<span
		class="size-2 rounded-full"
		style:background-color={topicColour(topicId, 0.8)}
		aria-hidden="true"
	></span>
	{name}
</span>
