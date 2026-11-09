<script lang="ts">
	import { getContext } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils';
	import { MENU_GROUP_HEADING } from './group-heading-id';

	let { class: className, children, ...rest }: HTMLAttributes<HTMLDivElement> = $props();

	const id = getContext<string | undefined>(MENU_GROUP_HEADING);
</script>

<div {id} class={cn('ui-menu-heading', className)} {...rest}>{@render children?.()}</div>
