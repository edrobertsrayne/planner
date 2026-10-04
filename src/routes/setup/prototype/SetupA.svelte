<!--
	PROTOTYPE ONLY (issue #314). Variant A: today's two cards, centred on the muted backdrop at
	every size. The Restore instructions stay in the second card's description.
-->
<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import CreateForm from './CreateForm.svelte';
	import Frame from './Frame.svelte';
	import RestoreForm from './RestoreForm.svelte';
</script>

<Frame>
	<Card.Root>
		<Card.Header class="text-center">
			<Card.Title class="text-xl">Set up Planner</Card.Title>
		</Card.Header>
		<Card.Content><CreateForm /></Card.Content>
	</Card.Root>
	<Card.Root>
		<Card.Header class="text-center">
			<Card.Title class="text-xl">Restore from a Backup</Card.Title>
			<Card.Description>
				Moving from another planner? Choose the file that Back up saved there. You sign in with the
				password from that planner.
			</Card.Description>
		</Card.Header>
		<Card.Content><RestoreForm /></Card.Content>
	</Card.Root>
</Frame>
