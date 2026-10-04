<!-- PROTOTYPE ONLY (issue #314). The Back up note and button; the download is a stub. -->
<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { formatSize } from '$lib/format-size';
	import { stub } from './parts';

	let { size }: { size: number } = $props();
</script>

<div class="flex flex-wrap items-center justify-between gap-3">
	<p class="text-xs text-muted-foreground">
		Expected size: up to {formatSize(size)}. The file holds your login and API key. Keep it secret.
	</p>
	<Button size="sm" class="h-8 max-md:h-11" onclick={stub}>Back up</Button>
</div>
