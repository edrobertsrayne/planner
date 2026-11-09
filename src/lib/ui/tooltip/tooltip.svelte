<!-- A tooltip that is only CSS: the content shows while the wrapper is hovered or holds focus. -->
<script lang="ts">
	import type { Snippet } from 'svelte';

	let { children }: { children?: Snippet } = $props();
</script>

<span class="ui-tip">{@render children?.()}</span>
