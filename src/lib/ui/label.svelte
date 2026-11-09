<script lang="ts">
	import { cn } from '$lib/utils';
	import type { HTMLLabelAttributes } from 'svelte/elements';

	let { class: className, children, ...rest }: HTMLLabelAttributes = $props();
</script>

<label class={cn('ui-label', className)} {...rest}>{@render children?.()}</label>
