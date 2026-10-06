<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import { useBack } from '$lib/client/back';
	import SessionBody from '$lib/components/session-body.svelte';
	import { Button } from '$lib/components/ui/button';

	// The Session is addressed by its occasion (ADR-0002), so the URL is the whole state: a reload
	// or a pasted link lands on the same Session. A period that is not a whole number is a
	// missing Session, which the body shows.
	const occasion = $derived({
		classId: page.params.class ?? '',
		date: page.params.date ?? '',
		period: Number(page.params.period)
	});

	// With no in-app previous page, Back goes to the Agenda.
	const back = useBack(() => resolve('/'));
</script>

<svelte:head><title>Session</title></svelte:head>

<div class="mx-auto max-w-6xl px-6 pt-4 pb-24">
	<Button variant="ghost" size="sm" class="mb-3 -ml-3" onclick={back}>
		<ArrowLeftIcon data-icon="inline-start" />
		Back
	</Button>
	{#key `${occasion.classId}~${occasion.date}~${occasion.period}`}
		<SessionBody {occasion} />
	{/key}
</div>
