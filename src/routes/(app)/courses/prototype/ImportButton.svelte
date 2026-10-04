<!--
	PROTOTYPE ONLY (issue #306): where an Import control would sit. Today Import exists only
	through the API; this dialog is a placeholder and imports nothing.
-->
<script lang="ts">
	import UploadIcon from '@lucide/svelte/icons/upload';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Textarea } from '$lib/components/ui/textarea';

	let { courseName, variant = 'outline' }: { courseName?: string; variant?: 'outline' | 'ghost' } =
		$props();
	let open = $state(false);
</script>

<Dialog.Root bind:open>
	<Dialog.Trigger>
		{#snippet child({ props })}
			<Button {...props} {variant} size="sm" class="max-md:hidden">
				<UploadIcon />Import Topic
			</Button>
		{/snippet}
	</Dialog.Trigger>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Import a Topic{courseName ? ` into ${courseName}` : ''}</Dialog.Title>
			<Dialog.Description>
				Placeholder. Today Import is possible only through the API. One Topic, its Lessons and their
				Links, all or nothing.
			</Dialog.Description>
		</Dialog.Header>
		<Textarea rows={8} placeholder="Paste the Topic file here" />
		<Dialog.Footer>
			<Button variant="ghost" onclick={() => (open = false)}>Cancel</Button>
			<Button disabled>Import</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
