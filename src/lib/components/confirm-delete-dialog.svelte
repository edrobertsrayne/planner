<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import type { PendingDelete } from '$lib/client/confirm-delete.svelte';
	import { latched } from '$lib/client/latch.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';

	// The delete ask every page that deletes a record with something behind it shares: a Course or a
	// Topic that still holds Lessons, a Class with a timetable and Sessions, a Lesson a Sequence
	// holds. The unconfirmed delete came back with `needsConfirm`, and `description` is the server's
	// reason. Its form posts the same `action` with `confirmed`, so the seam goes ahead at once.
	// `target` is null when no delete is pending; setting it opens the dialog, and confirming or
	// cancelling clears it back to null.
	//
	// `title` lets the Lesson editor say "Delete this Lesson?" without naming the row; `submit`
	// lets a page do something after a confirmed delete instead of the ordinary refresh.
	let {
		target = $bindable(null),
		title = (pending: PendingDelete) => `Delete "${pending.name}"?`,
		submit
	}: {
		target: PendingDelete | null;
		title?: (pending: PendingDelete) => string;
		submit?: SubmitFunction;
	} = $props();

	// The dialog's content outlives `target` while it fades out, so it reads the last pick.
	const shown = latched(() => target);
	const view = $derived(shown());

	// A confirmed post is the page's if it gave one, the ordinary refresh otherwise. Either way the
	// dialog closes first, so a refusal cannot leave it hanging open over the page.
	const confirm: SubmitFunction = async (input) => {
		const handler = submit ? await submit(input) : null;
		return async (options) => {
			target = null;
			if (handler) await handler(options);
			else await options.update();
		};
	};
</script>

<Dialog.Root
	open={target !== null}
	onOpenChange={(open) => {
		if (!open) target = null;
	}}
>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			{#if view}
				<Dialog.Title>{title(view)}</Dialog.Title>
				<Dialog.Description>{view.description}</Dialog.Description>
			{:else}
				<Dialog.Title>Delete?</Dialog.Title>
				<Dialog.Description></Dialog.Description>
			{/if}
		</Dialog.Header>
		<Dialog.Footer>
			<Button variant="outline" size="sm" class="h-7" onclick={() => (target = null)}>
				Cancel
			</Button>
			<form method="POST" action={view?.action} use:enhance={confirm}>
				<input type="hidden" name="id" value={view?.id} />
				<input type="hidden" name="confirmed" value="true" />
				<Button type="submit" variant="destructive" size="sm" class="h-7">Delete</Button>
			</form>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
