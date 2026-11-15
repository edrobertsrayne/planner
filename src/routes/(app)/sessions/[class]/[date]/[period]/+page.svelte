<script lang="ts">
	import { resolve } from '$app/paths';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import { useBack } from '$lib/client/back';
	import SessionBody from '$lib/components/session-body.svelte';
	import { Button } from '$lib/ui';

	// The Session is addressed by its occasion (ADR-0002), so the URL is the whole state: a reload
	// or a pasted link lands on the same Session.
	let { data } = $props();

	// With no in-app previous page, Back goes to the Agenda.
	const back = useBack(() => resolve('/'));
</script>

<svelte:head><title>Session</title></svelte:head>

<div class="mx-auto max-w-6xl px-6 pt-4 pb-24">
	<Button variant="ghost" size="sm" class="mb-3 -ml-3" onclick={back}>
		<ArrowLeftIcon data-icon="inline-start" />
		Back
	</Button>
	{#if data.detail}
		<!-- Remounted for another Session, so no state carries over. -->
		{#key `${data.detail.classId}~${data.detail.date}~${data.detail.period}`}
			<SessionBody detail={data.detail} />
		{/key}
	{:else}
		<p class="mt-4 text-sm text-muted-foreground">No such Session.</p>
	{/if}
</div>
