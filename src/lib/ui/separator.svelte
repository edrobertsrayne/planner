<script lang="ts">
	import { cn } from '$lib/utils';

	let {
		class: className,
		orientation = 'horizontal'
	}: { class?: string; orientation?: 'horizontal' | 'vertical' } = $props();
</script>

<div
	role="separator"
	aria-orientation={orientation}
	class={cn('ui-separator', `ui-separator-${orientation}`, className)}
></div>
