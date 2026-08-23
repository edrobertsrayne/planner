<!--
	PROTOTYPE — throwaway. Variant B — the section list.

	No card. The page is full-width like every other screen, and the form is a labelled *section*:
	prose in a fixed left column, controls in the right, ruled off by Separators. The shape most
	settings screens converge on (GitHub, Stripe), and the one that costs nothing when a second
	section arrives — the row simply repeats.

	The bet it makes: a card around a form that is the only thing on the page is a box drawn round
	the whole page. The bet against it: with one section, the left column is mostly empty and the
	ruling has nothing to separate.
-->
<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
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

<div class="px-6 py-4">
	<PageHeader title="Settings" description="This planner has one account." />

	<Separator />

	<div class="flex flex-col gap-8 py-8 md:flex-row md:gap-12">
		<div class="w-full shrink-0 md:w-64">
			<h2 class="text-sm font-medium">Change password</h2>
			<p class="mt-1 text-sm text-muted-foreground">
				Logs out every other device. There is no reset by email — if you forget it, run
				<code class="rounded bg-muted px-1 py-0.5 font-mono text-xs">bun run reset:credentials</code
				>
				on the server.
			</p>
		</div>

		<div class="flex max-w-sm min-w-0 flex-1 flex-col gap-6">
			{#if showInline}
				<InlineResult {result} />
			{/if}
			<PasswordFields invalid={showInline && result?.ok === false} />
			<div>
				<Button size="sm" class="h-7" disabled={pending} onclick={onsubmit}>
					{pending ? 'Changing…' : 'Change password'}
				</Button>
			</div>
		</div>
	</div>

	<Separator />
</div>
