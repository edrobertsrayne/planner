<!--
	PROTOTYPE ONLY (issue #314). Variant B: one card with two tabs, New planner and Restore from a
	Backup. The Restore instructions move under the file field. Flush on a phone: no backdrop, no
	card frame, the form starts at the top.
-->
<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import CreateForm from './CreateForm.svelte';
	import Frame from './Frame.svelte';
	import RestoreForm from './RestoreForm.svelte';
	import { card, cardPad } from './parts';

	let tab = $state<'new' | 'restore'>('new');
	const TABS = [
		{ key: 'new', label: 'New planner' },
		{ key: 'restore', label: 'Restore from a Backup' }
	] as const;
</script>

<Frame flush>
	<Card.Root class={card(true)}>
		<Card.Header class="text-center {cardPad(true)}">
			<Card.Title class="text-xl">Set up Planner</Card.Title>
		</Card.Header>
		<Card.Content class="flex flex-col gap-6 {cardPad(true)}">
			<div class="grid grid-cols-2 rounded-lg bg-muted p-1 text-sm" role="tablist">
				{#each TABS as t (t.key)}
					<button
						type="button"
						role="tab"
						aria-selected={tab === t.key}
						class="rounded-md px-2 py-1.5 font-medium max-sm:min-h-10 {tab === t.key
							? 'bg-background text-foreground shadow-sm'
							: 'text-muted-foreground hover:text-foreground'}"
						onclick={() => (tab = t.key)}
					>
						{t.label}
					</button>
				{/each}
			</div>
			{#if tab === 'new'}
				<CreateForm />
			{:else}
				<RestoreForm help />
			{/if}
		</Card.Content>
	</Card.Root>
</Frame>
