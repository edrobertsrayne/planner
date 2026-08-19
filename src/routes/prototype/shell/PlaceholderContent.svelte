<!--
	PROTOTYPE — throwaway. Stands in for a real screen's content so the shell
	is judged on its own frame, not through one screen's furniture.
-->
<script lang="ts">
	import * as Card from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';

	let { title = 'Placeholder screen', showActions = true } = $props();
</script>

{#if showActions}
	<div class="mb-6 flex items-center justify-between">
		<div>
			<h2 class="text-xl font-semibold tracking-tight">{title}</h2>
			<p class="text-sm text-muted-foreground">A stand-in title and description row.</p>
		</div>
		<div class="flex gap-2">
			<Button variant="outline" size="sm">Secondary action</Button>
			<Button size="sm">Primary action</Button>
		</div>
	</div>
{/if}

<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
	{#each Array.from({ length: 6 }, (_, i) => i) as i (i)}
		<Card.Root>
			<Card.Header>
				<Card.Title>Item {i + 1}</Card.Title>
				<Card.Description>Placeholder card content.</Card.Description>
			</Card.Header>
			<Card.Content class="text-sm text-muted-foreground">
				Lorem ipsum dolor sit amet, consectetur adipiscing elit.
			</Card.Content>
		</Card.Root>
	{/each}
</div>
