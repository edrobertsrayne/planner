<!-- PROTOTYPE ONLY (issue #314). The API key row, read from the real load; Regenerate is a stub. -->
<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import CheckIcon from '@lucide/svelte/icons/check';
	import RefreshIcon from '@lucide/svelte/icons/refresh-cw';
	import { stub } from './parts';

	let {
		token,
		createdAt,
		lastUsedAt
	}: { token: string; createdAt: number; lastUsedAt: number | null } = $props();

	let confirmOpen = $state(false);
	let copied = $state(false);

	async function copyKey() {
		await navigator.clipboard.writeText(token);
		copied = true;
		setTimeout(() => (copied = false), 1800);
		toast.success('API key copied.');
	}
</script>

<div class="flex items-center gap-2">
	<Input
		readonly
		value={token}
		aria-label="API key"
		class="h-8 min-w-0 flex-1 font-mono text-xs max-md:h-11"
		onfocus={(e) => e.currentTarget.select()}
	/>
	<Button
		type="button"
		variant="outline"
		size="icon"
		class="size-8 shrink-0 max-md:size-11"
		title="Copy key"
		aria-label="Copy key"
		onclick={copyKey}
	>
		{#if copied}<CheckIcon />{:else}<CopyIcon />{/if}
	</Button>
	<Button
		type="button"
		variant="outline"
		size="icon"
		class="size-8 shrink-0 max-md:size-11"
		title="Regenerate key"
		aria-label="Regenerate key"
		onclick={() => (confirmOpen = true)}
	>
		<RefreshIcon />
	</Button>
</div>
<p class="mt-2 text-xs text-muted-foreground">
	Created {new Date(createdAt).toLocaleDateString()}
	&middot; {lastUsedAt ? `Last used ${new Date(lastUsedAt).toLocaleDateString()}` : 'Never used'}
</p>

<Dialog.Root bind:open={confirmOpen}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Regenerate the API key?</Dialog.Title>
			<Dialog.Description>
				The key you have now stops working at once. Every agent holding it must be given the new
				one. This cannot be undone.
			</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer>
			<Button variant="outline" size="sm" class="h-8" onclick={() => (confirmOpen = false)}>
				Cancel
			</Button>
			<Button
				variant="destructive"
				size="sm"
				class="h-8"
				onclick={() => {
					confirmOpen = false;
					stub();
				}}>Regenerate</Button
			>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
