<script lang="ts">
	import { formatSize } from '$lib/format-size';

	let { attachment }: { attachment: { filename: string; size: number } } = $props();
</script>

<div class="flex items-baseline gap-2">
	<span class="min-w-0 flex-1 truncate" title={attachment.filename}>{attachment.filename}</span>
	<span class="shrink-0 font-mono text-[10px] text-muted-foreground">
		{formatSize(attachment.size)}
	</span>
</div>
