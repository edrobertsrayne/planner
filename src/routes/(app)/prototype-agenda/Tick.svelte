<!-- PROTOTYPE ONLY (issue #310): the Ready tick on fake data. On a phone its target is 44 px. -->
<script lang="ts">
	import CheckIcon from '@lucide/svelte/icons/check';
	import { isReady, setReady, type Row } from './store.svelte';

	let { row, labelled = false }: { row: Row; labelled?: boolean } = $props();
	const on = $derived(isReady(row));
</script>

{#if labelled}
	<button
		type="button"
		aria-pressed={on}
		class="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium md:h-8 md:text-xs {on
			? 'border-primary bg-primary text-primary-foreground'
			: 'text-muted-foreground hover:bg-muted'}"
		onclick={() => setReady(row, !on)}
	>
		<CheckIcon class="size-4" />
		{on ? 'Ready' : 'Not ready'}
	</button>
{:else}
	<label
		class="relative inline-flex size-11 shrink-0 cursor-pointer items-center justify-center md:size-8"
	>
		<input
			type="checkbox"
			checked={on}
			onchange={(e) => setReady(row, e.currentTarget.checked)}
			aria-label="Ready to teach {row.lesson?.title} to {row.classLabel}"
			class="peer size-5 cursor-pointer appearance-none rounded-[5px] border border-transparent bg-input/90 checked:border-primary checked:bg-primary md:size-4"
		/>
		<CheckIcon
			aria-hidden="true"
			class="pointer-events-none absolute hidden size-4 text-primary-foreground peer-checked:block md:size-3.5"
		/>
	</label>
{/if}
