<script lang="ts">
	import { cn } from '$lib/utils';
	import type { HTMLAttributes } from 'svelte/elements';

	let {
		class: className,
		orientation = 'vertical',
		children,
		...rest
	}: HTMLAttributes<HTMLDivElement> & { orientation?: 'vertical' | 'horizontal' } = $props();
</script>

<div role="group" class={cn('ui-field', `ui-field-${orientation}`, className)} {...rest}>
	{@render children?.()}
</div>
