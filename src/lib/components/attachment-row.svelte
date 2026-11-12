<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import PaperclipIcon from '@lucide/svelte/icons/paperclip';
	import XIcon from '@lucide/svelte/icons/x';
	import { Button } from '$lib/ui';
	import { formatSize } from '$lib/format-size';

	let { attachment }: { attachment: { id: string; filename: string; size: number } } = $props();
</script>

<!-- As tall as the controls, so showing them on hover moves nothing. -->
<div class="group flex min-h-8 items-center gap-2">
	<PaperclipIcon class="size-3.5 shrink-0 text-muted-foreground" />
	<!-- The size sits on the name's baseline. -->
	<span class="flex min-w-0 flex-1 items-baseline gap-2">
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
	</span>
	<form
		method="POST"
		action="?/deleteAttachment"
		class="row-control-collapsed shrink-0 items-center"
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
