<!--
	PROTOTYPE — throwaway. Variant C — not a screen.

	Disagrees with A and B about the premise. Settings holds one form with three fields; a route,
	a PageHeader and a tab-less shell is a lot of screen for that. So the header's Settings control
	opens a Dialog over whatever you were doing, and the Agenda stays behind it — the same argument
	#62 made when it kept the Session beside the schedule rather than giving it a route.

	The real Agenda (from #68) renders underneath, so the dialog is judged over the app rather than
	over a grey rectangle.

	Note the thing this variant forces: the dialog closes on success, so a success message inside it
	has nowhere to live. Switch the bar to `Inline` and watch it disappear.
-->
<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import PasswordFields from './PasswordFields.svelte';
	import InlineResult from './InlineResult.svelte';
	import AgendaVariantA from '../agenda/VariantA.svelte';
	import { agendaFixture, mondayOf } from '../agenda/fixtures.js';
	import type { Result } from './stub.js';

	let {
		open = $bindable(false),
		result,
		pending,
		onsubmit,
		showInline
	}: {
		open: boolean;
		result: Result | null;
		pending: boolean;
		onsubmit: () => void;
		showInline: boolean;
	} = $props();

	// The agenda fixtures are school days, so a weekend rolls forward rather than rendering empty.
	const today = mondayOf(new Date().toISOString().slice(0, 10));
	const rows = agendaFixture(today, 'full');
	let horizon = $state(7);
</script>

<div class="px-6 py-4">
	<AgendaVariantA {rows} {today} bind:horizon />
</div>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Change password</Dialog.Title>
			<Dialog.Description>
				Logs out every other device. There is no reset by email — if you forget it, run
				<code class="rounded bg-muted px-1 py-0.5 font-mono text-xs">bun run reset:credentials</code
				>
				on the server.
			</Dialog.Description>
		</Dialog.Header>

		<div class="flex flex-col gap-6">
			{#if showInline}
				<InlineResult {result} />
			{/if}
			<PasswordFields invalid={showInline && result?.ok === false} />
		</div>

		<Dialog.Footer>
			<Button variant="ghost" size="sm" class="h-7" onclick={() => (open = false)}>Cancel</Button>
			<Button size="sm" class="h-7" disabled={pending} onclick={onsubmit}>
				{pending ? 'Changing…' : 'Change password'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
