<script lang="ts">
	import { cn } from '$lib/utils';
	import type { HTMLAttributes } from 'svelte/elements';

	import { getDialogContext } from './context';

	let { class: className, children, ...rest }: HTMLAttributes<HTMLHeadingElement> = $props();

	const ctx = getDialogContext();
</script>

<h2 id={ctx.titleId} class={cn('ui-dialog-title', className)} {...rest}>{@render children?.()}</h2>
