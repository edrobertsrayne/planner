<script lang="ts">
	import { cn } from '$lib/utils';
	import type { HTMLAttributes } from 'svelte/elements';

	import { getDialogContext } from './context';

	let { class: className, children, ...rest }: HTMLAttributes<HTMLParagraphElement> = $props();

	const ctx = getDialogContext();
</script>

<p id={ctx.descriptionId} class={cn('ui-dialog-description', className)} {...rest}>
	{@render children?.()}
</p>
