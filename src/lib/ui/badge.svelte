<script lang="ts">
	import { cn } from '$lib/utils';
	import type { HTMLAnchorAttributes } from 'svelte/elements';

	type Variant = 'default' | 'secondary' | 'destructive' | 'outline';

	let {
		href,
		class: className,
		variant = 'default',
		children,
		...rest
	}: HTMLAnchorAttributes & { variant?: Variant } = $props();
</script>

<svelte:element
	this={href ? 'a' : 'span'}
	{href}
	class={cn('ui-badge', `ui-badge-${variant}`, className)}
	{...rest}
>
	{@render children?.()}
</svelte:element>
