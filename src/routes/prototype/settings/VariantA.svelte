<!--
	PROTOTYPE — throwaway. Variant A — the card.

	The registry's account-settings shape: a narrow centred column, a PageHeader, and the form
	inside one Card that names itself ("Change password") and carries its own footer. The page and
	the form are two different objects; the card is the boundary between them.

	Both facts sit inside the card: the no-reset recovery route as the CardDescription, the
	logs-out-other-devices consequence as a muted line beside the button, where it is read just
	before the click that causes it.
-->
<script lang="ts">
	import * as Card from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import PageHeader from './PageHeader.svelte';
	import PasswordFields from './PasswordFields.svelte';
	import InlineResult from './InlineResult.svelte';
	import type { Result } from './stub.js';

	let {
		result,
		pending,
		onsubmit,
		showInline
	}: {
		result: Result | null;
		pending: boolean;
		onsubmit: () => void;
		showInline: boolean;
	} = $props();
</script>

<div class="mx-auto max-w-xl px-6 py-8">
	<PageHeader title="Settings" description="This planner has one account." />

	<Card.Root>
		<Card.Header>
			<Card.Title>Change password</Card.Title>
			<Card.Description>
				There is no reset by email. If you forget it, run <code
					class="rounded bg-muted px-1 py-0.5 font-mono text-xs">bun run reset:credentials</code
				> on the server.
			</Card.Description>
		</Card.Header>

		<Card.Content class="flex flex-col gap-6">
			{#if showInline}
				<InlineResult {result} />
			{/if}
			<PasswordFields invalid={showInline && result?.ok === false} />
		</Card.Content>

		<Card.Footer class="flex-wrap items-center justify-between gap-3">
			<p class="text-xs text-muted-foreground">Logs out every other device.</p>
			<Button size="sm" class="h-7" disabled={pending} onclick={onsubmit}>
				{pending ? 'Changing…' : 'Change password'}
			</Button>
		</Card.Footer>
	</Card.Root>
</div>
