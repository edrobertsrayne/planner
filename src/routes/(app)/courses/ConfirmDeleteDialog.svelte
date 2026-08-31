<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';

	// A Course or a Topic that still holds children — the confirm step deleteLesson never needed,
	// because a Lesson never holds anything of its own. `target` is null when no delete is
	// pending; setting it opens the dialog, and confirming or cancelling clears it back to null.
	let {
		target = $bindable(null),
		action,
		description
	}: {
		target: { id: string; name: string } | null;
		action: string;
		description: string;
	} = $props();
</script>

<Dialog.Root
	open={target !== null}
	onOpenChange={(open) => {
		if (!open) target = null;
	}}
>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Delete "{target?.name}"?</Dialog.Title>
			<Dialog.Description>{description}</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer>
			<Button variant="outline" size="sm" class="h-7" onclick={() => (target = null)}>
				Cancel
			</Button>
			<form
				method="POST"
				{action}
				use:enhance={() => {
					return async ({ update }) => {
						target = null;
						await update();
					};
				}}
			>
				<input type="hidden" name="id" value={target?.id} />
				<input type="hidden" name="confirmed" value="true" />
				<Button type="submit" variant="destructive" size="sm" class="h-7">Delete</Button>
			</form>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
