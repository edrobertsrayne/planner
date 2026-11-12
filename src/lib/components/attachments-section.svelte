<script lang="ts">
	import { onFail } from '$lib/client/enhance';
	import { enhance } from '$app/forms';
	import { toast } from '$lib/ui/toast';
	import { Button } from '$lib/ui';
	import AttachmentRow from './attachment-row.svelte';
	import OwnerFields from './owner-fields.svelte';

	// A Lesson's or a Class's Attachments as written from a tablet up: the rows, each removable,
	// and the upload. The page holds the `?/createAttachment` and `?/deleteAttachment` actions.
	let {
		attachments,
		owner
	}: {
		attachments: { id: string; filename: string; size: number }[];
		owner: { lessonId: string } | { classId: string };
	} = $props();

	let fileInput: HTMLInputElement | null = $state(null);

	// Mirrors attachments.ts's MAX_BYTES (spec #219): a file over this never reaches the form
	// action, since a body over the server's own request-size cap (src/lib/server/body-limit.ts)
	// fails before the action runs, turning what should be this same readable refusal into a
	// SvelteKit error page instead.
	const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
</script>

<section class="rounded-2xl border bg-surface p-4">
	<h2 class="mb-1.5 text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
		Attachments
	</h2>
	<ul class="mt-1 space-y-1">
		{#each attachments as attachment (attachment.id)}
			<li class="rounded-md bg-muted px-2 py-1.5 text-sm">
				<AttachmentRow {attachment} />
			</li>
		{/each}
		{#if !attachments.length}
			<li class="px-1 py-1 text-xs text-muted-foreground">No Attachments yet.</li>
		{/if}
	</ul>

	<form
		method="POST"
		action="?/createAttachment"
		enctype="multipart/form-data"
		class="mt-2"
		use:enhance={onFail('Could not attach the file.')}
	>
		<OwnerFields {owner} />
		<input
			bind:this={fileInput}
			type="file"
			name="file"
			class="hidden"
			aria-label="Choose a file to attach"
			onchange={(e) => {
				const input = e.currentTarget;
				// Refused here, before the request ever starts: a file over the server's own
				// body-size cap would otherwise fail the request itself, and use:enhance turns
				// that into a full error page rather than this same readable toast.
				if ((input.files?.[0]?.size ?? 0) > MAX_ATTACHMENT_BYTES) {
					toast.error('Attachments are limited to 10 MB.');
					input.value = '';
					return;
				}
				// The submit snapshots the form data synchronously, so clearing here keeps the
				// upload in flight while letting a re-pick of the same file fire change again.
				input.form?.requestSubmit();
				input.value = '';
			}}
		/>
		<Button
			type="button"
			variant="ghost"
			size="sm"
			class="text-xs text-muted-foreground"
			onclick={() => fileInput?.click()}
		>
			+ Add Attachment
		</Button>
	</form>
</section>
