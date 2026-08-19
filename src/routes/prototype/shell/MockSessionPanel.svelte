<!-- PROTOTYPE — throwaway. Stands in for SessionPanel.svelte so each shell can be
     judged with the second column both present and absent. -->
<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import XIcon from '@lucide/svelte/icons/x';

	let { onclose }: { onclose: () => void } = $props();
</script>

<aside class="flex w-90 shrink-0 flex-col border-l bg-card">
	<div class="flex items-center justify-between border-b px-4 py-3">
		<h3 class="text-sm font-semibold">9C/Ma — Period 3</h3>
		<Button variant="ghost" size="icon" class="size-7" onclick={onclose}>
			<XIcon />
		</Button>
	</div>
	<div class="flex-1 space-y-3 overflow-y-auto p-4 text-sm text-muted-foreground">
		<p>Placeholder Session detail — stands in for the real SessionPanel content.</p>
		<p>Whether this stays a permanent column or becomes an overlay is not decided here.</p>
	</div>
</aside>
