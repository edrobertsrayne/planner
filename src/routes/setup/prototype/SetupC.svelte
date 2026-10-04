<!--
	PROTOTYPE ONLY (issue #314). Variant C: Create account is the page. A line under the card,
	"Moving from another planner?", swaps the card for the Restore form, with a link back. The
	Restore instructions move under the file field. Flush on a phone, as in B.
-->
<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import CreateForm from './CreateForm.svelte';
	import Frame from './Frame.svelte';
	import RestoreForm from './RestoreForm.svelte';
	import { card, cardPad } from './parts';

	let restoring = $state(false);
	const link =
		'font-medium text-foreground underline underline-offset-4 max-sm:inline-block max-sm:py-2';
</script>

<Frame flush>
	<Card.Root class={card(true)}>
		<Card.Header class="text-center {cardPad(true)}">
			<Card.Title class="text-xl">
				{restoring ? 'Restore from a Backup' : 'Set up Planner'}
			</Card.Title>
		</Card.Header>
		<Card.Content class={cardPad(true)}>
			{#if restoring}
				<RestoreForm help />
			{:else}
				<CreateForm />
			{/if}
		</Card.Content>
	</Card.Root>
	<p class="text-center text-sm text-muted-foreground">
		{#if restoring}
			<button type="button" class={link} onclick={() => (restoring = false)}>
				Set up a new planner instead
			</button>
		{:else}
			Moving from another planner?
			<button type="button" class={link} onclick={() => (restoring = true)}>
				Restore from a Backup
			</button>
		{/if}
	</p>
</Frame>
