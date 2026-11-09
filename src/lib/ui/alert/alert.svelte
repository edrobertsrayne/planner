<script lang="ts">
	import { cn } from '$lib/utils';
	import type { HTMLAttributes } from 'svelte/elements';

	let {
		class: className,
		variant = 'default',
		children,
		...rest
	}: HTMLAttributes<HTMLDivElement> & { variant?: 'default' | 'destructive' } = $props();
</script>

<div role="alert" class={cn('ui-alert', `ui-alert-${variant}`, className)} {...rest}>
	{@render children?.()}
</div>
