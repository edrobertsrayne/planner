<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import PaperclipIcon from '@lucide/svelte/icons/paperclip';
	import XIcon from '@lucide/svelte/icons/x';
	import { Button } from '$lib/components/ui/button/index.js';
	import { formatSize } from '$lib/format-size';

	let { attachment }: { attachment: { id: string; filename: string; size: number } } = $props();
</script>

<div class="group flex items-baseline gap-2">
	<PaperclipIcon class="size-3.5 shrink-0 translate-y-0.5 text-muted-foreground" />
	<a
		href={resolve('/attachments/[id]', { id: attachment.id })}
		class="min-w-0 flex-1 truncate hover:underline"
		title={attachment.filename}
	>
		{attachment.filename}
	</a>
	<span class="shrink-0 font-mono text-[10px] text-muted-foreground">
		{formatSize(attachment.size)}
	</span>
	<form
		method="POST"
		action="?/deleteAttachment"
		class="flex shrink-0 items-center opacity-0 group-hover:opacity-100"
		use:enhance
	>
		<input type="hidden" name="id" value={attachment.id} />
		<Button
			type="submit"
			variant="ghost"
			size="icon-sm"
			class="hover:text-destructive"
			aria-label="Remove {attachment.filename}"
		>
			<XIcon class="size-3.5" />
		</Button>
	</form>
</div>
