<!--
	Back from a page that other screens open. It names where it lands ("Back to Agenda"): the page
	that opened this one, or `fallback` when there is none (see `useBack`).
-->
<script lang="ts">
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import type { useBack } from '$lib/client/back.svelte';
	import { Button } from '$lib/ui';
	import { cn } from '$lib/utils';

	let {
		back,
		onclick = back.go,
		class: className
	}: { back: ReturnType<typeof useBack>; onclick?: () => unknown; class?: string } = $props();
</script>

<Button variant="ghost" size="sm" class={cn('-ml-3', className)} {onclick}>
	<ArrowLeftIcon data-icon="inline-start" />
	{back.label}
</Button>
