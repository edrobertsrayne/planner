<script lang="ts">
	import { setContext, type Snippet } from 'svelte';
	import { MENU_GROUP_HEADING } from './group-heading-id';

	let { children }: { children?: Snippet } = $props();

	// The heading names the group; it reads this id from context and takes it as its own.
	const headingId = $props.id();
	setContext(MENU_GROUP_HEADING, headingId);
</script>

<div role="group" aria-labelledby={headingId}>{@render children?.()}</div>
